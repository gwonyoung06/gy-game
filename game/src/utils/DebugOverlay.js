/**
 * DebugOverlay — 인게임 디버그 도구
 *
 * F3 : 퍼포먼스 HUD 토글  (FPS·드로우콜·크리처수·플레이어위치 등)
 * F4 : 크리처 AI 상태 시각화 토글  (상태 라벨 + 포획반경 원)
 * F5 : 콘솔 로그 패널 토글  (console.log/warn/error 인터셉트)
 * F6 : 게임 속도 사이클  (0.25× / 0.5× / 1× / 2×)
 * F7 : 갓 모드 토글  (무적)
 * F9 : 스크린샷 저장
 */

import * as THREE from 'three';

// ── 모듈레벨 투영 재사용 벡터 ─────────────────────────────────
const _sv = new THREE.Vector3();

export class DebugOverlay {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene    = scene;
    this.camera   = camera;

    this._hudVisible = false;
    this._aiVisible  = false;
    this._logVisible = false;

    this._fpsSamples = [];
    this._fps        = 0;

    this._logs    = [];
    this._maxLogs = 80;

    // 속도 제어
    this._speeds   = [0.25, 0.5, 1.0, 2.0];
    this._speedIdx = 2;   // 기본 1.0×
    this._speedMult = 1.0;

    // 갓 모드
    this._godMode = false;

    // 토스트 알림
    this._toastEl = null;

    // AI 시각화용 헬퍼 DOM 요소 풀
    this._aiLabels  = [];   // { el, captureEl } DOM 요소
    this._aiCircles = [];   // { el } 포획반경 원

    this._origConsole = null;

    this._buildHUD();
    this._buildLogPanel();
    this._buildAIContainer();
    this._buildToast();
    this._hookConsole();
    this._bindKeys();

