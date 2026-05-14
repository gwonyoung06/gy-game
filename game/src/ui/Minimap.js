/**
 * Minimap — 플레이어 중심 회전형 미니맵
 *
 * - 플레이어 항상 캔버스 정중앙
 * - 카메라 yaw 기준으로 맵이 회전 (위쪽 = 플레이어 전방)
 * - 주변 장애물/건물을 회색 점으로 표시
 * - 랜드마크는 금색 별, 생물은 색상 점
 */

const BIOME_COLORS = {
  park:    { safe: '#6abf2e', mid: '#3d8c1a', edge: '#1f4a0d', ring: 'rgba(150,255,80,0.25)' },
  pond:    { safe: '#3a9e6f', mid: '#226644', edge: '#0d3322', ring: 'rgba(80,220,160,0.25)' },
  ocean:   { safe: '#ddcc88', mid: '#998844', edge: '#665522', ring: 'rgba(255,220,80,0.25)' },
  savanna: { safe: '#cc9944', mid: '#996622', edge: '#663300', ring: 'rgba(255,180,60,0.25)' },
  forest:  { safe: '#2a6a2a', mid: '#1a4a1a', edge: '#0a260a', ring: 'rgba(60,180,60,0.25)' },
  dino:    { safe: '#8b4a1f', mid: '#5a2e0d', edge: '#2a1200', ring: 'rgba(200,120,60,0.25)' },
  space:   { safe: '#1a1a3e', mid: '#0d0d22', edge: '#050510', ring: 'rgba(80,120,255,0.25)' },
};

function getBiome(stageId) {
  if (stageId <= 3)  return 'park';
  if (stageId <= 5)  return 'pond';
  if (stageId <= 8)  return 'ocean';
  if (stageId <= 10) return 'savanna';
  if (stageId <= 12) return 'forest';
  if (stageId <= 14) return 'dino';
  return 'space';
}

