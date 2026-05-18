import * as THREE from 'three';

const MAP_HALF   = 500;   // 지형 원복 — 오브젝트 좌표계 유지
const SPAWN_HALF = 200;
export { SPAWN_HALF };

// ══════════════════════════════════════════════════════════════════
// 결정론적 PRNG — mulberry32
// 스테이지 ID × 시드 상수로 매 실행 동일한 맵 레이아웃 보장
// ══════════════════════════════════════════════════════════════════
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 배치 패턴 헬퍼 ───────────────────────────────────────────────

/** 클러스터 배치 — clusterCount개 중심, 각 중심 주변에 perCluster개 산포 */
function clusterSpawn(clusterCount, perCluster, spread, clusterRadius, rng) {
  const centers = Array.from({ length: clusterCount }, () => ({
    x: (rng() - 0.5) * spread * 2,
    z: (rng() - 0.5) * spread * 2,
  }));
  return centers.flatMap(c =>
    Array.from({ length: perCluster }, () => ({
      x: c.x + (rng() - 0.5) * clusterRadius * 2,
      z: c.z + (rng() - 0.5) * clusterRadius * 2,
    }))
  );
}

/** 포아송 디스크 샘플링 (간이) — minDist 이상 거리 보장, 자연스러운 분포 */
function poissonSpawn(count, spread, minDist, rng) {
  const pts = [];
  let tries = 0;
  while (pts.length < count && tries++ < count * 40) {
    const x = (rng() - 0.5) * spread * 2;
    const z = (rng() - 0.5) * spread * 2;
    if (pts.every(p => Math.hypot(p.x - x, p.z - z) > minDist)) pts.push({ x, z });
  }
  return pts;
}

/** 링 배치 — 랜드마크 주변 원형, jitter로 자연스러움 추가 */
function ringSpawn(cx, cz, radius, count, jitter, rng) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const r = radius * (1 + (rng() - 0.5) * jitter);
    return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
  });
}

// ── 지형 높이 파라미터 (스테이지별) ──────────────────────────────
// 자연스러운 기복 — 게임플레이 중심 시야 확보를 위해 낮게 유지
const TERRAIN_SCALE = [
  0,     // unused
  0.18,  // 1-3  공원  — 완만한 잔디 언덕 (인공 공원 느낌)
  0.18,
  0.18,
  0.08,  // 4-5  연못  — 거의 평평, 수면 기준
  0.08,
  0.04,  // 6-8  해양  — 해저 평탄, 파도는 비주얼 전용
  0.04,
  0.04,
  0.30,  // 9-10 사바나 — 완만한 대평원 기복
  0.30,
  0.55,  // 11-12 숲   — 굴곡 있는 숲 지형
  0.55,
  0.80,  // 13-14 공룡섬 — 드라마틱한 지형
  0.80,
  0.02,  // 15   우주  — 거의 평탄 (달 표면)
];

export class World {
  constructor(scene, stageData, settings) {
    this.scene    = scene;
    this.stage    = stageData;
    this.settings = settings;
    this.objects  = [];
    this._scl = TERRAIN_SCALE[stageData.id] ?? 0.85;
    // 결정론적 RNG — 같은 스테이지는 항상 같은 맵 레이아웃
    this._rng = mulberry32(stageData.id * 1337 + 42);
    // 구역 정의 (스폰 시스템 연동용)
    this._zones = { safe: 40, transition: 80, danger: 115, landmarks: [] };
    this._obstacles  = []; // 나무·버섯 등 콜라이더 목록 { x, z, r }
    this._structures = []; // 미니맵 표시용 주요 오브젝트 { x, z, r }

    // ── 대기 파티클 (꽃가루/먼지) ─────────────────────────────
    this._pollens      = null;  // InstancedMesh
    this._pollenData   = [];    // [{ x, y, z, vx, vz, speed }]
    this._pollenDummy  = new THREE.Object3D();
    this._pollenTimer  = 0;

    this._build();
  }

  // ── 공개: 지형 높이 쿼리 (스테이지별 고유 공식) ──────────────
  getHeight(x, z) {
    const id  = this.stage.id;
    const s   = this._scl;
    const d   = Math.sqrt(x * x + z * z);
    // 스폰 중심 평탄 페이드
    const fade = d < 18 ? 0 : d < 34 ? (d - 18) / 16 : 1;

    let h = 0;

    if (id <= 3) {
      // ── 공원 ─ 완만한 인공 언덕, 중앙 산책로 살짝 낮게
      const roll  = Math.sin(x * 0.013 + 0.7) * Math.cos(z * 0.011 + 1.3) * 6 * s
                  + Math.cos(x * 0.009 - z * 0.012 + 2.1) * 4 * s;
      const bump  = Math.sin(x * 0.026 + z * 0.022 + 0.5) * 2.2 * s;
      const path  = -Math.max(0, 1.8 - Math.abs(x) * 0.016) * 0.9 * s; // 중앙 통로 낮음
      h = roll + bump + path;

    } else if (id === 4) {
      // ── 연못 ─ 그릇형: 중앙 낮고 외곽 완만히 상승, 수초 요철
      const bowl   = Math.max(0, (d - 20) / 55) * 3.5 * s;
      const ripple = Math.sin(x * 0.040 + 1.2) * Math.cos(z * 0.036 + 0.9) * 0.9 * s;
      h = bowl + ripple;

    } else if (id === 5) {
      // ── 습지 ─ 더 울퉁불퉁, 수렁 패임, 갈대밭 언덕
      const marsh  = Math.sin(x * 0.018 + 0.4) * Math.cos(z * 0.015 + 1.8) * 3.5 * s
                   + Math.sin(x * 0.032 - z * 0.027 + 2.2) * 1.8 * s;
      const sag    = -Math.max(0, 2.0 - Math.abs(Math.sin(x * 0.04) * Math.cos(z * 0.035)) * 4) * 0.5 * s;
      h = marsh + sag;

    } else if (id === 6) {
      // ── 강가 ─ 강 중심 낮고 제방 경사, 모래톱 형성
      const bank   = Math.max(0, (Math.abs(x) - 25) / 60) * 4.5 * s;
      const ripple = Math.sin(x * 0.045 + 0.7) * Math.cos(z * 0.038 + 1.4) * 1.2 * s;
      const bar    = Math.max(0, 1.5 - Math.abs(z * 0.018 + Math.sin(x * 0.012))) * 0.8 * s;
      h = bank + ripple + bar;

    } else if (id === 7) {
      // ── 바닷가 ─ 완만한 해안 경사, 파도 지형, 모래언덕
      const shore  = Math.max(0, d - 35) * 0.020 * s;
      const dune   = Math.sin(x * 0.038 + 0.9) * Math.cos(z * 0.034 + 0.5) * 2.2 * s;
      const tide   = Math.sin(x * 0.09 + z * 0.07 + 1.6) * 0.5 * s;
      h = shore + dune + tide;

    } else if (id === 8) {
      // ── 깊은 바다 ─ 해저 평탄 + 산호초 언덕 + 해구
      const seabed = Math.sin(x * 0.010 + 0.5) * Math.cos(z * 0.009 + 1.1) * 3.0 * s;
      const reef   = Math.max(0, 2.0 - Math.sqrt((x - 60) * (x - 60) + (z + 40) * (z + 40)) * 0.03) * 3 * s;
      h = seabed + reef;

    } else if (id === 9) {
      // ── 열대우림 ─ 울창한 언덕 + 계곡 + 강줄기
      const jungle = Math.sin(x * 0.014 + 0.8) * Math.cos(z * 0.012 + 1.5) * 9 * s
                   + Math.cos(x * 0.009 - z * 0.011 + 2.7) * 6 * s;
      const vines  = Math.sin(x * 0.028 + z * 0.024 + 0.3) * 3.5 * s;
      const river  = -Math.max(0, 2.5 - Math.abs(x * 0.015 + Math.sin(z * 0.008) * 3)) * 1.5 * s;
      h = jungle + vines + river;

    } else if (id === 10) {
      // ── 사바나 ─ 광활한 평원 + 코피에(바위섬 언덕) 2개
      const plains = Math.sin(x * 0.008 + 1.2) * Math.cos(z * 0.007 + 0.8) * 10 * s
                   + Math.cos(x * 0.013 - z * 0.011 + 1.9) * 5 * s;
      const micro  = Math.sin(x * 0.050 + z * 0.045 + 2.8) * 1.4 * s;
      const kopje1 = Math.max(0, 12 * s - Math.sqrt((x + 90) * (x + 90) + (z - 70) * (z - 70)) * 0.18 * s);
      const kopje2 = Math.max(0,  8 * s - Math.sqrt((x - 130) * (x - 130) + (z + 85) * (z + 85)) * 0.14 * s);
      h = plains + micro + kopje1 + kopje2;

    } else if (id === 11) {
      // ── 설산 ─ 뾰족한 봉우리 + 눈 덮인 능선 + 빙하 계곡
      const peaks  = Math.sin(x * 0.010 + 0.6) * 18 * s + Math.cos(z * 0.009 + 2.0) * 15 * s;
      const ridges = Math.sin(x * 0.022 + z * 0.018 + 0.4) * 8 * s
                   + Math.cos(x * 0.030 - z * 0.024 + 1.3) * 5 * s;
      const glacier = -Math.max(0, 5 * s - Math.sqrt((x + 50) * (x + 50) + z * z) * 0.06 * s) * 0.6;
      const detail  = Math.sin(x * 0.065 + z * 0.058 + 2.2) * 1.8 * s;
      h = peaks + ridges + glacier + detail;

    } else if (id === 12) {
      // ── 밀림 ─ 두꺼운 식생, 계단식 지형, 숨겨진 계곡
      const canopy = Math.sin(x * 0.012 + 0.3) * Math.cos(z * 0.010 + 1.7) * 14 * s
                   + Math.cos(x * 0.008 - z * 0.007 + 2.4) * 10 * s;
      const steps  = Math.sin(x * 0.025 + z * 0.020 + 1.0) * 5.5 * s;
      const gorge  = -Math.max(0, 3.5 - Math.abs(x * 0.012 + Math.sin(z * 0.009) * 5)) * 2.5 * s;
      const tex    = Math.sin(x * 0.070 + z * 0.062 + 3.0) * 1.2 * s;
      h = canopy + steps + gorge + tex;

    } else if (id === 13) {
      // ── 화산지대 ─ 화산 콘 + 용암 평원 + 절벽
      const lava   = Math.sin(x * 0.011 + 0.9) * Math.cos(z * 0.010 + 1.4) * 16 * s
                   + Math.cos(x * 0.007 - z * 0.009 + 3.2) * 10 * s;
      const cliffs = Math.sin(x * 0.022 + z * 0.018 + 0.7) * 7 * s;
      const rough  = Math.sin(x * 0.048 + z * 0.042 + 1.9) * 2.8 * s;
      // 화산 봉우리 고정 위치
      const v1 = Math.max(0, 20 * s - Math.sqrt((x - 150) * (x - 150) + (z + 80) * (z + 80)) * 0.25 * s);
      h = lava + cliffs + rough + v1;

    } else if (id === 14) {
      // ── 공룡섬 ─ 극적 지형, 메사(탁상지형), 협곡
      const mesa   = Math.sin(x * 0.010 + 0.5) * 20 * s + Math.cos(z * 0.009 + 2.1) * 14 * s;
      const canyon = -Math.max(0, 6 * s - Math.abs(Math.sin(x * 0.014 + z * 0.010)) * 10 * s);
      const rough  = Math.sin(x * 0.040 + z * 0.035 + 2.4) * 3.5 * s;
      const pillar = Math.max(0, 8 * s - Math.sqrt((x + 100) * (x + 100) + (z - 130) * (z - 130)) * 0.20 * s);
      h = mesa + canyon + rough + pillar;

    } else {
      // ── 우주 (15) ─ 달 표면, 크레이터 분지 + 평탄 기저
      const moonBase = Math.sin(x * 0.012 + 0.4) * Math.cos(z * 0.010 + 1.0) * 2.5;
      const crater1  = -Math.max(0, 5.0 - Math.sqrt((x - 55) * (x - 55) + (z - 35) * (z - 35)) * 0.09);
      const crater2  = -Math.max(0, 3.5 - Math.sqrt((x + 75) * (x + 75) + (z + 55) * (z + 55)) * 0.07);
      const crater3  = -Math.max(0, 4.0 - Math.sqrt((x - 20) * (x - 20) + (z + 100) * (z + 100)) * 0.08);
      h = moonBase + crater1 + crater2 + crater3;
    }

    const soft = h >= 0 ? h : h * 0.07;
    return soft * fade;
  }

  // ── 스테이지별 조명·안개 파라미터 ────────────────────────────
  _stageAtmosphere(id, tod) {
    // [ambientColor, ambientInt, sunColor, sunInt, sunX, sunY, sunZ, fogColorHex, fogBaseDensity, hemiGround]
    const M = {
      1:  [0xffeedd, 0.75, 0xfffce0, 1.45, 120, 280,  80, 0x99ccee, 0.006, 0x66bb44],
      2:  [0xfff0f0, 0.80, 0xfffde0, 1.50,  90, 260,  60, 0xaaddff, 0.005, 0x77cc55],
      3:  [0xeeffee, 0.78, 0xffffe0, 1.45, 100, 270,  70, 0xaaccee, 0.006, 0x66aa44],
      4:  [0xddeecc, 0.68, 0xddfaff, 1.30,  70, 220,  90, 0x88bbdd, 0.009, 0x446633],
      5:  [0xaabbaa, 0.55, 0xbbddcc, 1.10,  40, 180, 110, 0x557766, 0.012, 0x334433],
      6:  [0xddeeff, 0.72, 0xeef8ff, 1.35,  80, 230,  70, 0x99bbdd, 0.008, 0x557744],
      7:  [0xfff5dd, 0.85, 0xfffacc, 1.55, 150, 320, 100, 0xbbddff, 0.004, 0xcc9944],
      8:  [0x002244, 0.35, 0x2244aa, 0.80,  30, 120,  60, 0x001133, 0.015, 0x001122],
      9:  [0x88cc88, 0.60, 0xaaffaa, 1.20,  60, 200,  80, 0x44aa55, 0.014, 0x226622],
      10: [0xffcc88, 0.82, 0xffa030, 1.50, 180, 300, 120, 0xffbb66, 0.004, 0xaa7722],
      11: [0xccddff, 0.70, 0xeef5ff, 1.30,  60, 200, -60, 0xaaccee, 0.012, 0x88aacc],
      12: [0x224422, 0.50, 0x88dd88, 1.10,  40, 180,  90, 0x225533, 0.016, 0x112211],
      13: [0x442211, 0.55, 0xff6622, 1.30, 200, 250,  80, 0xff6633, 0.010, 0x331100],
      14: [0x553322, 0.60, 0xddaa44, 1.25, 160, 240,  90, 0xaa7744, 0.008, 0x442211],
      15: [0x000011, 0.15, 0x6688ff, 0.60,   0, 500,   0, 0x000011, 0.000, 0x000011],
    };
    return M[id] ?? M[1];
  }

  _build() {
    const env = this.stage.env;
    const tod = this.settings.timeOfDay;
    const id  = this.stage.id;

    let skyColor = env.sky ?? 0x87ceeb;
    if (tod === 'night') skyColor = id === 15 ? 0x000011 : 0x000d1a;
    else if (tod === 'dusk') skyColor = 0xff6633;

    // ── 대기 파라미터 (스테이지별) ────────────────────────────
    const [ambCol, ambInt, sunCol, sunInt, sunX, sunY, sunZ, fogHex, fogBase, hemiGnd]
      = this._stageAtmosphere(id, tod);

    // 시간대 보정
    const todAmbMult = tod === 'night' ? 0.28 : tod === 'dusk' ? 0.60 : 1.00;
    const todSunMult = tod === 'night' ? 0.20 : tod === 'dusk' ? 0.70 : 1.00;
    const actualSunCol  = tod === 'night' ? 0x445577 : tod === 'dusk' ? 0xff7722 : sunCol;
    const actualFogHex  = tod === 'night' ? (id === 15 ? 0x000011 : 0x050d1a) : tod === 'dusk' ? 0xaa4422 : fogHex;

    // 하늘 돔
    const horizonColor = this._horizonColor(skyColor, tod);
    this.scene.background = null;
    this._buildSkyDome(skyColor, horizonColor, tod);

    // 안개
    const fogWMult = this.settings.weather === 'fog'  ? 2.8
                   : this.settings.weather === 'rain' ? 1.4 : 1.0;
    const fogDense = id === 15 ? 0 : Math.max(0.001, fogBase * fogWMult * 0.22);
    this.scene.fog = id === 15 ? null : new THREE.FogExp2(new THREE.Color(actualFogHex), fogDense);

    // 조명
    const ambient = new THREE.AmbientLight(new THREE.Color(ambCol), ambInt * todAmbMult);
    const sun     = new THREE.DirectionalLight(new THREE.Color(actualSunCol), sunInt * todSunMult);
    sun.position.set(sunX, sunY, sunZ);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius     = id >= 13 ? 1.5 : 2.5;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 700;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -220;
    sun.shadow.camera.right = sun.shadow.camera.top   =  220;
    const hemi = new THREE.HemisphereLight(skyColor, new THREE.Color(hemiGnd), 0.55 * todAmbMult);

    // 스테이지별 보조 조명
    if (id === 5 || id === 12) {
      // 습지·밀림: 녹색 반사광 (대기 산란)
      const fillGreen = new THREE.DirectionalLight(0x224422, 0.25);
      fillGreen.position.set(-60, 80, 40);
      this.scene.add(fillGreen);
      this.objects.push(fillGreen);
    }
    if (id === 13 || id === 14) {
      // 화산·공룡섬: 붉은 지면 반사 (용암 글로우)
      const lavaGlow = new THREE.PointLight(0xff4400, 1.5, 160);
      lavaGlow.position.set(0, 5, 0);
      this.scene.add(lavaGlow);
      this.objects.push(lavaGlow);
    }
    if (id === 15) {
      // 우주: 원형 점광원 (행성 반사)
      const starLight = new THREE.PointLight(0x6688ff, 1.0, 800);
      starLight.position.set(0, 400, 0);
      this.scene.add(starLight);
      this.objects.push(starLight);
    }

    this.scene.add(ambient, sun, hemi);
    this.objects.push(ambient, sun, hemi);

    this._buildGround(env);

    if      (id <= 3)  this._buildPark();
    else if (id <= 5)  this._buildPond();
    else if (id === 6) this._buildRiver();
    else if (id === 7) this._buildBeach();
    else if (id === 8) this._buildOcean();
    else if (id === 9) this._buildJungle();
    else if (id === 10)this._buildSavanna();
    else if (id === 11)this._buildSnowMtn();
    else if (id === 12)this._buildForest();
    else if (id <= 14) this._buildDinoIsland();
    else               this._buildSpace();

    if (this.settings.weather === 'rain') this._buildRain();
    else if (id === 11)                   this._buildSnow();
  }

  // ── horizon 색: 대기 산란 — 하늘색을 유지하면서 살짝 밝게
  _horizonColor(skyColor, tod) {
    if (tod === 'night') return 0x0a1625;
    if (tod === 'dusk')  return 0xff7033;
    const c = new THREE.Color(skyColor);
    // 낮: 채도는 유지하고 밝기만 아주 조금 높임 → 흰 박무 대신 하늘색 원경
    c.offsetHSL(0, -0.04, 0.06);
    return c;
  }