    console.log('[DEBUG] DebugOverlay ready — F3:HUD  F4:AI  F5:LOG  F6:속도  F7:갓모드  F9:스크린샷');
  }

  // ══════════════════════════════════════════════════════════════
  // 빌드
  // ══════════════════════════════════════════════════════════════

  _buildHUD() {
    const el = document.createElement('div');
    el.id = '_dbg_hud';
    el.style.cssText = `
      position:fixed;top:12px;left:12px;z-index:99999;
      background:rgba(0,0,0,0.82);color:#00ff88;
      font-family:'Courier New',monospace;font-size:12px;line-height:1.75;
      padding:10px 16px;border-radius:8px;
      border:1px solid rgba(0,255,136,0.35);
      min-width:230px;pointer-events:none;display:none;
      text-shadow:0 0 6px rgba(0,255,136,0.4);
      box-shadow:0 4px 20px rgba(0,0,0,0.6);
    `;
    document.body.appendChild(el);
    this._hudEl = el;
  }

  _buildLogPanel() {
    const el = document.createElement('div');
    el.id = '_dbg_log';
    el.style.cssText = `
      position:fixed;bottom:12px;left:12px;z-index:99999;
      background:rgba(0,0,0,0.88);color:#cccccc;
      font-family:'Courier New',monospace;font-size:11px;line-height:1.55;
      padding:8px 12px;border-radius:8px;
      border:1px solid rgba(255,255,255,0.12);
      width:440px;max-height:220px;overflow-y:auto;
      pointer-events:none;display:none;
      box-shadow:0 4px 20px rgba(0,0,0,0.6);
    `;
    // 스크롤바 스타일
    const style = document.createElement('style');
    style.textContent = `
      #_dbg_log::-webkit-scrollbar{width:4px}
      #_dbg_log::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.3);border-radius:2px}
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);
    this._logEl = el;
  }

  _buildAIContainer() {
    const el = document.createElement('div');
    el.id = '_dbg_ai';
    el.style.cssText = `
      position:fixed;inset:0;z-index:99998;pointer-events:none;display:none;overflow:hidden;
    `;
    document.body.appendChild(el);
    this._aiContainerEl = el;
  }

  _buildToast() {
    const el = document.createElement('div');
    el.id = '_dbg_toast';
    el.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.88);color:#fff;
      font-family:'Courier New',monospace;font-size:18px;font-weight:bold;
      padding:14px 28px;border-radius:12px;
      border:1.5px solid rgba(78,205,196,0.6);
      box-shadow:0 0 30px rgba(78,205,196,0.25);
      pointer-events:none;display:none;z-index:100000;
      letter-spacing:1px;text-align:center;
    `;
    document.body.appendChild(el);
    this._toastEl = el;
    this._toastTimer = null;
  }

  _showToast(msg, color = '#4ecdc4') {
    if (!this._toastEl) return;
    this._toastEl.innerHTML = `<span style="color:${color}">${msg}</span>`;
    this._toastEl.style.display = 'block';
    this._toastEl.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toastEl.style.display = 'none';
    }, 1400);
  }

  // ══════════════════════════════════════════════════════════════
  // 콘솔 인터셉트
  // ══════════════════════════════════════════════════════════════

  _hookConsole() {
    const orig = {
      log:   console.log.bind(console),
      warn:  console.warn.bind(console),
      error: console.error.bind(console),
    };
    this._origConsole = orig;
    const self = this;
    const colors = { log:'#cccccc', warn:'#ffcc44', error:'#ff5555' };
    const icons  = { log:'▸', warn:'⚠', error:'✖' };

    ['log','warn','error'].forEach(level => {
      console[level] = (...args) => {
        orig[level](...args);
        const text = args.map(a => {
          try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
          catch { return String(a); }
        }).join(' ');
        self._logs.push({ text, color: colors[level], icon: icons[level], t: Date.now() });
        if (self._logs.length > self._maxLogs) self._logs.shift();
        if (self._logVisible) self._renderLogs();
        // 에러는 자동으로 패널 표시
        if (level === 'error' && !self._logVisible) {
          self._logVisible = true;
          self._logEl.style.display = 'block';
          self._renderLogs();
        }
      };
    });
  }

  _renderLogs() {
    this._logEl.innerHTML = this._logs.map(l =>
      `<div style="color:${l.color};border-bottom:1px solid rgba(255,255,255,0.05);padding:1px 0">` +
      `<span style="opacity:0.5;font-size:10px">${new Date(l.t).toTimeString().slice(0,8)}</span> ` +
      `${l.icon} ${l.text}</div>`
    ).join('');
    this._logEl.scrollTop = this._logEl.scrollHeight;
  }

  // ══════════════════════════════════════════════════════════════
  // 키 바인딩
  // ══════════════════════════════════════════════════════════════

  _bindKeys() {
    this._onKey = e => {
      if (e.code === 'F3') { e.preventDefault(); this.toggleHUD(); }
      if (e.code === 'F4') { e.preventDefault(); this.toggleAI(); }
      if (e.code === 'F5') { e.preventDefault(); this.toggleLog(); }

      if (e.code === 'F6') {
        e.preventDefault();
        this._speedIdx  = (this._speedIdx + 1) % this._speeds.length;
        this._speedMult = this._speeds[this._speedIdx];
        this.onSpeedChange?.(this._speedMult);
        const labels = ['0.25×', '0.5×', '1×', '2×'];
        const colors = ['#4488ff', '#88ccff', '#4ecdc4', '#ff8822'];
        this._showToast(`⏩ 게임 속도: ${labels[this._speedIdx]}`, colors[this._speedIdx]);
      }

      if (e.code === 'F7') {
        e.preventDefault();
        this._godMode = !this._godMode;
        this.onGodMode?.(this._godMode);
        if (this._godMode) {
          this._showToast('🛡 갓 모드 ON', '#ffcc44');
        } else {
          this._showToast('갓 모드 OFF', '#888888');
        }
      }

      if (e.code === 'F9') {
        e.preventDefault();
        this.onScreenshot?.();
        this._showToast('📸 스크린샷 저장', '#00ff88');
      }
    };
    document.addEventListener('keydown', this._onKey);
  }

  toggleHUD() {
    this._hudVisible = !this._hudVisible;
    this._hudEl.style.display = this._hudVisible ? 'block' : 'none';
  }

  toggleAI() {
    this._aiVisible = !this._aiVisible;
    this._aiContainerEl.style.display = this._aiVisible ? 'block' : 'none';
    if (!this._aiVisible) this._clearAILabels();
  }

  toggleLog() {
    this._logVisible = !this._logVisible;
    this._logEl.style.display = this._logVisible ? 'block' : 'none';
    if (this._logVisible) this._renderLogs();
  }

  // ══════════════════════════════════════════════════════════════
  // 매 프레임 업데이트
  // ══════════════════════════════════════════════════════════════

  /**
   * @param {number}  delta
   * @param {THREE.Vector3|null} playerPos
   * @param {object|null}  waves      WaveSystem 인스턴스
   * @param {object|null}  world      World 인스턴스
   * @param {object|null}  player     Player 인스턴스 (속도·캡처범위)
   */
  update(delta, playerPos, waves, world, player) {
    // FPS 누적
    this._fpsSamples.push(delta);
    if (this._fpsSamples.length > 60) this._fpsSamples.shift();
    const avgDelta = this._fpsSamples.reduce((a,b)=>a+b,0) / this._fpsSamples.length;
    this._fps = Math.round(1 / avgDelta);

    if (this._hudVisible)  this._updateHUD(delta, playerPos, waves, player);
    if (this._aiVisible)   this._updateAI(waves, player);
  }

  // ── HUD 텍스트 갱신 ──────────────────────────────────────────
  _updateHUD(delta, playerPos, waves, player) {
    const info    = this.renderer.info;
    const mem     = info.memory;
    const render  = info.render;
    const creatures = waves?.creatures ?? [];

    // FPS 색상: 60+ 초록 / 30+ 노랑 / 붉음
    const fpsCol = this._fps >= 55 ? '#00ff88' : this._fps >= 28 ? '#ffcc44' : '#ff5555';

    const waveState = waves?.getState?.() ?? {};

    const speedCol = this._speedMult === 1.0 ? '#4ecdc4'
      : this._speedMult < 1.0 ? '#4488ff' : '#ff8822';
    const speedLabel = `${this._speedMult}×`;
    const godStr  = this._godMode
      ? `<span style="color:#ffcc44;font-weight:bold">🛡 갓모드 ON</span>`
      : `<span style="color:#666">갓모드 OFF</span>`;

    const lines = [
      `<span style="color:#4ecdc4;font-weight:bold;letter-spacing:1px">─── HUNTERS DEBUG ───</span>`,
      `<span style="color:${fpsCol}">FPS: ${this._fps}</span>  <span style="color:#888">Δt: ${(delta*1000).toFixed(1)}ms</span>`,
      ``,
      `<span style="color:#ffcc44">■ 렌더러</span>`,
      `  드로우콜: <b>${render.calls}</b>   트라이앵글: <b>${(render.triangles/1000).toFixed(1)}k</b>`,
      `  지오메트리: ${mem.geometries}  텍스처: ${mem.textures}`,
      ``,
      `<span style="color:#ffcc44">■ 플레이어</span>`,
      `  X: <b>${playerPos?.x?.toFixed(1) ?? '?'}</b>  Z: <b>${playerPos?.z?.toFixed(1) ?? '?'}</b>  Y: <b>${playerPos?.y?.toFixed(2) ?? '?'}</b>`,
      `  속도: <b>${player?.speed ?? '?'}</b>  포획반경: <b>${player?.captureRange?.toFixed(1) ?? '?'}</b>m`,
      ``,
      `<span style="color:#ffcc44">■ 웨이브</span>`,
      `  크리처: <b>${creatures.length}</b>  웨이브: <b>${waveState.wave ?? '?'}</b>`,
      `  남은시간: <b>${waveState.timeLeft?.toFixed(0) ?? '?'}s</b>  포획: <b>${waveState.captured ?? '?'}</b>`,
      ``,
      `<span style="color:#ffcc44">■ 디버그 제어</span>`,
      `  게임속도: <span style="color:${speedCol}"><b>${speedLabel}</b></span>  ${godStr}`,
      ``,
      `<span style="color:#888;font-size:10px">F3:HUD  F4:AI  F5:로그  F6:속도  F7:갓모드  F9:캡처</span>`,
    ];

    this._hudEl.innerHTML = lines.join('<br>');
  }

  // ── AI 라벨 갱신 ─────────────────────────────────────────────
  _updateAI(waves, player) {
    const creatures  = waves?.creatures ?? [];
    const container  = this._aiContainerEl;
    const W = window.innerWidth, H = window.innerHeight;
    const captureR   = player?.captureRange ?? 5;

    // 라벨 풀 확장
    while (this._aiLabels.length < creatures.length) {
      const wrap = document.createElement('div');
      wrap.style.cssText = `
        position:absolute;display:flex;flex-direction:column;align-items:center;
        pointer-events:none;transform:translate(-50%,-100%);
      `;
      // 상태 배지
      const badge = document.createElement('div');
      badge.style.cssText = `
        font-family:'Courier New',monospace;font-size:9px;font-weight:bold;
        padding:2px 6px;border-radius:4px;letter-spacing:0.5px;
        border:1px solid rgba(255,255,255,0.3);
        text-shadow:0 0 4px currentColor;
        white-space:nowrap;
      `;
      // 이름 라벨
      const name = document.createElement('div');
      name.style.cssText = `
        font-family:'Courier New',monospace;font-size:8px;color:rgba(255,255,255,0.5);
        margin-top:2px;
      `;
      wrap.append(badge, name);
      container.appendChild(wrap);
      this._aiLabels.push({ wrap, badge, name });
    }

    // 포획반경 원 풀 (플레이어 위치 기준 하나만)
    if (!this._captureCircle) {
      const circ = document.createElement('div');
      circ.style.cssText = `
        position:absolute;border-radius:50%;
        border:1.5px dashed rgba(78,205,196,0.7);
        box-shadow:0 0 8px rgba(78,205,196,0.3);
        pointer-events:none;transform:translate(-50%,-50%);
        display:none;
      `;
      container.appendChild(circ);
      this._captureCircle = circ;
    }

    // 플레이어 위치를 화면좌표로 — 포획반경 원 표시
    if (player?.mesh) {
      _sv.copy(player.mesh.position).project(this.camera);
      if (_sv.z < 1) {
        const sx = (_sv.x * 0.5 + 0.5) * W;
        const sy = (1 - (_sv.y * 0.5 + 0.5)) * H;
        // 화면상 반경: 실제 captureRange를 픽셀로 근사 (fov·distance 기반)
        const dist = player.mesh.position.distanceTo(this.camera.position);
        const fovRad = this.camera.fov * Math.PI / 180;
        const pxPerMeter = (H / (2 * Math.tan(fovRad / 2))) / dist;
        const pxR = captureR * pxPerMeter;
        this._captureCircle.style.cssText = `
          position:absolute;border-radius:50%;
          border:1.5px dashed rgba(78,205,196,0.7);
          box-shadow:0 0 8px rgba(78,205,196,0.3);
          pointer-events:none;transform:translate(-50%,-50%);
          left:${sx}px;top:${sy}px;
          width:${pxR*2}px;height:${pxR*2}px;display:block;
        `;
      } else {
        this._captureCircle.style.display = 'none';
      }
    }

    // 상태 컬러 맵
    const stateColors = {
      idle:   { bg:'rgba(30,80,50,0.85)',   col:'#00ff88' },
      flee:   { bg:'rgba(80,20,20,0.85)',   col:'#ff5555' },
      attack: { bg:'rgba(80,40,10,0.85)',   col:'#ff8822' },
      hover:  { bg:'rgba(20,40,80,0.85)',   col:'#4488ff' },
      soar:   { bg:'rgba(30,30,80,0.85)',   col:'#8899ff' },
      buzz:   { bg:'rgba(70,70,10,0.85)',   col:'#ffff44' },
      circle: { bg:'rgba(40,20,80,0.85)',   col:'#cc88ff' },
    };

    let visible = 0;
    for (let i = 0; i < creatures.length; i++) {
      const c   = creatures[i];
      const lbl = this._aiLabels[i];
      if (!c.mesh) { lbl.wrap.style.display = 'none'; continue; }

      // 3D → 스크린
      _sv.copy(c.mesh.position);
      _sv.y += 1.5;
      _sv.project(this.camera);

      if (_sv.z >= 1) { lbl.wrap.style.display = 'none'; continue; }

      const sx = (_sv.x * 0.5 + 0.5) * W;
      const sy = (1 - (_sv.y * 0.5 + 0.5)) * H;

      if (sx < -40 || sx > W+40 || sy < -40 || sy > H+40) {
        lbl.wrap.style.display = 'none'; continue;
      }

      const state  = c._state ?? 'idle';
      const theme  = stateColors[state] ?? { bg:'rgba(30,30,30,0.85)', col:'#cccccc' };

      lbl.wrap.style.left    = `${sx}px`;
      lbl.wrap.style.top     = `${sy}px`;
      lbl.wrap.style.display = 'flex';
      lbl.badge.textContent  = state.toUpperCase();
      lbl.badge.style.background = theme.bg;
      lbl.badge.style.color      = theme.col;
      lbl.badge.style.borderColor = theme.col + '66';
      lbl.name.textContent = c.config?.name ?? c.type ?? '';
      visible++;
    }

    // 나머지 라벨 숨기기
    for (let i = visible; i < this._aiLabels.length; i++) {
      this._aiLabels[i].wrap.style.display = 'none';
    }
  }

  // ── AI 라벨 풀 클리어 ────────────────────────────────────────
  _clearAILabels() {
    for (const { wrap } of this._aiLabels) wrap.style.display = 'none';
    if (this._captureCircle) this._captureCircle.style.display = 'none';
  }

  // ══════════════════════════════════════════════════════════════
  // 정리
  // ══════════════════════════════════════════════════════════════
  dispose() {
    document.removeEventListener('keydown', this._onKey);
    clearTimeout(this._toastTimer);
    this._hudEl?.remove();
    this._logEl?.remove();
    this._aiContainerEl?.remove();
    this._toastEl?.remove();
    // 콘솔 원복
    if (this._origConsole) {
      console.log   = this._origConsole.log;
      console.warn  = this._origConsole.warn;
      console.error = this._origConsole.error;
    }
    // 속도/갓모드 리셋 콜백
    this.onSpeedChange?.(1.0);
    this.onGodMode?.(false);
  }
}