export class Minimap {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number}  stageId
   * @param {{safe:number, transition:number}} zones
   * @param {number}  worldView  플레이어 기준 표시 반경 (미터)
   */
  constructor(canvas, stageId, zones, worldView = 130) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.stageId   = stageId;
    this.zones     = zones;
    this.worldView = worldView;
    this._frame    = 0;
    this._palette  = BIOME_COLORS[getBiome(stageId)] || BIOME_COLORS.park;
    this._radarEnd = 0;

    // 정적 배경 오프스크린 (매 프레임 다시 그릴 필요 없음)
    this._bgCanvas = null;
    this._buildBg();
  }

  // ── 배경 빌드 (한 번만) ──────────────────────────────────────
  _buildBg() {
    const s   = this.canvas.width;
    const pal = this._palette;
    const cr  = s / 2;          // 캔버스 중심 좌표
    const off = document.createElement('canvas');
    off.width = off.height = s;
    const oc = off.getContext('2d');

    // ① 원형 클립
    oc.beginPath();
    oc.arc(cr, cr, cr - 1, 0, Math.PI * 2);
    oc.clip();

    // ② 방사형 그라디언트 (지형 느낌)
    const grad = oc.createRadialGradient(cr, cr, 0, cr, cr, cr);
    grad.addColorStop(0,    pal.safe);
    grad.addColorStop(0.45, pal.mid);
    grad.addColorStop(1,    pal.edge);
    oc.fillStyle = grad;
    oc.fillRect(0, 0, s, s);

    // ③ 격자 직선 4방향 (나침반 느낌)
    oc.strokeStyle = 'rgba(255,255,255,0.08)';
    oc.lineWidth = 0.5;
    oc.setLineDash([3, 4]);
    for (let a = 0; a < 4; a++) {
      const ax = cr + Math.sin(a * Math.PI / 2) * (cr - 4);
      const ay = cr - Math.cos(a * Math.PI / 2) * (cr - 4);
      oc.beginPath(); oc.moveTo(cr, cr); oc.lineTo(ax, ay); oc.stroke();
    }
    oc.setLineDash([]);

    // ④ 거리 링: 30m / 60m / 100m
    const ringDists = [30, 60, 100];
    ringDists.forEach((dist, i) => {
      const pr = (dist / this.worldView) * (cr - 4);
      if (pr > cr - 2) return;
      oc.strokeStyle = i === 0
        ? 'rgba(255,255,255,0.22)'
        : 'rgba(255,255,255,0.12)';
      oc.lineWidth = i === 0 ? 1.2 : 0.8;
      oc.beginPath();
      oc.arc(cr, cr, pr, 0, Math.PI * 2);
      oc.stroke();
    });

    // ⑤ 테두리 링
    oc.strokeStyle = 'rgba(255,255,255,0.45)';
    oc.lineWidth   = 2;
    oc.beginPath();
    oc.arc(cr, cr, cr - 1, 0, Math.PI * 2);
    oc.stroke();

    // ⑥ "위쪽 = 전방" 표시 삼각형 (항상 빨간 삼각)
    oc.fillStyle = 'rgba(255,80,80,0.75)';
    oc.beginPath();
    oc.moveTo(cr, 3);
    oc.lineTo(cr - 4, 11);
    oc.lineTo(cr + 4, 11);
    oc.closePath();
    oc.fill();

    this._bgCanvas = off;
  }

  // ── 매 프레임 호출 ──────────────────────────────────────────
  /**
   * @param {THREE.Vector3} playerPos  — _yaw 프로퍼티 포함 (CameraController 가 저장)
   * @param {Creature[]}    creatures
   * @param {{x,z}[]}       landmarks
   * @param {{x,z,r}[]}     structures  — World._structures (트리/벤치/소품 등)
   */
  update(playerPos, creatures, landmarks = [], structures = []) {
    this._frame++;
    if (this._frame % 2 !== 0) return; // 2프레임에 1번 갱신

    const { canvas, ctx } = this;
    const s    = canvas.width;
    const cr   = s / 2;
    const r    = cr - 3;      // 실제 그리기 반경 (테두리 제외)
    const yaw  = playerPos._yaw ?? 0;
    const scale = r / this.worldView;

    // ── 월드→캔버스 좌표 변환 (플레이어 중심 + yaw 회전) ────────
    // forward(yaw) 방향이 캔버스 위쪽(-Y)이 되도록 회전
    // rx = dx·cos(yaw) - dz·sin(yaw)
    // rz = dx·sin(yaw) + dz·cos(yaw)
    const toMap = (wx, wz) => {
      const dx = wx - playerPos.x;
      const dz = wz - playerPos.z;
      const rx =  dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const rz =  dx * Math.sin(yaw) + dz * Math.cos(yaw);
      return [cr + rx * scale, cr + rz * scale];
    };

    // 원형 클립
    ctx.save();
    ctx.beginPath();
    ctx.arc(cr, cr, cr - 1, 0, Math.PI * 2);
    ctx.clip();

    // ── 배경 ──────────────────────────────────────────────────
    ctx.drawImage(this._bgCanvas, 0, 0);

    // ── 주변 건물 / 나무 (시야 반경 내만, 회색 점) ──────────────
    ctx.fillStyle = 'rgba(220,220,200,0.28)';
    const wvSq = this.worldView * this.worldView;
    for (let i = 0; i < structures.length; i++) {
      const o = structures[i];
      // 시야 반경 내인지 sqrt 없이 체크
      const ddx = o.x - playerPos.x, ddz = o.z - playerPos.z;
      if (ddx * ddx + ddz * ddz > wvSq) continue;
      const [cx, cy] = toMap(o.x, o.z);
      if (cx < 0 || cx > s || cy < 0 || cy > s) continue;
      const dr = Math.max(1.8, o.r * scale * 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, dr, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 랜드마크 (금색 별, 항상 표시) ─────────────────────────
    ctx.fillStyle = 'rgba(255,215,50,0.95)';
    landmarks.forEach(lm => {
      const [cx, cy] = toMap(lm.x, lm.z ?? 0);
      if (Math.hypot(cx - cr, cy - cr) > r) return;
      this._drawStar(ctx, cx, cy, 5);
    });

    // ── 생물 ──────────────────────────────────────────────────
    const radar = this._isRadarActive();
    if (creatures) {
      for (let i = 0; i < creatures.length; i++) {
        const c = creatures[i];
        if (!c.alive || c.captured) continue;
        const [cx, cy] = toMap(c.mesh.position.x, c.mesh.position.z);
        if (Math.hypot(cx - cr, cy - cr) > r) continue;

        const aggro = (c.profile?.aggroRange ?? 0) > 0;
        if (radar) {
          ctx.fillStyle = '#ffee00';
        } else if (aggro) {
          ctx.fillStyle = '#ff4444';
        } else {
          ctx.fillStyle = '#44ff99';
        }

        ctx.beginPath();
        ctx.arc(cx, cy, aggro ? 3 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (aggro && !radar) {
          ctx.strokeStyle = 'rgba(255,60,60,0.6)';
          ctx.lineWidth   = 1;
          ctx.stroke();
        }
      }
    }

    // ── 플레이어 (항상 중앙) ───────────────────────────────────
    // 글로우
    const glow = ctx.createRadialGradient(cr, cr, 0, cr, cr, 12);
    glow.addColorStop(0,   'rgba(255,255,255,0.35)');
    glow.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cr, cr, 12, 0, Math.PI * 2); ctx.fill();

    // 흰 원
    ctx.fillStyle   = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(cr, cr, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 전방 화살표 (항상 위 = 전방)
    ctx.fillStyle = '#ffdd33';
    ctx.beginPath();
    ctx.moveTo(cr,     cr - 10); // 팁
    ctx.lineTo(cr - 4, cr - 2);
    ctx.lineTo(cr + 4, cr - 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ── 별 그리기 ────────────────────────────────────────────────
  _drawStar(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const b = a + Math.PI / 5;
      if (i === 0) {
        ctx.moveTo(cx + Math.cos(a) * r,        cy + Math.sin(a) * r);
      } else {
        ctx.lineTo(cx + Math.cos(a) * r,        cy + Math.sin(a) * r);
      }
      ctx.lineTo(cx + Math.cos(b) * r * 0.45, cy + Math.sin(b) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** 레이더 아이템: n초간 모든 생물 노란 점 강조 */
  showRadar(seconds) {
    this._radarEnd = performance.now() + seconds * 1000;
  }

  _isRadarActive() {
    return this._radarEnd && performance.now() < this._radarEnd;
  }

  dispose() {}
}