  // ── 하늘 돔: 3점 그라디언트 (zenith → mid → horizon) ──────────
  _buildSkyDome(zenithColor, horizonColor, tod) {
    const geo = new THREE.SphereGeometry(900, 32, 18);
    const pos = geo.attributes.position;
    const colArr = new Float32Array(pos.count * 3);
    const top = new THREE.Color(zenithColor);
    const hor = new THREE.Color(horizonColor);
    // 중간 색상: 낮에는 하늘색 유지, 석양엔 주황-노랑 밴드
    const mid = tod === 'dusk'  ? new THREE.Color(0xffaa44)
              : tod === 'night' ? new THREE.Color(0x081428)
              : top.clone().offsetHSL(0, 0.02, -0.04);

    for (let i = 0; i < pos.count; i++) {
      // normalise Y: -1(밑)~+1(꼭대기)
      const ny = pos.getY(i) / 900;
      let c;
      if (ny >= 0) {
        // 상반구: zenith → mid
        const t = Math.min(1, ny / 0.6);
        c = mid.clone().lerp(top, t * t);
      } else {
        // 하반구(지평선 아래): horizon 색 — horizon glow 효과
        const t = Math.min(1, -ny / 0.25);
        c = hor.clone().lerp(new THREE.Color(horizonColor).offsetHSL(0, 0.08, -0.04), t);
      }
      colArr[i * 3]     = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mat  = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -1;
    this.scene.add(dome);
    this.objects.push(dome);

    // 태양 디스크 (낮/노을) — 광원 방향과 일치시킴
    if (tod !== 'night') {
      const sunColor = tod === 'dusk' ? 0xff6622 : 0xfffef0;
      const glowColor = tod === 'dusk' ? 0xff8833 : 0xffeeaa;
      // 태양 본체
      const sunMat  = new THREE.MeshBasicMaterial({ color: sunColor });
      const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), sunMat);
      sunMesh.position.set(250, 430, -280);
      this.scene.add(sunMesh);
      this.objects.push(sunMesh);
      // 태양 후광 (큰 반투명 구체)
      const glowMat  = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.18 });
      const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(38, 12, 8), glowMat);
      glowMesh.position.copy(sunMesh.position);
      this.scene.add(glowMesh);
      this.objects.push(glowMesh);
    }

    // 별 (밤) — 더 풍성하게
    if (tod === 'night') this._buildStars();
  }

  // ── 별: 2레이어 Points — 밝기별 분리로 깊이감 ─────────────────
  _buildStars() {
    const addLayer = (count, size, color, opacity) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(1 - Math.random() * 0.9); // 상반구에 집중
        const r     = 850;
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 40;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity });
      const pts = new THREE.Points(geo, mat);
      this.scene.add(pts);
      this.objects.push(pts);
    };
    addLayer(1200, 1.6, 0xffffff, 0.90); // 보통 별
    addLayer(300,  2.8, 0xfff8e0, 1.00); // 밝은 별
    addLayer(80,   4.0, 0xffe8c0, 1.00); // 초밝은 별
  }

  // ── 스테이지별 지면 컬러 팔레트 ──────────────────────────────
  _groundPalette(id) {
    // [base, highlight, shadow, accent, accent2]
    const P = {
      1:  [0x52b34a, 0x6ecb5e, 0x3a7a2e, 0xd4a856, 0x8fcc70], // 공원: 잔디+흙길+밝은풀
      2:  [0x5abf4e, 0x7cd96a, 0x3a8232, 0xe8b86a, 0xffddaa], // 꽃밭: 밝은 초록+꽃밭 황토
      3:  [0x4aaa40, 0x62c456, 0x2e7428, 0xb8a060, 0x7acc60], // 잔디밭
      4:  [0x3a7a40, 0x4ea050, 0x1e4a28, 0x2a6696, 0x8ab060], // 연못: 수풀+수면
      5:  [0x2a5a35, 0x3a7a48, 0x162c1c, 0x1a4450, 0x4a8060], // 습지: 어두운 수렁
      6:  [0x557040, 0x6a8e52, 0x384828, 0x8b7040, 0x9aaa68], // 강가: 제방+모래
      7:  [0xd4c080, 0xeedd99, 0xa89050, 0x2266aa, 0xc8b070], // 바닷가: 모래+모래언덕
      8:  [0x0a3050, 0x1a5070, 0x051828, 0x0d4a7a, 0x1a6888], // 깊은바다: 어두운 해저
      9:  [0x2a6630, 0x3a8a42, 0x183820, 0x7a5a28, 0x5aaa50], // 열대우림: 짙은 정글
      10: [0xc4924a, 0xdaac60, 0x886430, 0x6a4a20, 0xffcc70], // 사바나: 황토+마른풀
      11: [0xd8e8f0, 0xf0f8ff, 0xa0b8c8, 0x7090a8, 0xffffff], // 설산: 흰 눈+얼음
      12: [0x1e5228, 0x286c36, 0x102a16, 0x4a3010, 0x3a7830], // 밀림: 어두운 정글
      13: [0x3a2010, 0x4e2c18, 0x1e0c08, 0x882200, 0x6a3018], // 화산: 검은 용암암석
      14: [0x4a3820, 0x60502e, 0x2a2010, 0x663318, 0x786040], // 공룡섬: 선사 암석
      15: [0x707888, 0x90a0b0, 0x404858, 0x303848, 0xb0c0d0], // 우주: 달 회색
    };
    return P[id] ?? P[1];
  }

  // ── 지면 — 스테이지별 다층 vertexColor (지형 + 고도 + 구역 반응) ─
  _buildGround(env) {
    const seg = 128; // 고해상도
    const geo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, seg, seg);
    const pos = geo.attributes.position;
    const id  = this.stage.id;
    const [cBase, cHigh, cShadow, cAccent, cAccent2] = this._groundPalette(id).map(h => new THREE.Color(h));

    const colArr = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i); // PlaneGeometry local Y = world -Z
      const wz = -ly;
      const d  = Math.sqrt(lx * lx + ly * ly);
      const h  = this.getHeight(lx, wz);
      pos.setZ(i, h);

      // 정규화 고도 (0~1)
      const hNorm = Math.max(0, Math.min(1, (h + 1) / (Math.max(1, 18 * this._scl) + 1)));
      // 중심~외곽 (0~1)
      const dNorm = Math.min(1, d / 200);

      let c;

      if (id <= 3) {
        // 공원: 밝은 잔디 → 그늘진 풀 / 흙길 (낮은 h) 포함
        const pathBlend = Math.max(0, 0.7 - Math.abs(lx) * 0.012) * Math.max(0, 1 - Math.abs(h) * 0.5);
        c = cBase.clone().lerp(cHigh, hNorm * 0.5);
        c.lerp(cAccent, pathBlend * 0.6); // 흙길 황토색
        c.lerp(cShadow, dNorm * 0.25);

      } else if (id <= 5) {
        // 연못/습지: 물 가장자리 어두운 수렁색, 높은 곳 풀
        const waterEdge = Math.max(0, 0.5 - d / 80) * 0.8;
        c = cBase.clone().lerp(cShadow, waterEdge);
        c.lerp(cHigh, hNorm * 0.6);

      } else if (id <= 6) {
        // 강가: 수변(낮은h) 모래+진흙, 높은 곳 제방 풀
        const mudBlend = Math.max(0, 1 - hNorm * 3) * 0.7;
        c = cBase.clone().lerp(cAccent, mudBlend);
        c.lerp(cHigh, hNorm * 0.5);

      } else if (id === 7) {
        // 바닷가: 해안선(낮은 곳) 흰 모래, 멀리 모래언덕 황토
        c = cBase.clone();
        c.lerp(cHigh,   Math.max(0, 1 - hNorm * 2.5) * 0.7); // 평지 → 밝은 모래
        c.lerp(cShadow, hNorm * 0.4);                         // 언덕 → 진한 모래
        c.lerp(cAccent, dNorm * 0.35);                        // 외곽 황토

      } else if (id === 8) {
        // 깊은 바다: 해저 다크블루, 산호 언덕 청록
        c = cBase.clone().lerp(cHigh, hNorm * 0.7);
        c.lerp(cAccent2, hNorm * hNorm * 0.5); // 높은 산호초 청록

      } else if (id === 9) {
        // 열대우림: 짙은 초록 + 강줄기 낮은 곳 갈색
        const streamBlend = Math.max(0, 1 - hNorm * 4) * Math.max(0, 0.8 - d / 120) * 0.6;
        c = cBase.clone().lerp(cHigh, hNorm * 0.4);
        c.lerp(cAccent, streamBlend); // 강줄기 갈색

      } else if (id === 10) {
        // 사바나: 황금빛 평원, 코피에 바위산 주변 암석색
        const kopje1d = Math.sqrt((lx + 90) * (lx + 90) + (ly - 70) * (ly - 70));
        const kopje2d = Math.sqrt((lx - 130) * (lx - 130) + (ly + 85) * (ly + 85));
        const rockBlend = Math.max(0, 1 - Math.min(kopje1d, kopje2d) / 25) * 0.75;
        c = cBase.clone().lerp(cHigh, Math.sin(lx * 0.04 + ly * 0.03) * 0.5 + 0.5);
        c.lerp(cShadow, rockBlend); // 암석 주변 어둡게
        c.lerp(cAccent2, hNorm * 0.3); // 언덕 정상 밝게

      } else if (id === 11) {
        // 설산: 흰 눈 (높은 곳), 낮은 곳 얼음 파랑
        c = cShadow.clone().lerp(cBase, hNorm * 0.8);
        c.lerp(cHigh, Math.max(0, hNorm - 0.5) * 2 * 0.9); // 고지대 순백
        // 빙하 계곡: 약간 파란빛
        const glacierBlend = Math.max(0, 0.5 - d / 80) * (1 - hNorm) * 0.5;
        c.lerp(new THREE.Color(0x8ab0d0), glacierBlend);

      } else if (id === 12) {
        // 밀림: 짙은 정글, 고도 따라 이끼 → 나무 뿌리
        c = cBase.clone().lerp(cShadow, (1 - hNorm) * 0.6);
        c.lerp(cAccent, Math.max(0, 1 - hNorm * 3) * 0.45); // 낮은 곳 뿌리 갈색
        c.lerp(cHigh, hNorm * 0.3);

      } else if (id === 13) {
        // 화산: 검은 용암 기반, 높이에 따라 적열(붉은 용암)
        c = cBase.clone();
        c.lerp(cAccent, hNorm * 0.7);       // 높은 곳 붉은 용암암
        c.lerp(new THREE.Color(0xff4400), Math.max(0, hNorm - 0.6) * 2 * 0.35); // 화산 정상 용암

      } else if (id === 14) {
        // 공룡섬: 선사 암석, 계곡 어두움, 꼭대기 밝은 암석
        c = cBase.clone().lerp(cHigh, hNorm * 0.5);
        c.lerp(cShadow, (1 - hNorm) * dNorm * 0.45);
        c.lerp(cAccent, Math.max(0, 0.4 - hNorm) * 0.5); // 협곡 저지대 적갈색

      } else {
        // 우주: 달 회색 + 크레이터 어두운 분지
        c = cBase.clone().lerp(cHigh, hNorm * 0.5);
        c.lerp(cShadow, Math.max(0, -h) * 0.3); // 크레이터 내부 어둡게
        // 충돌 메테오라이트 흔적 (랜덤 점)
        const meteorBlend = Math.max(0, Math.sin(lx * 0.18 + 2.1) * Math.cos(ly * 0.22 + 1.4) + 0.88) * 0.5;
        c.lerp(cAccent, meteorBlend * 0.4);
      }

      colArr[i * 3]     = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.computeVertexNormals();

    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: id === 7 ? 0.85 : id === 8 ? 0.6 : id === 15 ? 0.98 : 0.92,
      metalness: 0.00,
    }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.objects.push(ground);
  }

  // ── 공원 (1~3) ────────────────────────────────────────────────
  _buildPark() {
    const rng = this._rng;
    // 원경 실루엣 먼저 (깊이감)
    this._spawnDistantSilhouettes('park');
    // 영웅 랜드마크 — 중앙 고정 (맵 기준점)
    const fountain = this._spawnHeroFountain();
    // 나무: 분수 주변 링 + 외곽 포아송
    const ringTrees = ringSpawn(fountain.x, fountain.z, 55, 18, 0.25, rng);
    const outerTrees = poissonSpawn(160, MAP_HALF * 0.86, 8, rng);
    this._spawnTrees(0, 0, 'oak', [...ringTrees, ...outerTrees]);
    // 꽃: 분수 가까운 곳에 클러스터
    this._spawnAllFlowers(MAP_HALF * 0.82);
    // 바위: 외곽 클러스터
    this._spawnRockClusters(28, MAP_HALF * 0.78);
    this._spawnBenches(20);
    this._spawnLampPosts(22);
    this._spawnPath();
    this._spawnGazebos(4);
    this._spawnParkGate();
    this._spawnPlayground();
    this._spawnPicnicTables(15);
    this._spawnTrashCans(20);
    this._spawnHedgeRows(12);
    this._spawnFlowerBeds(10);
    this._spawnBandstand();
    this._spawnStatues(6);
    this._spawnCafeeStall(3);
    this._spawnSignPosts(14);
    this._spawnParkWalls(8);
    // 추가 오브젝트: 풍선 묶음, 아이스크림 카트, 공원 시계탑, 그네, 연못 분수
    this._spawnBalloonClusters(8);
    this._spawnIceCreamCarts(4);
    this._spawnParkClock();
    this._spawnSwingSets(5);
    this._spawnColorfulKiosks(6);
    this._spawnDogWaterBowls(10);
    this._spawnParkBikes(8);
    // ── 의도적 장면 클러스터 (AAA 환경 디자인) ──────────────
    this._spawnParkSceneClusters();
    // ── 대기 꽃가루 파티클 ─────────────────────────────────
    this._buildAtmosphereParticles({ count: 280, spread: 100, maxY: 7, color: 0xfffde8, size: 0.055 });
    // ── 가로등 포인트 조명 (플레이 구역 안 최대 8개) ──────────
    this._buildLampLights(8);
  }

  // ── 연못 (4~5) ────────────────────────────────────────────────
  _buildPond() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('pond');
    // 나무: 연못 가장자리에 클러스터 집중
    const pondTreePts = clusterSpawn(10, 14, MAP_HALF * 0.82, 35, rng);
    this._spawnTrees(0, 0, 'oak', pondTreePts);
    this._spawnAllFlowers(MAP_HALF * 0.80);
    this._spawnRockClusters(30, MAP_HALF * 0.8);
    this._spawnBenches(12);
    this._spawnLampPosts(10);
    this._spawnFountain();
    this._spawnPath();
    this._spawnFishingHuts(6);
    this._spawnWaterfalls(4);
    this._spawnSteppingStones(5);
    this._spawnBoatHouses(3);
    this._spawnReedBeds(15);
    this._spawnWaterMill();
    this._spawnDuckSigns(8);
    this._spawnPicnicTables(10);
    this._spawnLanterns(16);
    // 연못
    for (let p = 0; p < 4; p++) {
      const r  = 22 + this._rng() * 35;
      const px = (this._rng() - 0.5) * 500;
      const pz = (this._rng() - 0.5) * 500;
      const pond = new THREE.Mesh(
        new THREE.CircleGeometry(r, 28),
        new THREE.MeshLambertMaterial({ color: 0x1a6696, transparent: true, opacity: 0.85 })
      );
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(px, this.getHeight(px, pz) + 0.05, pz);
      this.scene.add(pond);
      this.objects.push(pond);
      // 수련
      this._spawnLilyPads(r, px, pz);
      // 갈대
      this._spawnCattails(10, r, px, pz);
    }
    // 나무다리
    this._spawnWoodenBridge();
  }

  // ── 해양 (6~8) ────────────────────────────────────────────────
  _buildOcean() {
    this._spawnDistantSilhouettes('ocean');
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0x0d5e9e, transparent: true, opacity: 0.88 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0.08;
    this.scene.add(sea);
    this.objects.push(sea);
    // 영웅 랜드마크 — 등대 고정 (원경 앵커)
    this._spawnHeroLighthouse(180, -180);
    this._spawnRockClusters(80, MAP_HALF * 0.88, 2, 6, 0x7a6655);
    this._spawnCoral(80);
    this._spawnShells(60);
    this._spawnCliffs();
    this._spawnLighthouse();
    this._spawnShipwrecks(4);
    this._spawnSeaweedForest(40);
    this._spawnAnchors(8);
    this._spawnBeachHuts(8);
    this._spawnLifePreservers(12);
    this._spawnPiers(3);
    this._spawnDriftwood(25);
    this._spawnTidePools(10);
    this._spawnSeaStacks(12);
  }

  // ── 강가 (6) ──────────────────────────────────────────────────
  _buildRiver() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('pond');
    // 구불구불 강 — 중심 X축 기준 폭 60m 띠
    const riverMat = new THREE.MeshLambertMaterial({ color: 0x1a6080, transparent: true, opacity: 0.82 });
    for (let seg = -8; seg <= 8; seg++) {
      const sz = seg * 60;
      const ox = Math.sin(sz * 0.012) * 40;   // 구불구불
      const rw = new THREE.Mesh(new THREE.PlaneGeometry(60 + rng() * 20, 65), riverMat);
      rw.rotation.x = -Math.PI / 2;
      rw.position.set(ox, 0.12, sz);
      this.scene.add(rw); this.objects.push(rw);
    }
    // 강둑 나무 양쪽
    const bankL = poissonSpawn(80, MAP_HALF * 0.82, 7, rng).map(p => ({ x: p.x - 55, z: p.z }));
    const bankR = poissonSpawn(80, MAP_HALF * 0.82, 7, rng).map(p => ({ x: p.x + 55, z: p.z }));
    this._spawnTrees(0, 0, 'oak', [...bankL, ...bankR]);
    this._spawnRockClusters(40, MAP_HALF * 0.80, 0.8, 3.5, 0x6a7055);
    this._spawnAllFlowers(MAP_HALF * 0.78);
    this._spawnReedBeds(20);
    this._spawnFishingHuts(8);
    this._spawnWaterfalls(3);
    this._spawnSteppingStones(8);
    this._spawnWoodenBridge();
    this._spawnDriftwood(20);
    this._spawnLanterns(12);
    this._spawnPicnicTables(10);
    // 강 모래톱 (모래 패치)
    for (let i = 0; i < 8; i++) {
      const bx = (rng() - 0.5) * 80, bz = (rng() - 0.5) * 200;
      const bar = new THREE.Mesh(
        new THREE.CircleGeometry(8 + rng() * 12, 12),
        new THREE.MeshLambertMaterial({ color: 0xd4b870, transparent: true, opacity: 0.9 })
      );
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(bx, 0.14, bz);
      this.scene.add(bar); this.objects.push(bar);
    }
    this._buildAtmosphereParticles({ count: 150, spread: 90, maxY: 5, color: 0xddeeff, size: 0.045 });
  }

  // ── 바닷가 (7) ────────────────────────────────────────────────
  _buildBeach() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('ocean');
    // 바다: 중심에서 먼 쪽(외곽)을 바다로
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 2, 2),
      new THREE.MeshLambertMaterial({ color: 0x1a88cc, transparent: true, opacity: 0.90 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.06, -300);   // 한쪽으로 치우쳐 해안선 형성
    this.scene.add(sea); this.objects.push(sea);
    // 파도선 (하얀 물거품)
    for (let i = 0; i < 5; i++) {
      const wave = new THREE.Mesh(
        new THREE.PlaneGeometry(MAP_HALF * 2, 4, 1, 1),
        new THREE.MeshLambertMaterial({ color: 0xeeffff, transparent: true, opacity: 0.7 - i * 0.1 })
      );
      wave.rotation.x = -Math.PI / 2;
      wave.position.set(0, 0.10, -180 - i * 18);
      this.scene.add(wave); this.objects.push(wave);
    }
    this._spawnHeroLighthouse(220, -220);
    this._spawnRockClusters(50, MAP_HALF * 0.85, 1.5, 6, 0x8a8070);
    this._spawnCoral(50);
    this._spawnShells(80);
    this._spawnCliffs();
    this._spawnBeachHuts(10);
    this._spawnLifePreservers(14);
    this._spawnPiers(4);
    this._spawnDriftwood(30);
    this._spawnTidePools(12);
    this._spawnSeaStacks(8);
    this._spawnAnchors(6);
    // 야자나무 (해변 특유)
    const palmPts = clusterSpawn(5, 8, 120, 50, rng);
    this._spawnTrees(0, 0, 'palm', palmPts);
    this._buildAtmosphereParticles({ count: 120, spread: 120, maxY: 8, color: 0xffeedd, size: 0.05 });
  }

  // ── 열대우림 (9) ──────────────────────────────────────────────
  _buildJungle() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('forest');
    // 정글 강 (중심 북동쪽)
    const riverMat = new THREE.MeshLambertMaterial({ color: 0x1a4a30, transparent: true, opacity: 0.80 });
    for (let seg = -6; seg <= 6; seg++) {
      const sz = seg * 65 + 30;
      const ox = Math.sin(sz * 0.010 + 1.3) * 55;
      const rv = new THREE.Mesh(new THREE.PlaneGeometry(45 + rng() * 15, 70), riverMat);
      rv.rotation.x = -Math.PI / 2;
      rv.position.set(ox, 0.10, sz);
      this.scene.add(rv); this.objects.push(rv);
    }
    // 열대 나무 — 야자+오크 혼합
    const junglePts = clusterSpawn(18, 14, MAP_HALF * 0.88, 38, rng)
      .filter(p => Math.hypot(p.x, p.z) > 32);
    const palmPts = clusterSpawn(8, 6, MAP_HALF * 0.75, 45, rng);
    this._spawnTrees(0, 0, 'oak',  junglePts);
    this._spawnTrees(0, 0, 'palm', palmPts);
    this._spawnRockClusters(60, MAP_HALF * 0.85, 1, 4, 0x446655);
    this._spawnMushrooms(50);
    this._spawnFallenLogs(30);
    this._spawnMossRocks(45);
    this._spawnAllFlowers(MAP_HALF * 0.80, true);
    this._spawnGiantFerns(60);
    this._spawnForestShrine(3);
    this._spawnVineBridges(4);
    this._spawnFirePits(6);
    this._spawnHangingLanterns(18);
    this._spawnReedBeds(12);
    this._spawnCattails(15, 30, 0, 60);
    // 정글 폭포
    this._spawnWaterfalls(5);
    // 짙은 정글 대기 (열기와 안개)
    this._buildAtmosphereParticles({ count: 350, spread: 120, maxY: 18, color: 0x88ff88, size: 0.065 });
  }

  // ── 설산 (11) ─────────────────────────────────────────────────
  _buildSnowMtn() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('forest');
    // 빙하 (중심 계곡)
    const iceMat = new THREE.MeshLambertMaterial({ color: 0x99ccee, transparent: true, opacity: 0.75 });
    for (let seg = -4; seg <= 4; seg++) {
      const sz = seg * 70;
      const ox = Math.sin(sz * 0.008 + 0.5) * 30;
      const ice = new THREE.Mesh(new THREE.PlaneGeometry(55 + rng() * 20, 75), iceMat);
      ice.rotation.x = -Math.PI / 2;
      ice.position.set(ox, 0.15, sz);
      this.scene.add(ice); this.objects.push(ice);
    }
    // 침엽수 (낮은 고도에만)
    const pineBase = poissonSpawn(90, MAP_HALF * 0.82, 9, rng)
      .filter(p => {
        const h = this.getHeight(p.x, p.z);
        return h < 6; // 낮은 지역에만 나무
      });
    this._spawnTrees(0, 0, 'pine', pineBase);
    this._spawnRockClusters(70, MAP_HALF * 0.85, 1.5, 6, 0x9aafbb);
    this._spawnMossRocks(40);
    this._spawnFallenLogs(25);
    // 눈 쌓인 바위
    this._spawnSnowCapRocks(50);
    this._buildSnow();   // 눈 파티클
    // 아이스 크리스탈 (장식)
    this._spawnIceCrystals(30);
    this._buildAtmosphereParticles({ count: 200, spread: 120, maxY: 20, color: 0xeef8ff, size: 0.060 });
  }

  // ── 내부 전용: 눈 덮인 바위 ──────────────────────────────────
  _spawnSnowCapRocks(count) {
    const rng = this._rng;
    const mat = new THREE.MeshLambertMaterial({ color: 0x889aaa });
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xf4f8ff });
    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * MAP_HALF * 1.6;
      const z = (rng() - 0.5) * MAP_HALF * 1.6;
      const y = this.getHeight(x, z);
      const r = 1.2 + rng() * 2.5;
      const rock = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mat.clone());
      rock.scale.set(1, 0.6 + rng() * 0.5, 1);
      rock.position.set(x, y + r * 0.4, z);
      this.scene.add(rock); this.objects.push(rock);
      // 눈 캡
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 6, 4), snowMat.clone());
      cap.position.set(x, y + r * 0.8, z);
      cap.scale.set(1, 0.3, 1);
      this.scene.add(cap); this.objects.push(cap);
    }
  }

  // ── 내부 전용: 빙하 크리스탈 ─────────────────────────────────
  _spawnIceCrystals(count) {
    const rng = this._rng;
    const mat = new THREE.MeshLambertMaterial({ color: 0xaaddff, transparent: true, opacity: 0.75 });
    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * MAP_HALF * 1.4;
      const z = (rng() - 0.5) * MAP_HALF * 1.4;
      const y = this.getHeight(x, z);
      const h = 1.5 + rng() * 3.5;
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.4 + rng() * 0.4, h, 5), mat.clone());
      crystal.position.set(x, y + h * 0.5, z);
      crystal.rotation.y = rng() * Math.PI * 2;
      crystal.rotation.z = (rng() - 0.5) * 0.3;
      this.scene.add(crystal); this.objects.push(crystal);
    }
  }

  // ── 사바나 (10) ───────────────────────────────────────────────
  _buildSavanna() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('savanna');
    const savFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xcc9944 })
    );
    savFloor.rotation.x = -Math.PI / 2;
    savFloor.position.y = 0.02;
    this.scene.add(savFloor); this.objects.push(savFloor);
    // 영웅 아카시아 — 북쪽에 고정 (맵 나침반 역할)
    const heroTree = this._spawnHeroAcacia(0, -200);
    // 물웅덩이 — 동쪽 고정 (생물 집결지 랜드마크)
    this._spawnWaterHole();
    // 아카시아: 물웅덩이 주변 클러스터 + 전체 포아송
    const waterTreePts  = clusterSpawn(6, 8, 100, 40, rng);
    const outerAcaciaPts = poissonSpawn(75, MAP_HALF * 0.88, 12, rng);
    this._spawnTrees(0, 0, 'acacia', [...waterTreePts, ...outerAcaciaPts]);
    this._spawnRockClusters(60, MAP_HALF * 0.85, 1.5, 5, 0x998855);
    this._spawnTermiteMounds(25);
    this._spawnDryGrass(500, MAP_HALF * 0.85);
    this._spawnAfricanHuts(8);
    this._spawnBaobabTrees(12);
    this._spawnAnimalSkulls(20);
    this._spawnSafariJeepWrecks(3);
    this._spawnRockArt(10);
    this._spawnKraalFence(4);
    this._spawnDustDevils(6);
    this._spawnSavannaGrass(200, MAP_HALF * 0.85);
  }

  // ── 숲 (11~12) ────────────────────────────────────────────────
  _buildForest() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('forest');
    // 영웅 고대 거목 — 맵 정중앙 (신성한 중심)
    this._spawnAncientPine(0, 0);
    // 소나무: 중앙 클리어링 제외하고 빽빽하게 클러스터 배치
    const forestClusters = clusterSpawn(16, 16, MAP_HALF * 0.88, 40, rng);
    // 스폰 중심(반지름 35) 제외
    const filteredPts = forestClusters.filter(p => Math.hypot(p.x, p.z) > 35);
    this._spawnTrees(0, 0, 'pine', filteredPts);
    this._spawnRockClusters(80, MAP_HALF * 0.85, 1, 4, 0x556655);
    this._spawnMushrooms(65);
    this._spawnFallenLogs(35);
    this._spawnMossRocks(50);
    this._spawnAllFlowers(MAP_HALF * 0.82, true);
    this._spawnLogCabin();
    this._spawnForestShrine(3);
    this._spawnTreeHouses(4);
    this._spawnVineBridges(3);
    this._spawnAbandonedWell(4);
    this._spawnFirePits(8);
    this._spawnMushroomRings(6);
    this._spawnTreeHollows(12);
    this._spawnForestSigns(10);
    this._spawnHangingLanterns(20);
    // 숲 대기 파티클 — 반짝이는 포자·반딧불
    this._buildAtmosphereParticles({ count: 300, spread: 110, maxY: 14, color: 0xaabb44, size: 0.068 });
  }

  // ── 공룡섬 (13~14) ────────────────────────────────────────────
  _buildDinoIsland() {
    const rng = this._rng;
    this._spawnDistantSilhouettes('dino');
    // 야자나무: 화산 사이 클러스터
    const palmPts = clusterSpawn(8, 8, MAP_HALF * 0.82, 45, rng);
    this._spawnTrees(0, 0, 'palm', palmPts);
    // 화산 3개 — 주요 랜드마크로 등록
    for (let v = 0; v < 3; v++) {
      const vx = (v - 1) * 280 + (rng() - 0.5) * 60;
      const vz = (rng() - 0.5) * 350;
      this._spawnVolcano(vx, vz);
      this._zones.landmarks.push({ x: vx, z: vz });
    }
    this._spawnRockClusters(100, MAP_HALF * 0.88, 3, 10, 0x443322);
    this._spawnDinoFootprints(60);
    this._spawnFossils(25);
    this._spawnGiantFerns(55);
    this._spawnDinoBones(30);
    this._spawnDinoEggsNests(15);
    this._spawnPrehistoricTemple();
    this._spawnLavaPools(8);
    this._spawnCaveEntrances(5);
    this._spawnTarPits(6);
    this._spawnStoneCircles(4);
    this._spawnPrehistoricTrees(30);
    this._spawnDinoSkeleton(5);
    // 화산 잔불 파티클 — 상승하는 불씨
    this._buildAtmosphereParticles({ count: 240, spread: 115, maxY: 20, color: 0xff5511, size: 0.060 });
  }

  // ── 우주 (15) ─────────────────────────────────────────────────
  _buildSpace() {
    this.scene.background = new THREE.Color(0x000011);
    this.scene.fog = null;
    this._spawnDistantSilhouettes('space');
    this._buildStarField();
    this._spawnPlanets();
    this._spawnCraters(35);
    this._spawnAlienStructures(14);
    this._spawnSpaceDebris(40);
    this._spawnSpaceStation();
    this._spawnCrashedSpaceship(3);
    this._spawnMoonRover(2);
    this._spawnSatelliteDishes(8);
    this._spawnAlienCropCircles(6);
    this._spawnSpaceCrates(20);
    this._spawnCommunicationTower(4);
    this._spawnMeteorField(15);
    this._spawnNebulaClouds(8);
  }

  // ════════════════════════════════════════════════════════════════
  // ── 나무 ─────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnTrees(count, spread, type, pts) {
    const rng = this._rng;
    const dummy = new THREE.Object3D();
    // pts가 없으면 포아송 디스크 배치 (균일 배치 제거)
    const positions = pts || poissonSpawn(count, spread, 6, rng);
    const n = positions.length;
    // 충돌 콜라이더 등록 (나무 반경 0.6m)
    for (const p of positions) {
      this._obstacles.push({ x: p.x, z: p.z, r: 0.6 });
      this._structures.push({ x: p.x, z: p.z, r: 2.0 }); // 미니맵 표시용
    }

    if (type === 'oak') {
      const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3.5, 7);
      const leafGeo  = new THREE.SphereGeometry(2.6, 8, 6);
      const leaf2Geo = new THREE.SphereGeometry(1.8, 7, 5);
      const tMat  = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
      const lMat  = new THREE.MeshLambertMaterial({ color: 0x2d7a2d, flatShading: true });
      const l2Mat = new THREE.MeshLambertMaterial({ color: 0x3a8c3a, flatShading: true });
      const tI = new THREE.InstancedMesh(trunkGeo, tMat, n);
      const lI = new THREE.InstancedMesh(leafGeo, lMat, n);
      const l2I = new THREE.InstancedMesh(leaf2Geo, l2Mat, n);
      tI.castShadow = lI.castShadow = true;
      for (let i = 0; i < n; i++) {
        const { x, z } = positions[i];
        const y  = this.getHeight(x, z);
        const s  = 0.7 + rng() * 1.4;
        const sy = s * (0.85 + rng() * 0.3); // Y 독립 변형 — 키 다양화
        dummy.position.set(x, y + 1.75 * sy, z); dummy.scale.set(s, sy, s); dummy.rotation.y = rng() * 6.28; dummy.rotation.x = (rng()-0.5)*0.06; dummy.updateMatrix(); tI.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 4.8 * sy, z); dummy.scale.set(s, s, s); dummy.rotation.x = 0; dummy.updateMatrix(); lI.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 6.2 * sy, z); dummy.scale.setScalar(s * 0.75); dummy.updateMatrix(); l2I.setMatrixAt(i, dummy.matrix);
        // 색상 변형 (명도 ±10%)
        if (lI.instanceColor) {
          const c = new THREE.Color(0x2d7a2d).offsetHSL(0, (rng()-0.5)*0.08, (rng()-0.5)*0.1);
          lI.setColorAt(i, c);
          l2I.setColorAt(i, c.clone().offsetHSL(0, 0, 0.04));
        }
      }
      tI.instanceMatrix.needsUpdate = lI.instanceMatrix.needsUpdate = l2I.instanceMatrix.needsUpdate = true;
      if (lI.instanceColor)  lI.instanceColor.needsUpdate  = true;
      if (l2I.instanceColor) l2I.instanceColor.needsUpdate = true;
      this.scene.add(tI, lI, l2I);
      this.objects.push(tI, lI, l2I);

    } else if (type === 'pine') {
      const tMat = new THREE.MeshLambertMaterial({ color: 0x3d2b1f });
      const lMat = new THREE.MeshLambertMaterial({ color: 0x1a5c1a, flatShading: true });
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 4, 6);
      const cone1 = new THREE.ConeGeometry(2.4, 3.5, 7);
      const cone2 = new THREE.ConeGeometry(1.9, 3.0, 7);
      const cone3 = new THREE.ConeGeometry(1.3, 2.5, 7);
      const tI  = new THREE.InstancedMesh(trunkGeo, tMat, n);
      const c1I = new THREE.InstancedMesh(cone1, lMat, n);
      const c2I = new THREE.InstancedMesh(cone2, lMat, n);
      const c3I = new THREE.InstancedMesh(cone3, lMat, n);
      tI.castShadow = c1I.castShadow = true;
      for (let i = 0; i < n; i++) {
        const { x, z } = positions[i];
        const y = this.getHeight(x, z);
        const s  = 0.6 + rng() * 1.2;
        const sy = s * (0.9 + rng() * 0.35);
        dummy.rotation.x = (rng()-0.5)*0.07;
        dummy.position.set(x, y + 2 * sy, z); dummy.scale.set(s, sy, s); dummy.rotation.y = rng() * 6.28; dummy.updateMatrix(); tI.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 2.5 * sy, z); dummy.scale.setScalar(s); dummy.rotation.x = 0; dummy.updateMatrix(); c1I.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 4.5 * sy, z); dummy.scale.setScalar(s * 0.82); dummy.updateMatrix(); c2I.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 6.2 * sy, z); dummy.scale.setScalar(s * 0.62); dummy.updateMatrix(); c3I.setMatrixAt(i, dummy.matrix);
        if (c1I.instanceColor) {
          const c = new THREE.Color(0x1a5c1a).offsetHSL(0, (rng()-0.5)*0.06, (rng()-0.5)*0.12);
          c1I.setColorAt(i, c); c2I.setColorAt(i, c); c3I.setColorAt(i, c);
        }
      }
      [tI, c1I, c2I, c3I].forEach(m => {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        this.scene.add(m); this.objects.push(m);
      });

    } else if (type === 'acacia') {
      const tMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
      const lMat = new THREE.MeshLambertMaterial({ color: 0x6b8e23, flatShading: true });
      const trunkGeo  = new THREE.CylinderGeometry(0.15, 0.28, 4, 6);
      const canopyGeo = new THREE.CylinderGeometry(4.0, 3.5, 0.85, 9);
      const tI = new THREE.InstancedMesh(trunkGeo, tMat, n);
      const cI = new THREE.InstancedMesh(canopyGeo, lMat, n);
      tI.castShadow = cI.castShadow = true;
      for (let i = 0; i < n; i++) {
        const { x, z } = positions[i];
        const y = this.getHeight(x, z);
        const s  = 0.8 + rng() * 1.2;
        const sy = s * (0.8 + rng() * 0.4);
        // 아카시아 줄기 약간 기울기 — 사바나 느낌
        dummy.rotation.z = (rng()-0.5) * 0.12;
        dummy.position.set(x, y + 2 * sy, z); dummy.scale.set(s, sy, s); dummy.rotation.y = rng() * 6.28; dummy.updateMatrix(); tI.setMatrixAt(i, dummy.matrix);
        dummy.rotation.z = 0;
        dummy.position.set(x, y + 5.5 * sy, z); dummy.scale.set(s * (1 + rng()*0.3), s * 0.4, s * (1 + rng()*0.3)); dummy.updateMatrix(); cI.setMatrixAt(i, dummy.matrix);
        if (cI.instanceColor) {
          const c = new THREE.Color(0x6b8e23).offsetHSL(0, (rng()-0.5)*0.1, (rng()-0.5)*0.12);
          cI.setColorAt(i, c);
        }
      }
      tI.instanceMatrix.needsUpdate = cI.instanceMatrix.needsUpdate = true;
      if (cI.instanceColor) cI.instanceColor.needsUpdate = true;
      this.scene.add(tI, cI); this.objects.push(tI, cI);

    } else if (type === 'palm') {
      const tMat = new THREE.MeshLambertMaterial({ color: 0xa07850 });
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 6, 7);
      const tI = new THREE.InstancedMesh(trunkGeo, tMat, n);
      tI.castShadow = true;
      for (let i = 0; i < n; i++) {
        const { x, z } = positions[i];
        const y = this.getHeight(x, z);
        const s = 0.8 + rng() * 1.0;
        dummy.position.set(x, y + 3 * s, z); dummy.scale.set(s, s, s); dummy.rotation.y = rng() * 6.28; dummy.rotation.z = (rng()-0.5) * 0.3; dummy.updateMatrix(); tI.setMatrixAt(i, dummy.matrix);
        const leavesGroup = this._makePalmLeaves();
        leavesGroup.position.set(x, y + 6 * s, z);
        leavesGroup.scale.setScalar(s);
        this.scene.add(leavesGroup);
        this.objects.push(leavesGroup);
      }
      tI.instanceMatrix.needsUpdate = true;
      this.scene.add(tI); this.objects.push(tI);
    }
  }

  _makePalmLeaves() {
    const g = new THREE.Group();
    const lMat = new THREE.MeshLambertMaterial({ color: 0x3a7a1a, flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3.5), lMat.clone());
      leaf.position.set(Math.cos(angle) * 0.5, 0.2, Math.sin(angle) * 0.5);
      leaf.rotation.y = angle;
      leaf.rotation.z = 0.6;
      g.add(leaf);
    }
    return g;
  }

  // ════════════════════════════════════════════════════════════════
  // ── 꽃 12종 ──────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnAllFlowers(spread, darkMode = false) {
    const types = [
      // [stemH, stemR, headType, headSize, headColor, stemColor, count]
      // 1. 민들레 – 둥근 흰 솜
      [0.38, 0.025, 'sphere', 0.13, 0xfffacd, 0x44aa44, 22],
      // 2. 튤립 – 컵 모양
      [0.65, 0.038, 'tulip', 0.14, darkMode ? 0xcc2266 : 0xff4488, 0x3a9a3a, 20],
      // 3. 해바라기 – 큰 원반
      [0.95, 0.05,  'disc',  0.22, 0xffcc00, 0x2a7a2a, 15],
      // 4. 데이지 – 흰 평면꽃
      [0.44, 0.028, 'daisy', 0.16, 0xffffff, 0x44aa44, 22],
      // 5. 양귀비 – 얇은 꽃잎
      [0.55, 0.03,  'poppy', 0.13, darkMode ? 0xbb2200 : 0xff2200, 0x3a8844, 18],
      // 6. 장미 – 겹꽃
      [0.72, 0.04,  'rose',  0.15, darkMode ? 0x991133 : 0xee1144, 0x2a7734, 16],
      // 7. 라벤더 – 이삭 모양
      [0.7,  0.025, 'spike', 0.09, 0x9966cc, 0x5a9a5a, 24],
      // 8. 백합 – 나팔 모양
      [0.82, 0.042, 'lily',  0.17, darkMode ? 0xff8844 : 0xffaa44, 0x2a8a2a, 14],
      // 9. 미나리아재비 – 작은 노란꽃
      [0.35, 0.022, 'sphere', 0.1, 0xffee00, 0x44aa44, 28],
      // 10. 토끼풀 – 작은 흰공
      [0.3,  0.02,  'sphere', 0.1, 0xffffff, 0x44bb44, 30],
      // 11. 초롱꽃 – 매달린 종
      [0.58, 0.028, 'bell',  0.11, darkMode ? 0x4444cc : 0x6688ff, 0x3a9944, 20],
      // 12. 벚꽃 – 분홍 군집
      [0.45, 0.032, 'cluster', 0.18, 0xffaabb, 0x8a4a4a, 18],
    ];
    types.forEach(([sh, sr, ht, hs, hc, sc, cnt]) => {
      this._spawnFlowerType(cnt, spread, sh, sr, sc, ht, hs, hc);
    });
  }

  _spawnFlowerType(count, spread, stemH, stemR, stemColor, headType, headSize, headColor) {
    const rng   = this._rng;
    const stemGeo = new THREE.CylinderGeometry(stemR * 0.6, stemR, stemH, 4);
    const headGeo = this._makeFlowerHeadGeo(headType, headSize);
    const stemMat = new THREE.MeshLambertMaterial({ color: stemColor });
    const headMat = new THREE.MeshLambertMaterial({ color: headColor, flatShading: true });
    const dummy   = new THREE.Object3D();
    const sI = new THREE.InstancedMesh(stemGeo, stemMat, count);
    const hI = new THREE.InstancedMesh(headGeo, headMat, count);
    // 꽃: 클러스터 배치 — 꽃밭 느낌
    const pts = clusterSpawn(Math.ceil(count / 5), 5, spread, 20, rng);

    for (let i = 0; i < count; i++) {
      const { x, z } = pts[i % pts.length];
      const jx = x + (rng()-0.5)*6, jz = z + (rng()-0.5)*6;
      const y  = this.getHeight(jx, jz);
      const s  = 0.65 + rng() * 0.7;
      dummy.position.set(jx, y + stemH * s * 0.5, jz);
      dummy.scale.setScalar(s);
      dummy.rotation.y = rng() * 6.28;
      dummy.rotation.z = (rng()-0.5) * 0.1;
      dummy.updateMatrix();
      sI.setMatrixAt(i, dummy.matrix);

      dummy.position.set(jx, y + stemH * s + headSize * 0.5, jz);
      dummy.scale.setScalar(s);
      dummy.rotation.y = rng() * 6.28;
      dummy.rotation.z = 0;
      dummy.updateMatrix();
      hI.setMatrixAt(i, dummy.matrix);

      if (hI.instanceColor) {
        hI.setColorAt(i, new THREE.Color(headColor).offsetHSL(0, (rng()-0.5)*0.1, (rng()-0.5)*0.15));
      }
    }
    sI.instanceMatrix.needsUpdate = true;
    hI.instanceMatrix.needsUpdate = true;
    if (hI.instanceColor) hI.instanceColor.needsUpdate = true;
    this.scene.add(sI, hI);
    this.objects.push(sI, hI);
  }

  _makeFlowerHeadGeo(type, size) {
    switch (type) {
      case 'sphere':  return new THREE.SphereGeometry(size, 7, 6);
      case 'tulip':   return new THREE.CylinderGeometry(size * 0.6, size * 0.3, size * 1.6, 6, 1, true);
      case 'disc':    return new THREE.CylinderGeometry(size, size * 0.8, size * 0.35, 10);
      case 'daisy':   return new THREE.CylinderGeometry(size, size, size * 0.2, 10);
      case 'poppy':   return new THREE.SphereGeometry(size, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.55);
      case 'rose':    return new THREE.SphereGeometry(size, 8, 7);
      case 'spike':   return new THREE.ConeGeometry(size * 0.5, size * 2.5, 5);
      case 'lily':    return new THREE.CylinderGeometry(size, size * 0.3, size * 1.4, 6, 1, true);
      case 'bell':    return new THREE.CylinderGeometry(size * 0.3, size, size * 1.2, 6, 1, true);
      case 'cluster': return new THREE.SphereGeometry(size, 6, 5);
      default:        return new THREE.SphereGeometry(size, 6, 5);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 바위 클러스터 ────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  // 바위 클러스터 — InstancedMesh (2 크기×2 LOD = 4 draw call로 모두 처리)
  _spawnRockClusters(clusters, spread, minR = 0.8, maxR = 3.5, color = 0x778877) {
    const rng = this._rng;
    const totalRocks = clusters * 3; // 클러스터당 평균 3개
    const dummy = new THREE.Object3D();
    const geo  = new THREE.DodecahedronGeometry(1, 0); // 반지름 1 — scale로 크기 제어
    const mat  = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const inst = new THREE.InstancedMesh(geo, mat, totalRocks);
    inst.castShadow = true;
    let idx = 0;
    for (let c = 0; c < clusters; c++) {
      const cx = (rng() - 0.5) * spread * 2;
      const cz = (rng() - 0.5) * spread * 2;
      const n  = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < n && idx < totalRocks; i++, idx++) {
        const r  = minR + rng() * (maxR - minR);
        const ox = (rng() - 0.5) * 4.5;
        const oz = (rng() - 0.5) * 4.5;
        const rx = cx + ox, rz = cz + oz;
        const ry = this.getHeight(rx, rz);
        dummy.position.set(rx, ry + r * 0.52, rz);
        // 큰 바위만 충돌 콜라이더 등록 (r > 1.2m)
        if (r > 1.2) this._obstacles.push({ x: rx, z: rz, r: r * 0.75 });
        dummy.scale.set(r * (0.9 + rng()*0.2), r * (0.7 + rng()*0.35), r * (0.9 + rng()*0.2));
        dummy.rotation.set(rng() * 3.14, rng() * 6.28, rng() * 3.14);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
        // 색상 미세 변형 (명도 ±8%)
        if (inst.instanceColor) {
          inst.setColorAt(idx, new THREE.Color(color).offsetHSL(0, (rng()-0.5)*0.06, (rng()-0.5)*0.08));
        }
      }
    }
    inst.count = idx; // 실제 사용 수로 제한
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
    this.objects.push(inst);
  }

  // ════════════════════════════════════════════════════════════════
  // ── 공원 전용 소품 ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  /**
   * 벤치 1개를 (bx, bz)에 생성하고 (lookX, lookZ)를 향하게 회전
   */
  _spawnOneBench(bx, bz, lookX = 0, lookZ = 0) {
    const y = this.getHeight(bx, bz);
    const g = new THREE.Group();
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    const metMat  = new THREE.MeshLambertMaterial({ color: 0x505060 });
    // 좌석 판자 (3장 — 더 자연스러운 나무 질감)
    for (let pi = 0; pi < 3; pi++) {
      g.add(this._box(2.0, 0.06, 0.16, seatMat, 0, 0.68 + pi * 0.0, 0.16 - pi * 0.18));
    }
    // 등받이 판자
    for (let pi = 0; pi < 2; pi++) {
      g.add(this._box(2.0, 0.06, 0.12, seatMat, 0, 0.90 + pi * 0.14, 0.26));
    }
    // 금속 다리 2쌍
    for (const lx of [-0.80, 0.80]) {
      const leg = new THREE.Group();
      leg.add(this._box(0.07, 0.65, 0.42, metMat, 0, 0.33, 0));
      leg.add(this._box(0.07, 0.55, 0.08, metMat, 0, 0.82, 0.24)); // 등받이 지지
      leg.position.x = lx;
      g.add(leg);
    }
    // 벤치 끝 팔걸이
    for (const lx of [-0.98, 0.98]) {
      g.add(this._box(0.08, 0.06, 0.32, seatMat, lx, 0.72, 0.05));
    }
    g.position.set(bx, y, bz);
    // 시선 방향으로 회전 (앉는 쪽이 lookAt 방향)
    const angle = Math.atan2(lookX - bx, lookZ - bz);
    g.rotation.y = angle;
    this.scene.add(g);
    this.objects.push(g);
    this._structures.push({ x: bx, z: bz, r: 1.2 });
    this._obstacles.push({ x: bx, z: bz, r: 1.1 }); // 벤치 충돌 콜라이더
    return g;
  }

  _spawnBenches(count) {
    // 랜덤 배치 대신: 분수(0,0) 방향 또는 가까운 트리 방향을 바라보도록 배치
    for (let i = 0; i < count; i++) {
      const angle = (this._rng() * Math.PI * 2);
      const dist  = 18 + this._rng() * 70;
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;
      // 시선: 원점(분수) 또는 맵 안쪽 방향
      this._spawnOneBench(x, z, 0, 0);
    }
  }

  // ── 의도적 장면 구성 (씬 클러스터) ────────────────────────────
  /**
   * 공원을 "핸드크래프트된" 소규모 장면 묶음으로 구성.
   * 각 클러스터는 하나의 이야기를 가진다:
   *  A. 분수 반원 좌석 구역  — 분수를 마주보는 벤치 호
   *  B. 독서 모퉁이         — 나무 그늘 + 벤치 + 가로등
   *  C. 아이스크림 광장      — 카트 + 풍선 + 둘러앉은 벤치
   *  D. 전망 포인트         — 오솔길 끝 벤치, 원경 향
   *  E. 놀이터 관람석       — 놀이터 옆 벤치 열
   */
  _spawnParkSceneClusters() {
    const rng = this._rng;

    // ── A. 분수 반원 좌석 구역 (분수 주변 반경 14m) ──────────────
    const fountainX = 0, fountainZ = 0;
    const seatAngles = [-0.55, -0.22, 0.0, 0.22, 0.55];
    seatAngles.forEach(da => {
      const a  = Math.PI + da; // 분수 남쪽 반원
      const bx = fountainX + Math.sin(a) * 14;
      const bz = fountainZ + Math.cos(a) * 14;
      this._spawnOneBench(bx, bz, fountainX, fountainZ);
      // 벤치 사이 화분
      if (Math.abs(da) < 0.3) {
        this._spawnFlowerPot(bx + Math.sin(a + Math.PI * 0.5) * 1.8, bz + Math.cos(a + Math.PI * 0.5) * 1.8);
      }
    });

    // ── B. 독서 모퉁이 (북동쪽 35m) ─────────────────────────────
    const readX = 32, readZ = -28;
    this._spawnOneBench(readX,      readZ,      readX - 10, readZ);
    this._spawnOneBench(readX + 3,  readZ + 4,  readX - 10, readZ);
    this._spawnSceneLamp(readX + 5, readZ - 2);
    this._spawnFlowerPot(readX - 2, readZ - 3);
    this._spawnFlowerPot(readX + 8, readZ + 1);

    // ── C. 아이스크림 광장 (서쪽 40m) ───────────────────────────
    const icX = -38, icZ = 15;
    // 카트는 기존 _spawnIceCreamCarts에서 처리되므로 여기선 벤치+풍선만
    this._spawnOneBench(icX + 5,  icZ,      icX, icZ);
    this._spawnOneBench(icX - 5,  icZ + 2,  icX, icZ);
    this._spawnOneBench(icX + 1,  icZ + 7,  icX, icZ);
    this._spawnSceneLamp(icX, icZ - 5);
    // 쓰레기통
    this._spawnSceneTrashCan(icX + 8, icZ - 4);

    // ── D. 전망 포인트 4곳 (맵 경계 방향) ──────────────────────
    const viewpoints = [
      { x:  60, z:  0,  lookX: 100, lookZ:  0  },
      { x: -55, z: -40, lookX: -90, lookZ: -70 },
      { x:  25, z:  60, lookX:  40, lookZ: 100 },
      { x: -30, z:  55, lookX: -50, lookZ:  90 },
    ];
    viewpoints.forEach(vp => {
      this._spawnOneBench(vp.x,     vp.z,     vp.lookX, vp.lookZ);
      this._spawnOneBench(vp.x + 3, vp.z + 3, vp.lookX, vp.lookZ);
      this._spawnSceneLamp(vp.x - 3, vp.z - 3);
    });

    // ── E. 놀이터 관람석 (남동쪽 50m) ───────────────────────────
    const playX = 45, playZ = 50;
    for (let i = 0; i < 3; i++) {
      this._spawnOneBench(playX - 12, playZ - 5 + i * 5, playX, playZ);
    }
  }

  /** 씬용 가로등 1개 (배치 전용, 포인트 라이트 없음) */
  _spawnSceneLamp(x, z) {
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const pilMat = new THREE.MeshLambertMaterial({ color: 0x3A3A4A });
    const lmpMat = new THREE.MeshLambertMaterial({ color: 0xFFFF88, emissive: 0xFFFF44, emissiveIntensity: 0.8 });
    g.add(this._cyl(0.075, 0.085, 4.2, 6, pilMat, 0, 2.1, 0));
    // 팔
    g.add(this._box(0.06, 0.06, 0.55, pilMat, 0, 4.25, 0.28));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), lmpMat);
    lamp.position.set(0, 4.35, 0.55);
    g.add(lamp);
    // 장식 링
    g.add(this._cyl(0.095, 0.095, 0.055, 8, pilMat, 0, 0.55, 0));
    g.add(this._cyl(0.095, 0.095, 0.055, 8, pilMat, 0, 1.80, 0));
    g.position.set(x, y, z);
    this.scene.add(g);
    this.objects.push(g);
  }

  /** 씬용 화분 1개 */
  _spawnFlowerPot(x, z) {
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const potMat = new THREE.MeshLambertMaterial({ color: 0xA05030, flatShading: true });
    const soilMat = new THREE.MeshLambertMaterial({ color: 0x503820 });
    const flwColors = [0xFF4466, 0xFFCC22, 0xFF88AA, 0x44DDAA];
    const flwMat = new THREE.MeshLambertMaterial({ color: flwColors[Math.floor(this._rng() * flwColors.length)] });
    // 화분 몸통 (위 넓고 아래 좁은 사다리꼴)
    g.add(this._cyl(0.30, 0.22, 0.32, 8, potMat, 0, 0.16, 0));
    g.add(this._cyl(0.31, 0.31, 0.04, 8, potMat, 0, 0.33, 0)); // 테두리
    g.add(this._cyl(0.28, 0.28, 0.03, 8, soilMat, 0, 0.32, 0)); // 흙
    // 꽃: 줄기 + 꽃잎 구체
    for (let fi = 0; fi < 3; fi++) {
      const fx = (this._rng() - 0.5) * 0.22;
      const fz = (this._rng() - 0.5) * 0.22;
      g.add(this._cyl(0.022, 0.022, 0.26, 4, new THREE.MeshLambertMaterial({ color: 0x228833 }), fx, 0.47, fz));
      const flw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), flwMat);
      flw.position.set(fx, 0.60, fz);
      g.add(flw);
    }
    g.position.set(x, y, z);
    this.scene.add(g);
    this.objects.push(g);
  }

  /** 씬용 쓰레기통 1개 */
  _spawnSceneTrashCan(x, z) {
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const canMat = new THREE.MeshLambertMaterial({ color: 0x2C5C2C });
    const lidMat = new THREE.MeshLambertMaterial({ color: 0x234823 });
    g.add(this._cyl(0.28, 0.24, 0.75, 8, canMat, 0, 0.38, 0));
    g.add(this._cyl(0.30, 0.30, 0.05, 8, lidMat, 0, 0.78, 0));
    // 손잡이
    g.add(this._box(0.36, 0.04, 0.04, lidMat, 0, 0.82, 0));
    g.position.set(x, y, z);
    this.scene.add(g);
    this.objects.push(g);
  }

  _spawnLampPosts(count) {
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 200;
      const z = (this._rng() - 0.5) * 200;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 기둥
      g.add(this._cyl(0.08, 0.09, 4.5, 6, new THREE.MeshLambertMaterial({ color: 0x444455 }), 0, 2.25, 0));
      // 팔
      const arm = this._box(0.06, 0.06, 0.7, new THREE.MeshLambertMaterial({ color: 0x444455 }), 0, 4.55, 0.35);
      g.add(arm);
      // 전등
      const lampGeo = new THREE.SphereGeometry(0.18, 7, 5);
      const lamp = new THREE.Mesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0xffff99, emissive: 0xffff44, emissiveIntensity: 0.7 }));
      lamp.position.set(0, 4.7, 0.68);
      g.add(lamp);
      g.position.set(x, y, z);
      this.scene.add(g);
      this.objects.push(g);
      this._obstacles.push({ x, z, r: 0.18 }); // 가로등 기둥 충돌 콜라이더
    }
  }

  _spawnFountain() {
    const x = (this._rng() - 0.5) * 80;
    const z = (this._rng() - 0.5) * 80;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xbbbbaa, flatShading: true });
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x5599ff, transparent: true, opacity: 0.75 });
    // 외벽
    g.add(this._cyl(2.8, 3.0, 0.5, 14, stoneMat, 0, 0.25, 0));
    g.add(this._cyl(2.6, 2.6, 0.15, 14, waterMat, 0, 0.5, 0)); // 물
    g.add(this._cyl(0.2, 0.22, 1.5, 8, stoneMat, 0, 0.75, 0)); // 기둥
    g.add(this._cyl(1.0, 1.1, 0.3, 12, stoneMat, 0, 1.55, 0)); // 상단 그릇
    g.position.set(x, y, z);
    this.scene.add(g);
    this.objects.push(g);
    this._obstacles.push({ x, z, r: 3.0 }); // 분수 외벽 충돌 콜라이더
  }

  _spawnPath() {
    const pathMat = new THREE.MeshLambertMaterial({ color: 0xddbb99 });
    for (let i = -22; i <= 22; i++) {
      const z = i * 2.8;
      const y = this.getHeight(0, z);
      const tile = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 2.8), pathMat);
      tile.position.set(0, y + 0.04, z);
      this.scene.add(tile);
      this.objects.push(tile);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 연못 전용 ────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnLilyPads(pondR, px, pz) {
    const padMat = new THREE.MeshLambertMaterial({ color: 0x3a7a22 });
    const flwMat = new THREE.MeshLambertMaterial({ color: 0xffaacc });
    for (let i = 0; i < 10; i++) {
      const a = this._rng() * Math.PI * 2;
      const r = this._rng() * pondR * 0.85;
      const lx = px + Math.cos(a) * r;
      const lz = pz + Math.sin(a) * r;
      const gy = this.getHeight(lx, lz) + 0.07;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.5 + this._rng() * 0.5, 10), padMat.clone());
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(lx, gy, lz);
      this.scene.add(pad);
      this.objects.push(pad);
      if (this._rng() > 0.5) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), flwMat.clone());
        flower.position.set(lx, gy + 0.18, lz);
        this.scene.add(flower);
        this.objects.push(flower);
      }
    }
  }

  _spawnCattails(count, pondR, px, pz) {
    const stalkMat = new THREE.MeshLambertMaterial({ color: 0x6a9a44 });
    const headMat  = new THREE.MeshLambertMaterial({ color: 0x884422 });
    for (let i = 0; i < count; i++) {
      const a  = this._rng() * Math.PI * 2;
      const r  = pondR * (0.85 + this._rng() * 0.2);
      const lx = px + Math.cos(a) * r;
      const lz = pz + Math.sin(a) * r;
      const ly = this.getHeight(lx, lz);
      const h  = 1.2 + this._rng() * 0.8;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 5), stalkMat.clone());
      stalk.position.set(lx, ly + h * 0.5, lz);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 7), headMat.clone());
      head.position.set(lx, ly + h - 0.1, lz);
      this.scene.add(stalk, head);
      this.objects.push(stalk, head);
    }
  }

  _spawnWoodenBridge() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    const x = (this._rng() - 0.5) * 200;
    const z = (this._rng() - 0.5) * 200;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    for (let i = -4; i <= 4; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.5), mat);
      plank.position.set(0, 0.1, i * 0.55);
      g.add(plank);
    }
    for (const lx of [-1.0, 1.0]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.8, 5), mat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(lx, 0.7, 0);
      g.add(rail);
    }
    g.position.set(x, y, z);
    g.rotation.y = this._rng() * Math.PI;
    this.scene.add(g);
    this.objects.push(g);
  }

  // ════════════════════════════════════════════════════════════════
  // ── 해양 전용 ────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  // 산호 — InstancedMesh (색상 변형 포함)
  _spawnCoral(count) {
    const rng   = this._rng;
    const dummy = new THREE.Object3D();
    const coralGeo = new THREE.ConeGeometry(1, 1, 5); // scale로 다양화
    const coralMat = new THREE.MeshLambertMaterial({ color: 0xff6633, flatShading: true });
    const totalBranches = count * 3;
    const inst = new THREE.InstancedMesh(coralGeo, coralMat, totalBranches);
    const colors = [0xff6633, 0xff44aa, 0xff9900, 0xff3399, 0xffaa44, 0xff6699, 0xee2244];
    // 클러스터 배치 — 산호초는 군집
    const centers = clusterSpawn(Math.ceil(count / 3), 3, MAP_HALF * 0.88, 20, rng);
    let idx = 0;
    for (let i = 0; i < count && idx < totalBranches; i++) {
      const { x, z } = centers[i % centers.length];
      const jx = x + (rng()-0.5)*3, jz = z + (rng()-0.5)*3;
      const y  = this.getHeight(jx, jz);
      const n  = 2 + Math.floor(rng() * 3);
      for (let j = 0; j < n && idx < totalBranches; j++, idx++) {
        const h  = 1 + rng() * 2.5;
        const r  = 0.25 + rng() * 0.3;
        const ox = (rng()-0.5) * 1.2, oz = (rng()-0.5) * 1.2;
        dummy.position.set(jx + ox, y + h * 0.5, jz + oz);
        dummy.scale.set(r, h, r);
        dummy.rotation.z = (rng()-0.5) * 0.6;
        dummy.rotation.y = rng() * 6.28;
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
        inst.setColorAt(idx, new THREE.Color(colors[(i + j) % colors.length]).offsetHSL(0, (rng()-0.5)*0.12, (rng()-0.5)*0.1));
      }
    }
    inst.count = idx;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
    this.objects.push(inst);
  }

  // 조개 — InstancedMesh
  _spawnShells(count) {
    const rng   = this._rng;
    const dummy = new THREE.Object3D();
    const shellGeo = new THREE.TorusGeometry(1, 0.25, 5, 14, Math.PI * 1.5); // scale로 크기 제어
    const shellMat = new THREE.MeshLambertMaterial({ color: 0xffd8aa, flatShading: true });
    const inst = new THREE.InstancedMesh(shellGeo, shellMat, count);
    const pts  = poissonSpawn(count, MAP_HALF * 0.88, 3, rng);
    for (let i = 0; i < pts.length; i++) {
      const { x, z } = pts[i];
      const y = this.getHeight(x, z);
      const s = 0.3 + rng() * 0.4;
      dummy.position.set(x, y + 0.08, z);
      dummy.scale.setScalar(s);
      dummy.rotation.x = -Math.PI / 2;
      dummy.rotation.z = rng() * 6.28;
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (inst.instanceColor) {
        inst.setColorAt(i, new THREE.Color(0xffd8aa).offsetHSL(0, (rng()-0.5)*0.08, (rng()-0.5)*0.15));
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.scene.add(inst);
    this.objects.push(inst);
  }

  _spawnCliffs() {
    for (let i = 0; i < 8; i++) {
      const x  = (this._rng() - 0.5) * 700;
      const z  = (this._rng() - 0.5) * 700;
      const y  = this.getHeight(x, z);
      const h  = 8 + this._rng() * 14;
      const cliff = new THREE.Mesh(
        new THREE.BoxGeometry(20 + this._rng() * 30, h, 8 + this._rng() * 12),
        new THREE.MeshLambertMaterial({ color: 0x887766, flatShading: true })
      );
      cliff.position.set(x, y + h * 0.5, z);
      cliff.rotation.y = this._rng() * Math.PI;
      this.scene.add(cliff);
      this.objects.push(cliff);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 사바나 전용 ──────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnTermiteMounds(count) {
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800;
      const z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const h = 2 + this._rng() * 4;
      const mound = new THREE.Mesh(
        new THREE.ConeGeometry(1.2 + this._rng(), h, 7),
        new THREE.MeshLambertMaterial({ color: 0xcc8833, flatShading: true })
      );
      mound.position.set(x, y + h * 0.5, z);
      mound.rotation.y = this._rng() * 6.28;
      this.scene.add(mound);
      this.objects.push(mound);
    }
  }

  _spawnDryGrass(count, spread) {
    const rng   = this._rng;
    const mat   = new THREE.MeshLambertMaterial({ color: 0xccaa55, side: THREE.DoubleSide });
    const dummy = new THREE.Object3D();
    const bladeGeo = new THREE.PlaneGeometry(0.08, 0.5);
    const inst = new THREE.InstancedMesh(bladeGeo, mat, count);
    // 클러스터 배치 — 건초 무더기 느낌
    const pts = clusterSpawn(Math.ceil(count / 12), 12, spread, 28, rng);
    for (let i = 0; i < count; i++) {
      const { x, z } = pts[i % pts.length];
      const jx = x + (rng()-0.5)*4, jz = z + (rng()-0.5)*4;
      const y  = this.getHeight(jx, jz);
      dummy.position.set(jx, y + 0.25, jz);
      dummy.rotation.y = rng() * 6.28;
      dummy.rotation.z = (rng()-0.5) * 0.5;
      dummy.scale.setScalar(0.7 + rng() * 1.0); // 더 다양한 키
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst); this.objects.push(inst);
  }

  _spawnWaterHole() {
    const x = (this._rng() - 0.5) * 200;
    const z = (this._rng() - 0.5) * 200;
    const y = this.getHeight(x, z);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(15 + this._rng() * 10, 18),
      new THREE.MeshLambertMaterial({ color: 0x3a7aaa, transparent: true, opacity: 0.8 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, y + 0.06, z);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(16, 1.5, 4, 18),
      new THREE.MeshLambertMaterial({ color: 0x998855, flatShading: true })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, y + 0.04, z);
    this.scene.add(water, rim);
    this.objects.push(water, rim);
  }

  // ════════════════════════════════════════════════════════════════
  // ── 숲 전용 ──────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  // 버섯 — InstancedMesh (stem+cap 2 draw call)
  _spawnMushrooms(count) {
    const rng  = this._rng;
    const dummy = new THREE.Object3D();
    const stemGeo = new THREE.CylinderGeometry(0.22, 0.32, 1, 7);   // 높이 1 → scale Y로 제어
    const capGeo  = new THREE.SphereGeometry(1, 9, 6, 0, Math.PI*2, 0, Math.PI/2);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xeeddcc });
    const capMat  = new THREE.MeshLambertMaterial({ color: 0xff2222, flatShading: true });
    const stemI   = new THREE.InstancedMesh(stemGeo, stemMat, count);
    const capI    = new THREE.InstancedMesh(capGeo,  capMat,  count);
    // 클러스터 배치 — 버섯은 무리지어 자람
    const pts = clusterSpawn(Math.ceil(count / 4), 4, MAP_HALF * 0.85, 30, rng);
    const mushColors = [0xff2222, 0xff7700, 0x882299, 0xeecc00, 0xff4488];
    for (let i = 0; i < count; i++) {
      const { x, z } = pts[i % pts.length];
      const jx = x + (rng()-0.5) * 5, jz = z + (rng()-0.5) * 5;
      const y  = this.getHeight(jx, jz);
      const h  = 0.8 + rng() * 1.2;
      const sr = 0.55 + rng() * 0.55; // 갓 반지름 변형
      dummy.position.set(jx, y + h * 0.5, jz);
      dummy.scale.set(1, h, 1);
      dummy.rotation.y = rng() * 6.28;
      dummy.rotation.z = (rng()-0.5)*0.08;
      dummy.updateMatrix();
      stemI.setMatrixAt(i, dummy.matrix);
      dummy.position.set(jx, y + h + sr * 0.2, jz);
      dummy.scale.set(sr, sr * 0.65, sr);
      dummy.rotation.x = Math.PI; dummy.rotation.z = 0;
      dummy.updateMatrix();
      capI.setMatrixAt(i, dummy.matrix);
      capI.setColorAt(i, new THREE.Color(mushColors[i % mushColors.length]).offsetHSL(0, (rng()-0.5)*0.1, (rng()-0.5)*0.12));
    }
    stemI.instanceMatrix.needsUpdate = capI.instanceMatrix.needsUpdate = true;
    if (capI.instanceColor) capI.instanceColor.needsUpdate = true;
    this.scene.add(stemI, capI);
    this.objects.push(stemI, capI);
  }

  _spawnFallenLogs(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const len = 4 + this._rng() * 6;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, len, 8), mat.clone());
      log.position.set(x, y + 0.35, z);
      log.rotation.z = Math.PI / 2 + (this._rng() - 0.5) * 0.3;
      log.rotation.y = this._rng() * Math.PI;
      log.castShadow = true;
      this.scene.add(log);
      this.objects.push(log);
    }
  }

  _spawnMossRocks(count) {
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const r = 0.6 + this._rng() * 1.8;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r, 0),
        new THREE.MeshLambertMaterial({ color: 0x4a6a4a, flatShading: true })
      );
      rock.position.set(x, y + r * 0.6, z);
      rock.rotation.set(this._rng() * 3.14, this._rng() * 6.28, 0);
      this.scene.add(rock);
      this.objects.push(rock);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 공룡섬 전용 ──────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnVolcano(vx, vz) {
    const vy = this.getHeight(vx, vz);
    const h  = 90 + this._rng() * 50;
    const r  = 50 + this._rng() * 30;
    const volcano = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 12),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a, flatShading: true })
    );
    volcano.position.set(vx, vy + h * 0.5, vz);
    this.scene.add(volcano);
    this.objects.push(volcano);
    // 크레이터
    const crater = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.25, r * 0.2, 8, 10),
      new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.7 })
    );
    crater.position.set(vx, vy + h - 2, vz);
    this.scene.add(crater);
    this.objects.push(crater);
    // 용암 흐름
    for (let i = 0; i < 3; i++) {
      const angle = this._rng() * Math.PI * 2;
      const lavaLen = 30 + this._rng() * 40;
      const lava = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.5, lavaLen),
        new THREE.MeshLambertMaterial({ color: 0xff5500, emissive: 0xff2200, emissiveIntensity: 0.5 })
      );
      lava.position.set(vx + Math.cos(angle) * (r * 0.5), vy + h * 0.3, vz + Math.sin(angle) * (r * 0.5));
      lava.rotation.y = angle;
      this.scene.add(lava);
      this.objects.push(lava);
    }
  }

  _spawnDinoFootprints(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x332211 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      // 3발가락 발자국
      for (let t = 0; t < 3; t++) {
        const ta = (t / 3) * Math.PI - Math.PI * 0.3;
        const print = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.6, 0.1, 5),
          mat.clone()
        );
        print.position.set(x + Math.cos(ta) * 1.1, y + 0.05, z + Math.sin(ta) * 1.1);
        this.scene.add(print);
        this.objects.push(print);
      }
    }
  }

  _spawnFossils(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xddcc88, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const fossil = new THREE.Mesh(new THREE.TorusGeometry(1 + this._rng() * 1.5, 0.2, 5, 12), mat.clone());
      fossil.rotation.x = -Math.PI / 2 + (this._rng() - 0.5) * 0.4;
      fossil.position.set(x, y + 0.2, z);
      this.scene.add(fossil);
      this.objects.push(fossil);
    }
  }

  _spawnGiantFerns(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a6622, side: THREE.DoubleSide, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      for (let f = 0; f < 5; f++) {
        const angle = (f / 5) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 2.5), mat.clone());
        frond.position.set(Math.cos(angle) * 0.3, 0.8, Math.sin(angle) * 0.3);
        frond.rotation.y = angle;
        frond.rotation.z = 0.7;
        g.add(frond);
      }
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * 6.28;
      this.scene.add(g);
      this.objects.push(g);
    }
  }

  _spawnDinoBones(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xddddcc, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const len = 5 + this._rng() * 10;
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, len, 6), mat.clone());
      bone.position.set(x, y + 0.4, z);
      bone.rotation.z = Math.PI / 2 + (this._rng() - 0.5) * 0.4;
      bone.rotation.y = this._rng() * Math.PI;
      // 끝 구체
      for (const end of [-len * 0.5, len * 0.5]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.42, 6, 5), mat.clone());
        const dir = bone.rotation.y;
        knob.position.set(x + Math.cos(dir) * end * 0.9, y + 0.4, z + Math.sin(dir) * end * 0.9);
        this.scene.add(knob);
        this.objects.push(knob);
      }
      this.scene.add(bone);
      this.objects.push(bone);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 우주 전용 ────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _buildStarField() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(6000 * 3);
    for (let i = 0; i < 6000; i++) {
      pos[i * 3]     = (this._rng() - 0.5) * 3000;
      pos[i * 3 + 1] = this._rng() * 400 + 5;
      pos[i * 3 + 2] = (this._rng() - 0.5) * 3000;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9 }));
    this.scene.add(stars);
    this.objects.push(stars);
  }

  _spawnPlanets() {
    const defs = [
      { color: 0xff6622, r: 80, pos: [400, 150, -200], ring: false },
      { color: 0x4488ff, r: 60, pos: [-350, 100, 300],  ring: false },
      { color: 0xcc44ff, r: 100, pos: [0, 200, -450],   ring: true  },
    ];
    defs.forEach(d => {
      const planet = new THREE.Mesh(new THREE.SphereGeometry(d.r, 18, 14), new THREE.MeshLambertMaterial({ color: d.color, flatShading: true }));
      planet.position.set(...d.pos);
      this.scene.add(planet);
      this.objects.push(planet);
      if (d.ring) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(d.r * 1.5, d.r * 0.15, 4, 40),
          new THREE.MeshLambertMaterial({ color: 0xddbbaa, transparent: true, opacity: 0.6 })
        );
        ring.position.set(...d.pos);
        ring.rotation.x = 0.5;
        this.scene.add(ring);
        this.objects.push(ring);
      }
    });
  }

  _spawnCraters(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x334433, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const r = 4 + this._rng() * 12;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.18, 5, 18), mat.clone());
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(x, y + 0.3, z);
      this.scene.add(rim);
      this.objects.push(rim);
    }
  }

  _spawnAlienStructures(count) {
    const matA = new THREE.MeshLambertMaterial({ color: 0x44ffaa, emissive: 0x22aa66, emissiveIntensity: 0.4 });
    const matB = new THREE.MeshLambertMaterial({ color: 0x556688, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700;
      const z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const h = 6 + this._rng() * 10;
      g.add(this._cyl(0.5, 0.8, h, 6, matB.clone(), 0, h * 0.5, 0));
      g.add(this._cyl(2.5, 2.5, 0.4, 6, matB.clone(), 0, h, 0));
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), matA.clone());
      orb.position.set(0, h + 0.8, 0);
      g.add(orb);
      g.position.set(x, y, z);
      this.scene.add(g);
      this.objects.push(g);
    }
  }

  _spawnSpaceDebris(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x889999, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900;
      const z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const debris = new THREE.Mesh(
        new THREE.BoxGeometry(2 + this._rng() * 6, 2 + this._rng() * 5, 2 + this._rng() * 6),
        mat.clone()
      );
      debris.position.set(x, y + 2 + this._rng() * 10, z);
      debris.rotation.set(this._rng() * 3.14, this._rng() * 6.28, this._rng() * 3.14);
      this.scene.add(debris);
      this.objects.push(debris);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 공원 추가 소품 ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnGazebos(count) {
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b4513, flatShading: true });
      const woodMat = new THREE.MeshLambertMaterial({ color: 0xc8a060 });
      // 바닥
      g.add(this._box(7, 0.2, 7, woodMat, 0, 0.1, 0));
      // 기둥 4개
      for (const [px, pz] of [[-3,3],[3,3],[-3,-3],[3,-3]]) {
        g.add(this._cyl(0.18, 0.2, 3.5, 6, woodMat.clone(), px, 1.75, pz));
      }
      // 지붕
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2.5, 8), roofMat);
      roof.position.y = 4.5;
      g.add(roof);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI;
      this.scene.add(g); this.objects.push(g);
      this._obstacles.push({ x, z, r: 3.8 }); // 정자 바닥 반경
    }
  }

  _spawnParkGate() {
    const x = 0, z = -450;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa, flatShading: true });
    // 기둥 2개
    for (const px of [-6, 6]) {
      g.add(this._cyl(0.8, 0.9, 6, 8, stoneMat.clone(), px, 3, 0));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 6), stoneMat.clone());
      cap.position.set(px, 6.5, 0);
      g.add(cap);
    }
    // 가로 아치
    g.add(this._box(12, 0.6, 0.5, stoneMat.clone(), 0, 5.5, 0));
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 0.2), new THREE.MeshLambertMaterial({ color: 0x1a4a1a }));
    sign.position.set(0, 5.5, -0.35);
    g.add(sign);
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
    // 게이트 기둥 2개 충돌
    this._obstacles.push({ x: x - 6, z, r: 0.9 });
    this._obstacles.push({ x: x + 6, z, r: 0.9 });
  }

  _spawnPlayground() {
    const x = 80, z = 80;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const redMat = new THREE.MeshLambertMaterial({ color: 0xff3333 });
    const bluMat = new THREE.MeshLambertMaterial({ color: 0x3366ff });
    const ylwMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
    // 미끄럼틀
    const slide = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 4.5), redMat);
    slide.rotation.x = 0.45;
    slide.position.set(3, 2.2, 2);
    g.add(slide);
    g.add(this._cyl(0.12, 0.14, 4, 6, new THREE.MeshLambertMaterial({ color: 0x888888 }), 3, 2, -1));
    // 그네 (2개)
    g.add(this._box(5, 0.15, 0.15, bluMat.clone(), -4, 3.5, 0));
    for (const px of [-5.2, -2.8]) {
      g.add(this._box(0.1, 3, 0.1, new THREE.MeshLambertMaterial({ color: 0x888888 }), px, 2, 0));
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.4), ylwMat.clone());
      seat.position.set(px, 0.5, 0);
      g.add(seat);
    }
    for (const px of [-7, -1]) {
      g.add(this._cyl(0.14, 0.16, 4, 6, new THREE.MeshLambertMaterial({ color: 0x555566 }), px, 2, 0));
    }
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
  }

  _spawnPicnicTables(count) {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xa07040 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 600, z = (this._rng() - 0.5) * 600;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._box(3, 0.12, 1.2, woodMat.clone(), 0, 0.75, 0));
      for (const pz of [-0.9, 0.9]) {
        g.add(this._box(3, 0.1, 0.5, woodMat.clone(), 0, 0.45, pz));
      }
      for (const [lx, lz] of [[-1.1,-0.2],[-1.1,0.2],[1.1,-0.2],[1.1,0.2]]) {
        g.add(this._cyl(0.07, 0.08, 0.78, 5, woodMat.clone(), lx, 0.39, lz));
      }
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnTrashCans(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x338833 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 200, z = (this._rng() - 0.5) * 200;
      const y = this.getHeight(x, z);
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.9, 8), mat.clone());
      can.position.set(x, y + 0.45, z);
      this.scene.add(can); this.objects.push(can);
    }
  }

  _spawnHedgeRows(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a5a18, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 200, z = (this._rng() - 0.5) * 200;
      const y = this.getHeight(x, z);
      const len = 6 + this._rng() * 12;
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, 1.2), mat.clone());
      hedge.position.set(x, y + 0.9, z);
      hedge.rotation.y = this._rng() * Math.PI;
      this.scene.add(hedge); this.objects.push(hedge);
    }
  }

  _spawnFlowerBeds(count) {
    const bedMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 200, z = (this._rng() - 0.5) * 200;
      const y = this.getHeight(x, z);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(4 + this._rng()*4, 0.15, 2 + this._rng()*2), bedMat.clone());
      bed.position.set(x, y + 0.08, z);
      bed.rotation.y = this._rng() * Math.PI;
      this.scene.add(bed); this.objects.push(bed);
    }
  }

  _spawnBandstand() {
    const x = -100, z = 0;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const mat1 = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0x228822, flatShading: true });
    g.add(this._cyl(5, 5.5, 0.3, 10, mat1.clone(), 0, 0.15, 0));
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      g.add(this._cyl(0.15, 0.18, 4, 6, mat1.clone(), Math.cos(a)*4.2, 2, Math.sin(a)*4.2));
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.2, 10), mat2);
    roof.position.y = 5.2;
    g.add(roof);
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
    this._obstacles.push({ x, z, r: 5.5 }); // 밴드스탠드 기둥 외경
  }

  _spawnStatues(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xbbbbaa, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 200, z = (this._rng() - 0.5) * 200;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.5, 0.6, 1, 6, mat.clone(), 0, 0.5, 0));
      g.add(this._box(0.6, 0.6, 0.5, mat.clone(), 0, 1.3, 0));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 7, 6), mat.clone());
      head.position.set(0, 2, 0);
      g.add(head);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnCafeeStall(count) {
    const mat1 = new THREE.MeshLambertMaterial({ color: 0xcc6633 });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 180, z = (this._rng() - 0.5) * 180;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._box(4, 2.5, 2.5, mat2.clone(), 0, 1.25, 0));
      const awning = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2), mat1.clone());
      awning.position.set(0, 2.8, 0.5);
      awning.rotation.x = -0.2;
      g.add(awning);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnSignPosts(count) {
    const postMat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    const signMat = new THREE.MeshLambertMaterial({ color: 0xeeddaa });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 200, z = (this._rng() - 0.5) * 200;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.08, 0.09, 2.5, 5, postMat.clone(), 0, 1.25, 0));
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), signMat.clone());
      sign.position.set(0.7, 2.2, 0);
      g.add(sign);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnParkWalls(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xcc9977, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 220, z = (this._rng() - 0.5) * 220;
      const y = this.getHeight(x, z);
      const len = 15 + this._rng() * 30;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 1.5, 0.5), mat.clone());
      wall.position.set(x, y + 0.75, z);
      wall.rotation.y = this._rng() * Math.PI;
      this.scene.add(wall); this.objects.push(wall);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 공원 추가 소품 (신규) ────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  /** 풍선 묶음 — 알록달록한 색구슬 3~5개 기둥에 묶임 */
  _spawnBalloonClusters(count) {
    const colors = [0xff2244, 0xffaa00, 0x44aaff, 0x44ee44, 0xff44ff, 0xffee22];
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 180, z = (this._rng() - 0.5) * 180;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 기둥
      g.add(this._cyl(0.04, 0.05, 1.5, 5,
        new THREE.MeshLambertMaterial({ color: 0x888888 }), 0, 0.75, 0));
      // 풍선 3~5개
      const n = 3 + Math.floor(this._rng() * 3);
      for (let j = 0; j < n; j++) {
        const col = colors[Math.floor(this._rng() * colors.length)];
        const balloon = new THREE.Mesh(
          new THREE.SphereGeometry(0.22 + this._rng() * 0.1, 8, 6),
          new THREE.MeshLambertMaterial({ color: col })
        );
        balloon.position.set(
          (this._rng() - 0.5) * 0.5,
          1.5 + this._rng() * 0.7,
          (this._rng() - 0.5) * 0.5
        );
        g.add(balloon);
      }
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  /** 아이스크림 카트 — 파란 우산 + 흰 수레 */
  _spawnIceCreamCarts(count) {
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 160, z = (this._rng() - 0.5) * 160;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const cartMat  = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const umbMat   = new THREE.MeshLambertMaterial({ color: 0x2266cc, flatShading: true });
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
      // 수레 몸통
      g.add(this._box(1.4, 0.9, 0.7, cartMat, 0, 0.75, 0));
      // 바퀴 2개
      for (const wx of [-0.55, 0.55]) {
        g.add(this._cyl(0.18, 0.18, 0.1, 8, wheelMat, wx, 0.18, 0));
      }
      // 우산 기둥
      g.add(this._cyl(0.04, 0.04, 1.8, 5, cartMat, 0, 1.2, 0));
      // 우산 캐노피
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.4, 10), umbMat);
      cone.position.set(0, 2.2, 0);
      g.add(cone);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
      this._structures.push({ x, z, r: 1.5 }); // 미니맵 표시
    }
  }

  /** 공원 시계탑 — 중앙 근처 1개 */
  _spawnParkClock() {
    const x = 40, z = -30;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xccbbaa, flatShading: true });
    const clockMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    // 기둥
    g.add(this._cyl(0.55, 0.65, 6.5, 8, stoneMat, 0, 3.25, 0));
    // 시계면
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), clockMat);
    face.position.set(0, 6.8, -0.6);
    g.add(face);
    // 지붕
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.2, 8), stoneMat);
    roof.position.set(0, 7.4, 0);
    g.add(roof);
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
  }

  /** 그네 세트 */
  _spawnSwingSets(count) {
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 180, z = (this._rng() - 0.5) * 180;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const frameMat = new THREE.MeshLambertMaterial({ color: 0x888899 });
      const seatMat  = new THREE.MeshLambertMaterial({ color: 0xcc6633 });
      // 기둥 2쌍
      for (const sx of [-1.2, 1.2]) {
        g.add(this._cyl(0.08, 0.09, 3, 6, frameMat, sx, 1.5, -0.6));
        g.add(this._cyl(0.08, 0.09, 3, 6, frameMat, sx, 1.5,  0.6));
      }
      // 가로대
      g.add(this._cyl(0.07, 0.07, 2.6, 6, frameMat, 0, 3, 0));
      // 그네 시트
      g.add(this._box(0.4, 0.06, 0.25, seatMat, 0, 1.2, 0));
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI;
      this.scene.add(g); this.objects.push(g);
    }
  }

  /** 컬러풀 키오스크 — 지도·안내판 */
  _spawnColorfulKiosks(count) {
    const roofColors = [0xff4444, 0x4444ff, 0x44aa44, 0xffaa00];
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 180, z = (this._rng() - 0.5) * 180;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const col = roofColors[i % roofColors.length];
      g.add(this._box(1.2, 2, 0.2,
        new THREE.MeshLambertMaterial({ color: 0xeeeecc }), 0, 1, 0));
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.4),
        new THREE.MeshLambertMaterial({ color: col }));
      roof.position.set(0, 2.1, 0);
      g.add(roof);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  /** 강아지 물그릇 — 낮은 원통 */
  _spawnDogWaterBowls(count) {
    const bowlMat = new THREE.MeshLambertMaterial({ color: 0x5588cc });
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x88bbff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 180, z = (this._rng() - 0.5) * 180;
      const y = this.getHeight(x, z);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.18, 8), bowlMat.clone());
      bowl.position.set(x, y + 0.09, z);
      const water = new THREE.Mesh(new THREE.CircleGeometry(0.24, 8), waterMat.clone());
      water.rotation.x = -Math.PI / 2;
      water.position.set(x, y + 0.185, z);
      this.scene.add(bowl, water);
      this.objects.push(bowl, water);
    }
  }

  /** 공원 자전거 거치대 + 자전거 */
  _spawnParkBikes(count) {
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xcc4422 });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 180, z = (this._rng() - 0.5) * 180;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 바퀴 2개
      g.add(this._cyl(0.35, 0.35, 0.06, 10, wheelMat, -0.5, 0.35, 0));
      g.add(this._cyl(0.35, 0.35, 0.06, 10, wheelMat,  0.5, 0.35, 0));
      // 프레임 (대각선 박스)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.06), frameMat);
      frame.position.set(0, 0.6, 0);
      frame.rotation.z = 0.3;
      g.add(frame);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 대기 & 조명 시스템 ──────────────────────────────────────
  // ════════════════════════════════════════════════════════════════

  /**
   * 대기 파티클 — 꽃가루·먼지·반딧불 등 분위기 파티클
   * InstancedMesh 1개 = draw call 1개. 저비용 고효과.
   * @param {object} opts - count, spread, maxY, color, size
   */
  _buildAtmosphereParticles({ count = 200, spread = 100, maxY = 6, color = 0xfffde0, size = 0.06 }) {
    const geo = new THREE.SphereGeometry(size, 3, 3);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false; // 화면 밖 컬링 끄기 (파티클은 전체 공간)
    const dummy = this._pollenDummy;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread * 2;
      const z = (Math.random() - 0.5) * spread * 2;
      const y = Math.random() * maxY;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      this._pollenData.push({
        x, y, z,
        speed: 0.12 + Math.random() * 0.25,
        spread: spread * 2,
        maxY,
      });
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.objects.push(mesh);
    this._pollens = mesh;
  }

  /**
   * 가로등 포인트 조명 — 실제 광원으로 밤 장면 극적 향상
   * 성능: maxCount 제한 + 반경 120m 이내만, intensity 낮게
   */
  _buildLampLights(maxCount = 8) {
    // 가로등은 lampPosts 스폰 시 위치 등록이 없으므로
    // play 구역 안 격자 배치로 대체 (어차피 포인트 조명이 핵심)
    const tod = this.settings.timeOfDay;
    // 낮엔 조명이 안 보이므로 밤/노을 때만 강하게, 낮엔 약하게
    const intensity = tod === 'night' ? 1.4 : tod === 'dusk' ? 0.7 : 0.3;
    const lightColor = tod === 'night' ? 0xffdd88 : 0xffeeaa;

    const positions = [
      [-30, -30], [30, -30], [-30, 30], [30, 30],
      [0, -55], [0, 55], [-55, 0], [55, 0],
    ].slice(0, maxCount);

    for (const [lx, lz] of positions) {
      const ly = this.getHeight(lx, lz) + 4.8;
      const light = new THREE.PointLight(lightColor, intensity, 28, 1.5);
      light.position.set(lx, ly, lz);
      this.scene.add(light);
      this.objects.push(light);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 연못 추가 소품 ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnFishingHuts(count) {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x882200, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._box(3, 2.5, 3, woodMat.clone(), 0, 1.25, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2, 4), roofMat.clone());
      roof.position.y = 3.5;
      g.add(roof);
      // 부두
      for (let j = 0; j < 5; j++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.5), woodMat.clone());
        plank.position.set(0, 0.05, j * 0.55 + 1.8);
        g.add(plank);
      }
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnWaterfalls(count) {
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x55aaff, transparent: true, opacity: 0.7, flatShading: true });
    const rockMat  = new THREE.MeshLambertMaterial({ color: 0x778877, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 600, z = (this._rng() - 0.5) * 600;
      const y = this.getHeight(x, z);
      const h = 5 + this._rng() * 8;
      const rock = new THREE.Mesh(new THREE.BoxGeometry(6, h, 4), rockMat.clone());
      rock.position.set(x, y + h * 0.5, z);
      const water = new THREE.Mesh(new THREE.BoxGeometry(3, h, 0.4), waterMat.clone());
      water.position.set(x, y + h * 0.5, z + 2.2);
      this.scene.add(rock, water);
      this.objects.push(rock, water);
    }
  }

  _spawnSteppingStones(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x999988, flatShading: true });
    for (let i = 0; i < count; i++) {
      const startX = (this._rng() - 0.5) * 500;
      const startZ = (this._rng() - 0.5) * 500;
      const angle  = this._rng() * Math.PI * 2;
      for (let j = 0; j < 8; j++) {
        const sx = startX + Math.cos(angle) * j * 1.5;
        const sz = startZ + Math.sin(angle) * j * 1.5;
        const sy = this.getHeight(sx, sz);
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + this._rng()*0.3, 0.7, 0.25, 7), mat.clone());
        stone.position.set(sx, sy + 0.12, sz);
        stone.rotation.y = this._rng() * 6.28;
        this.scene.add(stone); this.objects.push(stone);
      }
    }
  }

  _spawnBoatHouses(count) {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a5522 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x3355aa, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 600, z = (this._rng() - 0.5) * 600;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._box(6, 3, 5, woodMat.clone(), 0, 1.5, 0));
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 4, 3, 4), roofMat.clone());
      roof.position.y = 4;
      g.add(roof);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnReedBeds(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x7a9a44 });
    for (let i = 0; i < count; i++) {
      const cx = (this._rng() - 0.5) * 700, cz = (this._rng() - 0.5) * 700;
      const n = 10 + Math.floor(this._rng() * 12);
      for (let j = 0; j < n; j++) {
        const ox = (this._rng() - 0.5) * 4, oz = (this._rng() - 0.5) * 4;
        const x = cx + ox, z = cz + oz;
        const y = this.getHeight(x, z);
        const h = 1.5 + this._rng() * 1;
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, h, 4), mat.clone());
        reed.position.set(x, y + h * 0.5, z);
        reed.rotation.z = (this._rng() - 0.5) * 0.2;
        this.scene.add(reed); this.objects.push(reed);
      }
    }
  }

  _spawnWaterMill() {
    const x = (this._rng() - 0.5) * 300, z = (this._rng() - 0.5) * 300;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x999988, flatShading: true });
    g.add(this._cyl(2.5, 3, 8, 8, stoneMat.clone(), 0, 4, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 3.5, 8), woodMat.clone());
    roof.position.y = 9.5;
    g.add(roof);
    // 물레방아 날개
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.2), woodMat.clone());
      blade.position.set(Math.cos(a) * 2.2, 3 + Math.sin(a) * 2.2, 3.2);
      blade.rotation.z = a;
      g.add(blade);
    }
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
  }

  _spawnDuckSigns(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffee00 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.07, 0.08, 1.8, 5, new THREE.MeshLambertMaterial({ color: 0x8b6333 }), 0, 0.9, 0));
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.08), mat.clone());
      sign.position.y = 1.8;
      g.add(sign);
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnLanterns(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffaa22, emissive: 0xff8800, emissiveIntensity: 0.6 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.08, 0.09, 3, 5, new THREE.MeshLambertMaterial({ color: 0x333333 }), 0, 1.5, 0));
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), mat.clone());
      lamp.position.y = 3.4;
      g.add(lamp);
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 해양 추가 소품 ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnLighthouse() {
    const x = 200, z = 200;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const wMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const rMat = new THREE.MeshLambertMaterial({ color: 0xff3333 });
    const yMat = new THREE.MeshLambertMaterial({ color: 0xffdd00, emissive: 0xffbb00, emissiveIntensity: 0.8 });
    // 탑 (흰/빨 줄무늬)
    for (let j = 0; j < 5; j++) {
      g.add(this._cyl(2.2 - j * 0.2, 2.4 - j * 0.2, 5, 10, j % 2 === 0 ? wMat.clone() : rMat.clone(), 0, 2.5 + j * 5, 0));
    }
    // 등대 등
    const light = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), yMat);
    light.position.y = 30;
    g.add(light);
    // 난간
    g.add(this._cyl(2.6, 2.6, 0.4, 12, new THREE.MeshLambertMaterial({ color: 0x666666 }), 0, 27.5, 0));
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
    this._obstacles.push({ x, z, r: 2.6 }); // 등대 기단 반경
  }

  _spawnShipwrecks(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a, flatShading: true });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0x335588, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 선체
      g.add(this._box(20, 4, 7, mat.clone(), 0, 2, 0));
      g.add(this._box(16, 3, 5, mat2.clone(), 0, 4.5, 0));
      // 부서진 돛대
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 6), mat.clone());
      mast.position.set(-3, 4, 0);
      mast.rotation.z = 0.5;
      g.add(mast);
      g.position.set(x, y + 1.5, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      g.rotation.z = (this._rng() - 0.5) * 0.4;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnSeaweedForest(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a7a2a, side: THREE.DoubleSide, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900, z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const h = 2 + this._rng() * 4;
      const seaweed = new THREE.Mesh(new THREE.PlaneGeometry(0.5, h), mat.clone());
      seaweed.position.set(x, y + h * 0.5, z);
      seaweed.rotation.y = this._rng() * 6.28;
      seaweed.rotation.z = (this._rng() - 0.5) * 0.4;
      this.scene.add(seaweed); this.objects.push(seaweed);
    }
  }

  _spawnAnchors(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.1, 0.12, 3, 6, mat.clone(), 0, 1.5, 0));
      g.add(this._box(2, 0.2, 0.2, mat.clone(), 0, 0.6, 0));
      g.position.set(x, y, z);
      g.rotation.z = (this._rng() - 0.5) * 0.6;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnBeachHuts(count) {
    const colors = [0xff6633, 0x3366ff, 0x33aa33, 0xffcc00, 0xff3399];
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const c = colors[i % colors.length];
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const roofMat = new THREE.MeshLambertMaterial({ color: c, flatShading: true });
      g.add(this._box(3, 2, 3, bodyMat.clone(), 0, 1, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.5, 4), roofMat.clone());
      roof.position.y = 2.75;
      g.add(roof);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnLifePreservers(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xff4400 });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.08, 0.09, 2, 5, new THREE.MeshLambertMaterial({ color: 0x888888 }), 0, 1, 0));
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        const seg = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 5, 10, Math.PI * 0.48), j % 2 === 0 ? mat.clone() : mat2.clone());
        seg.position.set(0, 2.1, 0);
        seg.rotation.y = a;
        g.add(seg);
      }
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnPiers(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 500, z = (this._rng() - 0.5) * 500;
      const y = this.getHeight(x, z);
      const len = 20 + this._rng() * 30;
      const angle = this._rng() * Math.PI * 2;
      for (let j = 0; j < 16; j++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 1.2), mat.clone());
        plank.position.set(x + Math.cos(angle) * j * 1.3, y + 0.5, z + Math.sin(angle) * j * 1.3);
        this.scene.add(plank); this.objects.push(plank);
      }
    }
  }

  _spawnDriftwood(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xccbbaa, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900, z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const len = 2 + this._rng() * 5;
      const dw = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, len, 6), mat.clone());
      dw.position.set(x, y + 0.2, z);
      dw.rotation.z = Math.PI / 2 + (this._rng() - 0.5) * 0.5;
      dw.rotation.y = this._rng() * Math.PI;
      this.scene.add(dw); this.objects.push(dw);
    }
  }

  _spawnTidePools(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x1166aa, transparent: true, opacity: 0.7 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const r = 2 + this._rng() * 4;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 12), mat.clone());
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, y + 0.05, z);
      this.scene.add(pool); this.objects.push(pool);
    }
  }

  _spawnSeaStacks(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x887766, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const h = 10 + this._rng() * 20;
      const r = 2 + this._rng() * 3;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r, h, 7), mat.clone());
      stack.position.set(x, y + h * 0.5, z);
      stack.rotation.y = this._rng() * 6.28;
      this.scene.add(stack); this.objects.push(stack);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 사바나 추가 소품 ─────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnAfricanHuts(count) {
    const mat1 = new THREE.MeshLambertMaterial({ color: 0xcc9966, flatShading: true });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0xaa7733, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(3.5, 4, 3, 10, mat1.clone(), 0, 1.5, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 3.5, 10), mat2.clone());
      roof.position.y = 4.25;
      g.add(roof);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnBaobabTrees(count) {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0xaa8855, flatShading: true });
    const leafMat  = new THREE.MeshLambertMaterial({ color: 0x4a7a1a, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const h = 8 + this._rng() * 6;
      const r = 2 + this._rng() * 1.5;
      g.add(this._cyl(r * 0.6, r, h, 8, trunkMat.clone(), 0, h * 0.5, 0));
      // 가지들
      for (let b = 0; b < 5; b++) {
        const ba = (b / 5) * Math.PI * 2;
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 5, 6), trunkMat.clone());
        branch.position.set(Math.cos(ba) * 2, h + 1, Math.sin(ba) * 2);
        branch.rotation.z = Math.cos(ba) * 0.6;
        branch.rotation.x = Math.sin(ba) * 0.6;
        g.add(branch);
        const clump = new THREE.Mesh(new THREE.SphereGeometry(1.8, 6, 5), leafMat.clone());
        clump.position.set(Math.cos(ba) * 4.5, h + 2, Math.sin(ba) * 4.5);
        g.add(clump);
      }
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnAnimalSkulls(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xeeddcc, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900, z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), mat.clone());
      skull.scale.set(1.3, 1, 1.1);
      skull.position.y = 0.5;
      g.add(skull);
      // 뿔 (소 해골)
      for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.5, 5), mat.clone());
        horn.position.set(sx * 0.6, 0.7, 0);
        horn.rotation.z = sx * -0.7;
        horn.rotation.x = -0.3;
        g.add(horn);
      }
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnSafariJeepWrecks(count) {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x557722, flatShading: true });
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._box(5, 2, 2.5, bodyMat.clone(), 0, 1.2, 0));
      g.add(this._box(3, 1.2, 2.2, bodyMat.clone(), -0.3, 2.5, 0));
      for (const [wx, wz] of [[-1.8,-1.3],[-1.8,1.3],[1.8,-1.3],[1.8,1.3]]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.3, 5, 12), tireMat.clone());
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(wx, 0.65, wz);
        g.add(wheel);
      }
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      g.rotation.z = (this._rng() - 0.5) * 0.3;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnRockArt(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x885533, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const h = 2 + this._rng() * 3;
      const rock = new THREE.Mesh(new THREE.BoxGeometry(4, h, 0.5), mat.clone());
      rock.position.set(x, y + h * 0.5, z);
      rock.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(rock); this.objects.push(rock);
    }
  }

  _spawnKraalFence(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    for (let i = 0; i < count; i++) {
      const cx = (this._rng() - 0.5) * 600, cz = (this._rng() - 0.5) * 600;
      const r = 15 + this._rng() * 10;
      const n = 24;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        const y = this.getHeight(x, z);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.8, 5), mat.clone());
        post.position.set(x, y + 0.9, z);
        this.scene.add(post); this.objects.push(post);
      }
    }
  }

  _spawnDustDevils(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xddbb88, transparent: true, opacity: 0.3 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const h = 5 + this._rng() * 10;
      const spiral = new THREE.Mesh(new THREE.ConeGeometry(1.5, h, 8, 1, true), mat.clone());
      spiral.position.set(x, y + h * 0.5, z);
      this.scene.add(spiral); this.objects.push(spiral);
    }
  }

  _spawnSavannaGrass(count, spread) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xbbaa44, side: THREE.DoubleSide });
    const dummy = new THREE.Object3D();
    const geo = new THREE.PlaneGeometry(0.15, 0.8);
    const inst = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * spread * 2;
      const z = (this._rng() - 0.5) * spread * 2;
      const y = this.getHeight(x, z);
      dummy.position.set(x, y + 0.4, z);
      dummy.rotation.y = this._rng() * 6.28;
      dummy.rotation.z = (this._rng() - 0.5) * 0.5;
      dummy.scale.setScalar(0.8 + this._rng() * 1.2);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst); this.objects.push(inst);
  }

  // ════════════════════════════════════════════════════════════════
  // ── 숲 추가 소품 ─────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnLogCabin() {
    const x = (this._rng() - 0.5) * 200, z = (this._rng() - 0.5) * 200;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const logMat = new THREE.MeshLambertMaterial({ color: 0x6b3a1f, flatShading: true });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x443322, flatShading: true });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x999988, flatShading: true });
    // 통나무 벽
    for (let j = 0; j < 6; j++) {
      g.add(this._cyl(0.4, 0.4, 10, 7, logMat.clone(), 0, 0.8 + j * 0.8, 5));
      g.add(this._cyl(0.4, 0.4, 10, 7, logMat.clone(), 0, 0.8 + j * 0.8, -5));
    }
    for (let j = 0; j < 6; j++) {
      const lc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 7), logMat.clone());
      lc.rotation.y = Math.PI / 2;
      lc.position.set(0, 0.8 + j * 0.8, 0);
      g.add(lc);
    }
    // 지붕
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 12), roofMat.clone());
    roof.rotation.z = 0.5;
    roof.position.set(-1.5, 7, 0);
    g.add(roof);
    const roof2 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 12), roofMat.clone());
    roof2.rotation.z = -0.5;
    roof2.position.set(1.5, 7, 0);
    g.add(roof2);
    // 굴뚝
    g.add(this._cyl(0.5, 0.6, 4, 5, stoneMat.clone(), 2, 9, -2));
    g.position.set(x, y, z);
    g.rotation.y = this._rng() * Math.PI * 2;
    this.scene.add(g); this.objects.push(g);
  }

  _spawnForestShrine(count) {
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888877, flatShading: true });
    const mossMat  = new THREE.MeshLambertMaterial({ color: 0x3a6a3a });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 기단
      g.add(this._box(4, 0.5, 4, stoneMat.clone(), 0, 0.25, 0));
      // 기둥 2개
      for (const px of [-1.4, 1.4]) {
        g.add(this._cyl(0.25, 0.28, 4, 6, stoneMat.clone(), px, 2.2, 0));
      }
      // 상단 도리
      g.add(this._box(4.5, 0.4, 0.5, stoneMat.clone(), 0, 4.5, 0));
      // 이끼
      const moss = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), mossMat.clone());
      moss.position.set(0, 0.5, 0);
      g.add(moss);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnTreeHouses(count) {
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x553311, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 지지 기둥 (나무)
      g.add(this._cyl(0.4, 0.5, 8, 7, new THREE.MeshLambertMaterial({ color: 0x5c3d1e }), 0, 4, 0));
      // 집 본체 (위에 있음)
      g.add(this._box(4, 2.5, 3.5, woodMat.clone(), 0, 9, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2.5, 4), roofMat.clone());
      roof.position.y = 11.5;
      g.add(roof);
      // 사다리
      for (let j = 0; j < 6; j++) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 4), woodMat.clone());
        rung.rotation.z = Math.PI / 2;
        rung.position.set(2.5, 2 + j * 1.2, 0);
        g.add(rung);
      }
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnVineBridges(count) {
    const vineMat = new THREE.MeshLambertMaterial({ color: 0x4a7a1a });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 600, z = (this._rng() - 0.5) * 600;
      const y = this.getHeight(x, z);
      const len = 12 + this._rng() * 8;
      for (let j = 0; j < 10; j++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), woodMat.clone());
        plank.position.set(x, y + 4 + Math.sin((j / 9) * Math.PI) * -1, z - len * 0.5 + j * (len / 9));
        this.scene.add(plank); this.objects.push(plank);
      }
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, len, 6), vineMat.clone());
      vine.rotation.z = Math.PI / 2;
      vine.position.set(x + 1, y + 5, z);
      this.scene.add(vine); this.objects.push(vine);
    }
  }

  _spawnAbandonedWell(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x888877, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(1.2, 1.3, 1.2, 10, mat.clone(), 0, 0.6, 0));
      g.add(this._cyl(0.06, 0.08, 2.5, 5, new THREE.MeshLambertMaterial({ color: 0x8b6333 }), -1.1, 1.8, 0));
      g.add(this._cyl(0.06, 0.08, 2.5, 5, new THREE.MeshLambertMaterial({ color: 0x8b6333 }), 1.1, 1.8, 0));
      g.add(this._box(2.5, 0.18, 0.2, new THREE.MeshLambertMaterial({ color: 0x8b6333 }), 0, 3.2, 0));
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnFirePits(count) {
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888877, flatShading: true });
    const emberMat = new THREE.MeshLambertMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.8 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 돌 고리
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2;
        const stone = new THREE.Mesh(new THREE.SphereGeometry(0.3, 5, 4), stoneMat.clone());
        stone.position.set(Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9);
        g.add(stone);
      }
      // 불씨
      const embers = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), emberMat);
      embers.position.y = 0.3;
      g.add(embers);
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnMushroomRings(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xff2222, flatShading: true });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xeeddcc });
    for (let i = 0; i < count; i++) {
      const cx = (this._rng() - 0.5) * 700, cz = (this._rng() - 0.5) * 700;
      const r = 4 + this._rng() * 5;
      const n = 8 + Math.floor(this._rng() * 6);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const y = this.getHeight(x, z);
        const h = 0.6 + this._rng() * 0.6;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, h, 5), stemMat.clone());
        stem.position.set(x, y + h * 0.5, z);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.clone());
        cap.rotation.x = Math.PI;
        cap.position.set(x, y + h + 0.1, z);
        this.scene.add(stem, cap);
        this.objects.push(stem, cap);
      }
    }
  }

  _spawnTreeHollows(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900, z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const h = 4 + this._rng() * 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, h, 7), mat.clone());
      trunk.position.set(x, y + h * 0.5, z);
      const hollow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      hollow.position.set(x, y + 1.5, z - 0.7);
      hollow.rotation.x = Math.PI / 2;
      this.scene.add(trunk, hollow);
      this.objects.push(trunk, hollow);
    }
  }

  _spawnForestSigns(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b6333 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.1, 0.12, 2.5, 5, mat.clone(), 0, 1.25, 0));
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.12), new THREE.MeshLambertMaterial({ color: 0xddcc88 }));
      board.position.y = 2.5;
      g.add(board);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnHangingLanterns(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xff9900, emissive: 0xff6600, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const h = 4 + this._rng() * 3;
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), mat.clone());
      lantern.position.set(x, y + h, z);
      this.scene.add(lantern); this.objects.push(lantern);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 공룡섬 추가 소품 ─────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnDinoEggsNests(count) {
    const eggMat = new THREE.MeshLambertMaterial({ color: 0xddcc88, flatShading: true });
    const nestMat = new THREE.MeshLambertMaterial({ color: 0x6a5a2a });
    for (let i = 0; i < count; i++) {
      const cx = (this._rng() - 0.5) * 700, cz = (this._rng() - 0.5) * 700;
      const y = this.getHeight(cx, cz);
      // 둥지
      const nest = new THREE.Mesh(new THREE.TorusGeometry(2, 0.5, 5, 12), nestMat.clone());
      nest.rotation.x = -Math.PI / 2;
      nest.position.set(cx, y + 0.3, cz);
      this.scene.add(nest); this.objects.push(nest);
      // 알 3-5개
      const n = 3 + Math.floor(this._rng() * 3);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        const ex = cx + Math.cos(a) * 1.2, ez = cz + Math.sin(a) * 1.2;
        const egg = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 6), eggMat.clone());
        egg.scale.y = 1.4;
        egg.position.set(ex, y + 0.5, ez);
        egg.rotation.x = (this._rng() - 0.5) * 0.4;
        this.scene.add(egg); this.objects.push(egg);
      }
    }
  }

  _spawnPrehistoricTemple() {
    const x = 0, z = 100;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888866, flatShading: true });
    const mossMat  = new THREE.MeshLambertMaterial({ color: 0x3a5a1a });
    // 계단식 피라미드
    for (let lev = 0; lev < 5; lev++) {
      const s = 20 - lev * 3.5;
      const h = 4;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), stoneMat.clone());
      tier.position.y = 2 + lev * h;
      g.add(tier);
    }
    // 꼭대기 구조물
    g.add(this._cyl(2.5, 3, 6, 8, stoneMat.clone(), 0, 26, 0));
    // 기둥들
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      g.add(this._cyl(0.8, 0.9, 12, 7, stoneMat.clone(), Math.cos(a) * 14, 6, Math.sin(a) * 14));
    }
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
  }

  _spawnLavaPools(count) {
    const lavaMat = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 });
    const rimMat  = new THREE.MeshLambertMaterial({ color: 0x332211, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const r = 4 + this._rng() * 8;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 14), lavaMat.clone());
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, y + 0.1, z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.5, 0.8, 5, 14), rimMat.clone());
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(x, y + 0.2, z);
      this.scene.add(pool, rim);
      this.objects.push(pool, rim);
    }
  }

  _spawnCaveEntrances(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x221a11, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const h = 6 + this._rng() * 6;
      const w = 5 + this._rng() * 4;
      const g = new THREE.Group();
      // 외벽 절벽
      g.add(this._box(w * 2.5, h * 1.5, 4, new THREE.MeshLambertMaterial({ color: 0x443322, flatShading: true }), 0, h * 0.75, 0));
      // 입구 어둠
      g.add(this._box(w, h, 1.5, mat.clone(), 0, h * 0.5, 0.8));
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnTarPits(count) {
    const tarMat = new THREE.MeshLambertMaterial({ color: 0x111111, transparent: true, opacity: 0.88 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const r = 5 + this._rng() * 8;
      const pit = new THREE.Mesh(new THREE.CircleGeometry(r, 14), tarMat.clone());
      pit.rotation.x = -Math.PI / 2;
      pit.position.set(x, y + 0.05, z);
      // 빠진 뼈 (절반 잠긴)
      const boneMat = new THREE.MeshLambertMaterial({ color: 0xddddcc, flatShading: true });
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 4, 6), boneMat);
      bone.position.set(x + 1.5, y + 0.2, z);
      bone.rotation.z = 0.7;
      this.scene.add(pit, bone);
      this.objects.push(pit, bone);
    }
  }

  _spawnStoneCircles(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x999988, flatShading: true });
    for (let i = 0; i < count; i++) {
      const cx = (this._rng() - 0.5) * 700, cz = (this._rng() - 0.5) * 700;
      const r = 12 + this._rng() * 8;
      const n = 10 + Math.floor(this._rng() * 6);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const y = this.getHeight(x, z);
        const h = 3 + this._rng() * 4;
        const stone = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1), mat.clone());
        stone.position.set(x, y + h * 0.5, z);
        stone.rotation.y = a;
        this.scene.add(stone); this.objects.push(stone);
      }
    }
  }

  _spawnPrehistoricTrees(count) {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a, flatShading: true });
    const leafMat  = new THREE.MeshLambertMaterial({ color: 0x1a5a1a, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const h = 10 + this._rng() * 8;
      const g = new THREE.Group();
      g.add(this._cyl(0.8, 1.2, h, 7, trunkMat.clone(), 0, h * 0.5, 0));
      // 거대 잎 뭉치
      const clump = new THREE.Mesh(new THREE.SphereGeometry(4, 7, 5), leafMat.clone());
      clump.scale.set(1, 0.6, 1);
      clump.position.y = h + 2;
      g.add(clump);
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnDinoSkeleton(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xeeddbb, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      // 척추
      g.add(this._cyl(0.5, 0.6, 15, 7, mat.clone(), 0, 1, 0));
      g.rotation.z = Math.PI / 2;
      // 두개골
      const skull = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 4), mat.clone());
      skull.position.set(8, 0, 0);
      g.add(skull);
      // 갈비뼈
      for (let r = 0; r < 5; r++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.2, 4, 8, Math.PI), mat.clone());
        rib.position.set(-r * 2 + 2, 0, 0);
        rib.rotation.y = Math.PI / 2;
        g.add(rib);
      }
      g.position.set(x, y + 1, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // ── 우주 추가 소품 ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  _spawnSpaceStation() {
    const x = 100, z = -150;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x889999, flatShading: true });
    const solarMat = new THREE.MeshLambertMaterial({ color: 0x224488, flatShading: true });
    // 중앙 모듈
    g.add(this._cyl(4, 4, 12, 8, metalMat.clone(), 0, 6, 0));
    g.add(this._box(8, 4, 4, metalMat.clone(), 0, 12, 0));
    // 태양광 패널
    for (const px of [-14, 14]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 5), solarMat.clone());
      panel.position.set(px, 12, 0);
      g.add(panel);
    }
    // 연결 튜브
    g.add(this._cyl(1.5, 1.5, 10, 8, metalMat.clone(), 0, 9, 0));
    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
  }

  _spawnCrashedSpaceship(count) {
    const mat1 = new THREE.MeshLambertMaterial({ color: 0x556677, flatShading: true });
    const mat2 = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.4 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(4, 2, 12, 8, mat1.clone(), 0, 4, 0));
      g.add(this._cyl(5, 5, 1.5, 14, mat1.clone(), 0, 1.5, 0));
      // 엔진 화염 잔해
      const flame = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 7), mat2.clone());
      flame.position.set(0, -1, 3);
      flame.rotation.x = Math.PI / 4;
      g.add(flame);
      g.position.set(x, y, z);
      g.rotation.set((this._rng() - 0.5) * 0.8, this._rng() * Math.PI * 2, (this._rng() - 0.5) * 0.5);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnMoonRover(count) {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xccbbaa, flatShading: true });
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 600, z = (this._rng() - 0.5) * 600;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._box(4, 1.5, 2.5, bodyMat.clone(), 0, 1, 0));
      // 바퀴 4개
      for (const [wx, wz] of [[-1.8,-1.4],[-1.8,1.4],[1.8,-1.4],[1.8,1.4]]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.25, 6, 10), tireMat.clone());
        wheel.rotation.y = Math.PI / 2;
        wheel.position.set(wx, 0.6, wz);
        g.add(wheel);
      }
      // 안테나
      g.add(this._cyl(0.06, 0.08, 2, 5, bodyMat.clone(), 0.5, 2, 0));
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), bodyMat.clone());
      dish.position.set(0.5, 3.2, 0);
      dish.rotation.x = Math.PI;
      g.add(dish);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnSatelliteDishes(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xcccccc, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      g.add(this._cyl(0.2, 0.25, 3, 6, mat.clone(), 0, 1.5, 0));
      const dish = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.clone());
      dish.position.set(0, 4, 0);
      dish.rotation.x = Math.PI;
      dish.rotation.z = -0.5;
      g.add(dish);
      g.position.set(x, y, z);
      g.rotation.y = this._rng() * Math.PI * 2;
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnAlienCropCircles(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x44ff88, emissive: 0x22aa44, emissiveIntensity: 0.3 });
    for (let i = 0; i < count; i++) {
      const cx = (this._rng() - 0.5) * 700, cz = (this._rng() - 0.5) * 700;
      const cy = this.getHeight(cx, cz);
      for (let j = 0; j < 3; j++) {
        const r = 8 + j * 5;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 4, 40), mat.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(cx, cy + 0.15, cz);
        this.scene.add(ring); this.objects.push(ring);
      }
    }
  }

  _spawnSpaceCrates(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x556655, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = this.getHeight(x, z);
      const s = 0.8 + this._rng() * 1.5;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s * 2, s, s * 2), mat.clone());
      crate.position.set(x, y + s * 0.5, z);
      crate.rotation.y = this._rng() * Math.PI;
      this.scene.add(crate); this.objects.push(crate);
    }
  }

  _spawnCommunicationTower(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xaa9988, flatShading: true });
    const lightMat = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.0 });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 700, z = (this._rng() - 0.5) * 700;
      const y = this.getHeight(x, z);
      const g = new THREE.Group();
      const h = 20 + this._rng() * 10;
      g.add(this._cyl(0.5, 2, h, 4, mat.clone(), 0, h * 0.5, 0));
      // 경고등
      const wl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), lightMat.clone());
      wl.position.y = h + 0.5;
      g.add(wl);
      // 버팀대
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * Math.PI * 2;
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h * 0.7, 4), mat.clone());
        brace.position.set(Math.cos(a) * 4, h * 0.35, Math.sin(a) * 4);
        brace.rotation.z = Math.cos(a) * 0.5;
        brace.rotation.x = Math.sin(a) * 0.5;
        g.add(brace);
      }
      g.position.set(x, y, z);
      this.scene.add(g); this.objects.push(g);
    }
  }

  _spawnMeteorField(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x554433, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 900, z = (this._rng() - 0.5) * 900;
      const y = this.getHeight(x, z);
      const r = 1 + this._rng() * 4;
      const meteor = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat.clone());
      meteor.position.set(x, y + r * 0.6 + this._rng() * 5, z);
      meteor.rotation.set(this._rng() * 3.14, this._rng() * 6.28, this._rng() * 3.14);
      this.scene.add(meteor); this.objects.push(meteor);
    }
  }

  _spawnNebulaClouds(count) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x882288, transparent: true, opacity: 0.15, flatShading: true });
    for (let i = 0; i < count; i++) {
      const x = (this._rng() - 0.5) * 800, z = (this._rng() - 0.5) * 800;
      const y = 20 + this._rng() * 80;
      const r = 20 + this._rng() * 40;
      const nebula = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat.clone());
      nebula.position.set(x, y, z);
      this.scene.add(nebula); this.objects.push(nebula);
    }
  }

  // ── 날씨 ──────────────────────────────────────────────────────
  _buildRain() {
    const count  = 6000;
    const pos    = new Float32Array(count * 3);
    // 개별 속도 변이 (빗줄기마다 다른 낙하 속도)
    this._rainSpeeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (this._rng() - 0.5) * 220;
      pos[i * 3 + 1] = this._rng() * 65;
      pos[i * 3 + 2] = (this._rng() - 0.5) * 220;
      this._rainSpeeds[i] = 22 + this._rng() * 16; // 22~38 m/s 랜덤
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9ab0d8, size: 0.18, transparent: true, opacity: 0.55,
    }));
    this.scene.add(this.rain);
    this.objects.push(this.rain);

    // 번개 주기 타이머
    this._lightningTimer = 4 + this._rng() * 6; // 4~10초마다 첫 번개
    this._lightningFlash = null; // 번개 조명 노드
  }

  _buildSnow() {
    const count = 2000;
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (this._rng() - 0.5) * 200;
      pos[i * 3 + 1] = this._rng() * 40;
      pos[i * 3 + 2] = (this._rng() - 0.5) * 200;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22 }));
    this.scene.add(this.snow);
    this.objects.push(this.snow);
  }

  /** 번개 플래시: 강한 흰색 PointLight + HUD 화면 플래시 */
  _triggerLightning() {
    if (!this.scene) return;
    // 3D 번개 조명 (하늘 위 랜덤 위치)
    const light = new THREE.PointLight(0xddeeff, 80, 800);
    light.position.set(
      (Math.random() - 0.5) * 200,
      120 + Math.random() * 80,
      (Math.random() - 0.5) * 200
    );
    this.scene.add(light);
    // 2단 플래시: 밝게 → 잠깐 어둡게 → 다시 밝게 → 소멸
    setTimeout(() => { light.intensity = 20;  }, 60);
    setTimeout(() => { light.intensity = 60;  }, 100);
    setTimeout(() => { light.intensity = 0; this.scene?.remove(light); light.dispose?.(); }, 220);

    // 화면 HUD 플래시 (CSS)
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:rgba(200,220,255,0.22);pointer-events:none;z-index:25;';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 180);
  }

  // ── 게임 루프 업데이트 ────────────────────────────────────────
  update(delta) {
    // ── 비 (풍향 드리프트 + 번개) ──────────────────────────
    if (this.rain) {
      const pos    = this.rain.geometry.attributes.position;
      const speeds = this._rainSpeeds;
      const WIND_X = -6;   // 바람 방향 (x축 드리프트)
      const WIND_Z =  3;
      const n = pos.count;
      for (let i = 0; i < n; i++) {
        const spd = speeds ? speeds[i] : 28;
        let y = pos.getY(i) - spd * delta;
        let x = pos.getX(i) + WIND_X * delta;
        let z = pos.getZ(i) + WIND_Z * delta;
        if (y < 0)    { y = 65; }
        if (x < -110) { x = 110; }
        if (x >  110) { x = -110; }
        if (z < -110) { z = 110; }
        if (z >  110) { z = -110; }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;

      // 번개 타이머
      if (this._lightningTimer !== undefined) {
        this._lightningTimer -= delta;
        if (this._lightningTimer <= 0) {
          this._triggerLightning();
          this._lightningTimer = 6 + this._rng() * 10; // 6~16초 후 다음 번개
        }
      }
    }
    // ── 눈 ─────────────────────────────────────────────────
    if (this.snow) {
      this._snowTime = (this._snowTime ?? 0) + delta;
      const t = this._snowTime;
      const pos = this.snow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 3.5 * delta;
        let x = pos.getX(i) + Math.sin(t * 0.8 + i * 0.37) * 0.05;
        let z = pos.getZ(i) + Math.cos(t * 0.6 + i * 0.19) * 0.03;
        if (y < 0) y = 40;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }
    // ── 대기 파티클 (꽃가루/먼지) ─────────────────────────
    if (this._pollens && this._pollenData.length > 0) {
      this._pollenTimer += delta;
      const dummy = this._pollenDummy;
      const n = this._pollenData.length;
      for (let i = 0; i < n; i++) {
        const p = this._pollenData[i];
        // 천천히 상승, 약간의 좌우 흔들림
        p.y  += p.speed * delta;
        p.x  += Math.sin(this._pollenTimer * 0.7 + i) * 0.012;
        p.z  += Math.cos(this._pollenTimer * 0.5 + i * 0.7) * 0.009;
        // 최대 높이 초과 시 아래로 리셋
        if (p.y > p.maxY) {
          p.y = 0.2;
          p.x = (Math.random() - 0.5) * p.spread;
          p.z = (Math.random() - 0.5) * p.spread;
        }
        dummy.position.set(p.x, p.y, p.z);
        dummy.updateMatrix();
        this._pollens.setMatrixAt(i, dummy.matrix);
      }
      this._pollens.instanceMatrix.needsUpdate = true;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ── 구역 시스템 — WaveSystem 스폰 연동 ───────────────────────────
  // ══════════════════════════════════════════════════════════════════

  /** 좌표 → 구역 ('safe' | 'transition' | 'danger') */
  getZoneAt(x, z) {
    const d = Math.hypot(x, z);
    if (d < this._zones.safe)       return 'safe';
    if (d < this._zones.transition) return 'transition';
    return 'danger';
  }

  /**
   * 생물 타입별 권장 스폰 위치 반환
   * WaveSystem의 new Creature() 호출 전에 사용
   */
  getSpawnPosition(creatureType) {
    const rng = this._rng;
    // 생물 타입 → 선호 구역 매핑
    const zoneMap = {
      // 공원 소형 — 안전/전환 구역
      dragonfly: 'transition', butterfly: 'safe', ladybug: 'safe',
      bee: 'transition', grasshopper: 'transition', cricket: 'transition',
      // 연못 — 전환 구역 (물가)
      frog: 'transition', tadpole: 'transition', water_strider: 'transition',
      crucian: 'transition', crayfish: 'transition',
      // 바다 — 전환/위험
      crab: 'transition', shark: 'danger', giant_shark: 'danger',
      octopus: 'transition', jellyfish: 'transition',
      // 사바나 — 위험 (초원)
      zebra: 'transition', hyena: 'danger', cheetah: 'danger',
      ostrich: 'transition', croc: 'danger',
      // 숲 — 위험
      jaguar: 'danger', cobra: 'danger', spider: 'transition',
      // 공룡섬 — 랜드마크 주변
      t_rex: 'danger', raptor: 'danger', pteranodon: 'danger',
      triceratops: 'danger', stegosaurus: 'transition',
    };

    const zone = zoneMap[creatureType] || 'transition';
    const { safe, transition, danger } = this._zones;
    let minR, maxR;
    if (zone === 'safe')       { minR = 10;         maxR = safe; }
    else if (zone === 'transition') { minR = safe;  maxR = transition; }
    else                       { minR = transition; maxR = danger; }

    // 랜드마크 주변에 희귀 생물 클러스터 (30% 확률)
    if (this._zones.landmarks.length > 0 && rng() < 0.3) {
      const lm = this._zones.landmarks[Math.floor(rng() * this._zones.landmarks.length)];
      return {
        x: lm.x + (rng() - 0.5) * 30,
        z: lm.z + (rng() - 0.5) * 30,
      };
    }

    // 구역 내 랜덤 위치 (각도 기반)
    let tries = 0;
    while (tries++ < 40) {
      const a = rng() * Math.PI * 2;
      const r = minR + rng() * (maxR - minR);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < SPAWN_HALF && Math.abs(z) < SPAWN_HALF) return { x, z };
    }
    return { x: (rng()-0.5) * SPAWN_HALF * 1.5, z: (rng()-0.5) * SPAWN_HALF * 1.5 };
  }

  dispose() {
    // geometry + material 완전 해제 (scene.remove 만으로는 GPU 메모리 미해제)
    for (const obj of this.objects) {
      this.scene.remove(obj);
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) { m?.map?.dispose(); m?.dispose(); }
      }
      // Light 는 geometry/material 없음 — remove 만으로 충분
    }
    this.objects = [];
  }

  // ══════════════════════════════════════════════════════════════════
  // ── 원경 실루엣 — 맵 어디서나 보이는 배경 깊이감 ────────────────
  // ══════════════════════════════════════════════════════════════════
  _spawnDistantSilhouettes(biome) {
    const rng = this._rng;
    const configs = {
      park:      { color: 0x1a4422, shapes: 'cone',    count: 10, hRange: [18, 40] },
      pond:      { color: 0x1a3a22, shapes: 'cone',    count: 8,  hRange: [12, 28] },
      ocean:     { color: 0x334455, shapes: 'cliff',   count: 12, hRange: [20, 55] },
      savanna:   { color: 0x3a2a0a, shapes: 'flat',    count: 10, hRange: [8,  20] },
      forest:    { color: 0x0f2a10, shapes: 'cone',    count: 14, hRange: [30, 65] },
      dino:      { color: 0x221a0a, shapes: 'jagged',  count: 12, hRange: [40, 90] },
      space:     { color: 0x110022, shapes: 'rock',    count: 8,  hRange: [15, 35] },
    };
    const cfg = configs[biome] || configs.park;
    const mat = new THREE.MeshLambertMaterial({ color: cfg.color, flatShading: true });

    for (let i = 0; i < cfg.count; i++) {
      const a = (i / cfg.count) * Math.PI * 2 + (rng()-0.5) * 0.4;
      const r = MAP_HALF * (0.82 + rng() * 0.12);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = cfg.hRange[0] + rng() * (cfg.hRange[1] - cfg.hRange[0]);
      const y = this.getHeight(x, z);
      let sil;
      if (cfg.shapes === 'cliff') {
        sil = new THREE.Mesh(new THREE.BoxGeometry(22 + rng()*18, h, 10 + rng()*8), mat.clone());
      } else if (cfg.shapes === 'flat') {
        sil = new THREE.Mesh(new THREE.CylinderGeometry(12 + rng()*8, 14 + rng()*6, h * 0.4, 8), mat.clone());
      } else if (cfg.shapes === 'jagged') {
        sil = new THREE.Mesh(new THREE.ConeGeometry(14 + rng()*10, h, 6), mat.clone());
      } else if (cfg.shapes === 'rock') {
        sil = new THREE.Mesh(new THREE.DodecahedronGeometry(h * 0.5, 0), mat.clone());
      } else { // cone
        sil = new THREE.Mesh(new THREE.ConeGeometry(8 + rng()*6, h, 5 + Math.floor(rng()*3)), mat.clone());
      }
      sil.position.set(x, y + h * 0.5, z);
      sil.rotation.y = rng() * Math.PI * 2;
      this.scene.add(sil);
      this.objects.push(sil);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ── 영웅 랜드마크 — 스케일 3× 과장, 맵 내비게이션 앵커 ──────────
  // ══════════════════════════════════════════════════════════════════

  /** 공원 중앙 대분수 (높이 9, 반지름 14) */
  _spawnHeroFountain() {
    const rng = this._rng;
    const x = (rng()-0.5) * 30, z = (rng()-0.5) * 30;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const stoneMat  = new THREE.MeshLambertMaterial({ color: 0xccbbaa, flatShading: true });
    const waterMat  = new THREE.MeshStandardMaterial({
      color: 0x44aaff, transparent: true, opacity: 0.82,
      emissive: 0x1177cc, emissiveIntensity: 0.5,
      roughness: 0.08, metalness: 0.25,
    });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0xeecc88, flatShading: true });
    // 3단 기반
    g.add(this._cyl(14, 12.5, 0.55, 18, stoneMat.clone(), 0, 0.28, 0));
    g.add(this._cyl(13, 13, 0.35, 18, waterMat.clone(), 0, 0.58, 0)); // 1단 물
    g.add(this._cyl(0.5, 0.6, 3.5, 8,  stoneMat.clone(), 0, 1.75, 0));
    g.add(this._cyl(6,   5.5, 0.45, 14, stoneMat.clone(), 0, 3.6,  0));
    g.add(this._cyl(5.5, 5.5, 0.28, 14, waterMat.clone(), 0, 3.85, 0)); // 2단 물
    g.add(this._cyl(0.4, 0.45, 3.5, 6, stoneMat.clone(), 0, 5.3,  0));
    g.add(this._cyl(2.5, 2.2, 0.35, 10, stoneMat.clone(), 0, 7.05, 0));
    g.add(this._cyl(2.3, 2.3, 0.22, 10, waterMat.clone(), 0, 7.28, 0)); // 3단 물
    // 꼭대기 조각상 (Nintendo 스타일 — 큰 구 + 뿔)
    const statue = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 7), accentMat.clone());
    statue.position.y = 9.0;
    g.add(statue);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 5), accentMat.clone());
    crown.position.y = 10.4;
    g.add(crown);
    // 물 발광 PointLight
    const wLight = new THREE.PointLight(0x44aaff, 2.8, 22);
    wLight.position.set(0, 1.5, 0);
    g.add(wLight);
    // 분수 주변 꽃밭 링
    const ringPts = ringSpawn(x, z, 16, 24, 0.15, rng);
    const fMat = new THREE.MeshLambertMaterial({ color: 0xff6688 });
    const fGeo = new THREE.SphereGeometry(0.25, 5, 4);
    const fInst = new THREE.InstancedMesh(fGeo, fMat, ringPts.length);
    const dummy = new THREE.Object3D();
    ringPts.forEach(({ x: fx, z: fz }, i) => {
      const fy = this.getHeight(fx, fz);
      dummy.position.set(fx, fy + 0.4, fz);
      dummy.scale.setScalar(0.8 + rng() * 0.5);
      dummy.updateMatrix();
      fInst.setMatrixAt(i, dummy.matrix);
      fInst.setColorAt(i, new THREE.Color().setHSL(rng()*0.15, 0.9, 0.55));
    });
    fInst.instanceMatrix.needsUpdate = true;
    if (fInst.instanceColor) fInst.instanceColor.needsUpdate = true;
    this.scene.add(fInst); this.objects.push(fInst);

    g.position.set(x, y, z);
    this.scene.add(g); this.objects.push(g);
    this._zones.landmarks.push({ x, z });
    this._obstacles.push({ x, z, r: 14.5 }); // 분수 기반 외벽 반경 (14m base)
    this._structures.push({ x, z, r: 14.5 }); // 미니맵 표시
    return { x, z };
  }

  /** 사바나 영웅 아카시아 — 고사목, 높이 22, 우산형 가지 */
  _spawnHeroAcacia(cx, cz) {
    const rng = this._rng;
    const x = cx ?? (rng()-0.5) * 60, z = cz ?? (rng()-0.5) * 60;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const barkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a, flatShading: true });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x5a8020, flatShading: true });
    // 뒤틀린 줄기 5세그먼트
    let segY = 0;
    for (let s = 0; s < 5; s++) {
      const r1 = 1.3 - s * 0.18, r2 = 1.0 - s * 0.18;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, 5.0, 7), barkMat.clone());
      seg.position.set((rng()-0.5)*s*0.5, segY + 2.5, (rng()-0.5)*s*0.5);
      seg.rotation.set((rng()-0.5)*0.12, 0, (rng()-0.5)*0.12);
      g.add(seg);
      segY += 5.0;
    }
    // 우산형 가지 6개
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + rng() * 0.3;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 9, 5), barkMat.clone());
      const bx = Math.cos(a) * 4.5, bz = Math.sin(a) * 4.5;
      br.position.set(bx, segY - 3, bz);
      br.rotation.set(Math.cos(a) * 0.52, a, Math.sin(a) * 0.52);
      g.add(br);
      // 가지 끝 납작한 잎 뭉치
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(4.0, 7, 4), leafMat.clone());
      leaves.scale.set(1.5, 0.32, 1.5);
      leaves.position.set(Math.cos(a) * 10.5, segY - 1.5, Math.sin(a) * 10.5);
      g.add(leaves);
    }
    g.position.set(x, y, z);
    g.scale.setScalar(1.6); // 영웅 스케일
    this.scene.add(g); this.objects.push(g);
    this._zones.landmarks.push({ x, z });
    return { x, z };
  }

  /** 숲 고대 거목 — 높이 35, 이끼 낀 굵은 줄기 */
  _spawnAncientPine(cx, cz) {
    const rng = this._rng;
    const x = cx ?? 0, z = cz ?? 0;
    const y = this.getHeight(x, z);
    const g = new THREE.Group();
    const barkMat  = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
    const leafMat  = new THREE.MeshLambertMaterial({ color: 0x2d5a1b });
    const trunkH = 35;
    let trunk = null;
    for (let seg = 0; seg < 5; seg++) {
      const r0 = 1.8 - seg * 0.28, r1 = 1.5 - seg * 0.28;
      const segH = trunkH / 5;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segH, 8), barkMat.clone());
      t.position.set(0, seg * segH + segH * 0.5, 0);
      t.castShadow = true;
      g.add(t);
      if (seg === 0) trunk = t;
    }
    // 방사형 가지 + 침엽 무더기
    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      const ly = 12 + b * 2.5;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 7, 5), barkMat.clone());
      const bx = Math.cos(a) * 3.5, bz = Math.sin(a) * 3.5;
      br.position.set(bx, ly, bz);
      br.rotation.set(Math.cos(a) * 0.45, a, Math.sin(a) * 0.45);
      g.add(br);
      const lv = new THREE.Mesh(new THREE.SphereGeometry(3.2, 6, 4), leafMat.clone());
      lv.scale.set(1.2, 0.5, 1.2);
      lv.position.set(Math.cos(a) * 8, ly + 1, Math.sin(a) * 8);
      g.add(lv);
    }
    // 꼭대기 첨탑형 잎
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.5, 10, 7), leafMat.clone());
    top.position.set(0, trunkH + 3, 0);
    g.add(top);
    g.position.set(x, y, z);
    g.scale.setScalar(1.4);
    this.scene.add(g); this.objects.push(g);
    this._zones.landmarks.push({ x, z });
    return { x, z };
  }



  // ── 기하 헬퍼: 실린더 메시 생성 ──────────────────────────────
  _cyl(rTop, rBot, h, segs, mat, ox = 0, oy = 0, oz = 0) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(ox, oy, oz);
    m.castShadow = true;
    return m;
  }

  // ── 기하 헬퍼: 박스 메시 생성 ────────────────────────────────
  _box(w, h, d, mat, ox = 0, oy = 0, oz = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(ox, oy, oz);
    m.castShadow = true;
    return m;
  }

  // ── 영웅 랜드마크: 등대 ───────────────────────────────────────
  _spawnHeroLighthouse(cx, cz) {
    const x = cx ?? 0, z = cz ?? 0;
    const y = Math.max(0, this.getHeight(x, z));
    const g = new THREE.Group();

    const stoneMat  = new THREE.MeshLambertMaterial({ color: 0xd9cfc4 });
    const stoneAlt  = new THREE.MeshLambertMaterial({ color: 0xc0392b }); // 빨간 줄
    const glassMat  = new THREE.MeshLambertMaterial({ color: 0xf9e74b, emissive: 0xffdd00, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 });
    const roofMat   = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const baseMat   = new THREE.MeshLambertMaterial({ color: 0xb0a090 });

    // 기단
    g.add(this._cyl(3.2, 3.8, 1.2, 12, baseMat, 0, 0.6, 0));
    // 탑 본체 — 3단 (흰/빨/흰)
    g.add(this._cyl(2.0, 2.8, 6.0, 12, stoneMat.clone(), 0, 4.2, 0));
    g.add(this._cyl(1.85, 2.05, 2.0, 12, stoneAlt.clone(), 0, 10.2, 0));
    g.add(this._cyl(1.5, 1.9, 5.0, 12, stoneMat.clone(), 0, 14.7, 0));
    // 난간 테두리
    g.add(this._cyl(1.65, 1.65, 0.25, 14, baseMat, 0, 17.35, 0));
    // 등실 (유리)
    g.add(this._cyl(1.2, 1.2, 2.2, 10, glassMat, 0, 18.6, 0));
    // 지붕
    const roofGeo = new THREE.ConeGeometry(1.4, 1.8, 10);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 20.5, 0);
    g.add(roof);
    // 꼭대기 구
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), roofMat.clone());
    tip.position.set(0, 21.5, 0);
    g.add(tip);
    // 출입문
    g.add(this._box(0.9, 1.4, 0.18, stoneAlt.clone(), 0, 0.7, -2.85));
    // 창문 (3개)
    [6, 10, 14].forEach(wy => {
      g.add(this._box(0.5, 0.7, 0.18, glassMat.clone(), 0, wy, -1.85));
    });

    g.position.set(x, y, z);
    this.scene.add(g);
    this.objects.push(g);
    this._zones.landmarks.push({ x, z });
    return { x, z };
  }


}