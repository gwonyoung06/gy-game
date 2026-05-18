import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════
// 재질 캐시 — 동일 (color+opts) 조합은 하나의 material 인스턴스 공유
// draw call 수와 GPU 메모리 모두 절감
// ══════════════════════════════════════════════════════════════════
const _matCache = new Map();
export const _cachedMats = new Set(); // Game._cleanup() 에서 dispose 스킵용

const mat = (color, opts = {}) => {
  const key = color + JSON.stringify(opts);
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
    _matCache.set(key, m);
    _cachedMats.add(m);
  }
  return m;
};

// 런타임에 속성(opacity 등)이 바뀌는 재질 → 개별 인스턴스 필요
const matU = (color, opts = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });

// ══════════════════════════════════════════════════════════════════
// 지오메트리 캐시 — 동일 인자 조합은 GPU 버퍼 한 번만 업로드
// ══════════════════════════════════════════════════════════════════
const _geoCache = new Map();
export const _cachedGeos = new Set(); // Game._cleanup() 에서 dispose 스킵용

const geo = (ctor, ...args) => {
  const key = ctor + '|' + args;
  let g = _geoCache.get(key);
  if (!g) {
    g = new THREE[ctor](...args);
    _geoCache.set(key, g);
    _cachedGeos.add(g);
  }
  return g;
};

// ══════════════════════════════════════════════════════════════════
// 포획 파티클 풀
// - 씬 전환 시에도 orphan RAF 없음 (Game loop 에서 update 호출)
// - 고정 크기 풀로 GC 압박 최소화
// ══════════════════════════════════════════════════════════════════
const POOL_SIZE = 80;

class ParticlePool {
  constructor() {
    this._sharedGeo = new THREE.SphereGeometry(0.07, 4, 4);
    this._pool      = [];
    this._active    = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(
        this._sharedGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 })
      );
      mesh.visible = false;
      this._pool.push({ mesh, vel: new THREE.Vector3(), t: 0, scene: null });
    }
  }

  /** 포획 이펙트 방출 */
  emit(scene, pos, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const p = this._pool.pop();
      if (!p) return; // 풀 소진 시 스킵
      p.scene = scene;
      p.mesh.position.copy(pos);
      p.mesh.material.color.set(color);
      p.mesh.material.opacity = 1;
      p.mesh.visible = true;
      p.vel.set(
        (Math.random() - 0.5) * 5,
        1 + Math.random() * 4,
        (Math.random() - 0.5) * 5
      );
      p.t = 0;
      scene.add(p.mesh);
      this._active.push(p);
    }
  }

  /** Game loop 에서 매 프레임 호출 (deltaTime 기반) */
  update(delta) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p.t += delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.vel.y -= 9 * delta;
      p.mesh.material.opacity = Math.max(0, 1 - p.t * 2.2);
      if (p.t >= 0.5) this._returnToPool(i);
    }
  }

  /** 씬 전환 시 즉시 전체 회수 — orphan 파티클 방지 */
  reset() {
    for (let i = this._active.length - 1; i >= 0; i--) this._returnToPool(i);
  }

  _returnToPool(i) {
    const p = this._active[i];
    p.scene?.remove(p.mesh);
    p.mesh.visible = false;
    p.scene = null;
    this._active.splice(i, 1);
    this._pool.push(p);
  }

  dispose() {
    this.reset();
    this._sharedGeo.dispose();
    // 풀 내 재질 dispose (캐시 외 개별 인스턴스)
    for (const p of this._pool) p.mesh.material.dispose();
  }
}

export const particlePool = new ParticlePool();

// ── 모듈 레벨 임시 벡터 (매 프레임 new Vector3() 방지) ────────────
const _tv0 = new THREE.Vector3();
const _tv1 = new THREE.Vector3();
const _tv2 = new THREE.Vector3();

// ── 종별 행동 프로필 ──────────────────────────────────────────────
// captureChanceBack: 뒤에서 접근 시 포획 성공률 (0~1)
// captureChanceFront: 앞에서 접근 시 포획 성공률
// fleeRadius: 이 거리 이내에서 도망 시작
// frontFleeBoost: 앞에서 오면 flee 속도 배율
// aggroRange: 공격적 동물이 추격 시작하는 거리
// damage: 한 번 공격 시 HP 감소량
// attackCooldown: 공격 간격 (초)
// style: 이동 방식 키
export const PROFILES = {
  // ─── 곤충류 ─────────────────────────────
  dragonfly:    { style:'erratic_hover', fleeRadius:9,  frontFleeBoost:3.5, captureChanceBack:0.65, captureChanceFront:0.05 },
  butterfly:    { style:'flap_drift',    fleeRadius:4,  frontFleeBoost:1.2, captureChanceBack:0.65, captureChanceFront:0.65 },
  bee:          { style:'buzz_hover',    fleeRadius:4,  frontFleeBoost:1.3, captureChanceBack:0.65, captureChanceFront:0.40 },
  cicada:       { style:'erratic_hover', fleeRadius:7,  frontFleeBoost:2.0, captureChanceBack:0.65, captureChanceFront:0.15 },
  ladybug:      { style:'walk_wander',   fleeRadius:3,  frontFleeBoost:1.2, captureChanceBack:0.65, captureChanceFront:0.65 },
  beetle:       { style:'walk_wander',   fleeRadius:3,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  grasshopper:  { style:'hop_pause',     fleeRadius:8,  frontFleeBoost:3.0, captureChanceBack:0.65, captureChanceFront:0.08 },
  mantis:       { style:'walk_wander',   fleeRadius:5,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.40 },
  cricket:      { style:'hop_pause',     fleeRadius:6,  frontFleeBoost:2.0, captureChanceBack:0.65, captureChanceFront:0.25 },
  stag:         { style:'flap_drift',    fleeRadius:5,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.45 },
  worm:         { style:'walk_wander',   fleeRadius:2,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  mole:         { style:'walk_wander',   fleeRadius:4,  frontFleeBoost:1.2, captureChanceBack:0.65, captureChanceFront:0.60 },
  snail:        { style:'walk_wander',   fleeRadius:1,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  pill_bug:     { style:'walk_wander',   fleeRadius:2,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  centipede:    { style:'walk_wander',   fleeRadius:4,  frontFleeBoost:1.3, captureChanceBack:0.65, captureChanceFront:0.55 },
  firefly:      { style:'flap_drift',    fleeRadius:3,  frontFleeBoost:1.2, captureChanceBack:0.65, captureChanceFront:0.65 },
  // ─── 연못 생물 ───────────────────────────
  frog:         { style:'hop_pause',     fleeRadius:5,  frontFleeBoost:1.8, captureChanceBack:0.65, captureChanceFront:0.45 },
  tadpole:      { style:'swim_curve',    fleeRadius:3,  frontFleeBoost:1.2, captureChanceBack:0.65, captureChanceFront:0.65 },
  water_strider:{ style:'walk_wander',   fleeRadius:5,  frontFleeBoost:1.8, captureChanceBack:0.65, captureChanceFront:0.30 },
  water_beetle: { style:'swim_curve',    fleeRadius:4,  frontFleeBoost:1.4, captureChanceBack:0.65, captureChanceFront:0.55 },
  larvae:       { style:'walk_wander',   fleeRadius:2,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  leech:        { style:'walk_wander',   fleeRadius:2,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  crayfish:     { style:'sidewalk',      fleeRadius:4,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.50 },
  salamander:   { style:'walk_wander',   fleeRadius:4,  frontFleeBoost:1.3, captureChanceBack:0.65, captureChanceFront:0.58 },
  crucian:      { style:'swim_curve',    fleeRadius:4,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.55 },
  loach:        { style:'swim_curve',    fleeRadius:3,  frontFleeBoost:1.3, captureChanceBack:0.65, captureChanceFront:0.65 },
  catfish:      { style:'swim_curve',    fleeRadius:4,  frontFleeBoost:1.4, captureChanceBack:0.65, captureChanceFront:0.55 },
  soft_turtle:  { style:'walk_wander',   fleeRadius:3,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  heron:        { style:'flap_drift',    fleeRadius:7,  frontFleeBoost:2.0, captureChanceBack:0.65, captureChanceFront:0.35 },
  // ─── 바다 생물 ───────────────────────────
  crab:         { style:'sidewalk',      fleeRadius:4,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.50 },
  conch:        { style:'walk_wander',   fleeRadius:1,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  abalone:      { style:'walk_wander',   fleeRadius:1,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  octopus:      { style:'pulse_drift',   fleeRadius:6,  frontFleeBoost:2.0, captureChanceBack:0.65, captureChanceFront:0.40 },
  starfish:     { style:'walk_wander',   fleeRadius:1,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  shark:        { style:'circle_charge', fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.35,
                  aggroRange:18, damage:22, attackCooldown:2.0 },
  puffer:       { style:'swim_curve',    fleeRadius:5,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.48 },
  jellyfish:    { style:'pulse_drift',   fleeRadius:2,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  ray:          { style:'swim_curve',    fleeRadius:5,  frontFleeBoost:1.6, captureChanceBack:0.65, captureChanceFront:0.45 },
  whale:        { style:'swim_curve',    fleeRadius:8,  frontFleeBoost:2.0, captureChanceBack:0.65, captureChanceFront:0.40 },
  // ─── 열대 생물 ───────────────────────────
  parrot:       { style:'flap_drift',    fleeRadius:6,  frontFleeBoost:1.8, captureChanceBack:0.65, captureChanceFront:0.38 },
  chameleon:    { style:'walk_wander',   fleeRadius:3,  frontFleeBoost:1.2, captureChanceBack:0.65, captureChanceFront:0.65 },
  sloth:        { style:'walk_wander',   fleeRadius:1,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  iguana:       { style:'walk_wander',   fleeRadius:5,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.50 },
  spider:       { style:'walk_wander',   fleeRadius:4,  frontFleeBoost:1.3, captureChanceBack:0.65, captureChanceFront:0.60 },
  // ─── 사바나 생물 ─────────────────────────
  zebra:        { style:'walk_wander',   fleeRadius:12, frontFleeBoost:2.5, captureChanceBack:0.65, captureChanceFront:0.25 },
  ostrich:      { style:'walk_wander',   fleeRadius:10, frontFleeBoost:2.2, captureChanceBack:0.65, captureChanceFront:0.30 },
  hyena:        { style:'circle_charge', fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.35,
                  aggroRange:16, damage:18, attackCooldown:2.2 },
  croc:         { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.28,
                  aggroRange:14, damage:25, attackCooldown:3.0 },
  cheetah:      { style:'stalk_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.30,
                  aggroRange:20, damage:20, attackCooldown:1.8 },
  // ─── 극지/설원 생물 ──────────────────────
  snow_leopard: { style:'stalk_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.28,
                  aggroRange:18, damage:22, attackCooldown:2.0 },
  polar_bear:   { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.20,
                  aggroRange:16, damage:30, attackCooldown:3.0 },
  penguin:      { style:'walk_wander',   fleeRadius:5,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.50 },
  reindeer:     { style:'walk_wander',   fleeRadius:10, frontFleeBoost:2.0, captureChanceBack:0.65, captureChanceFront:0.30 },
  mammoth:      { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.18,
                  aggroRange:18, damage:32, attackCooldown:3.5 },
  gorilla:      { style:'circle_charge', fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.22,
                  aggroRange:16, damage:28, attackCooldown:2.5 },
  cobra:        { style:'walk_wander',   fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.30,
                  aggroRange:10, damage:20, attackCooldown:2.0 },
  jaguar:       { style:'stalk_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.25,
                  aggroRange:22, damage:26, attackCooldown:2.2 },
  elephant:     { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.68, captureChanceFront:0.18,
                  aggroRange:15, damage:28, attackCooldown:3.5 },
  rhino:        { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.68, captureChanceFront:0.15,
                  aggroRange:16, damage:30, attackCooldown:3.0 },
  // ─── 공룡 ────────────────────────────────
  pteranodon:   { style:'soar_circle',   fleeRadius:5,  frontFleeBoost:1.5, captureChanceBack:0.65, captureChanceFront:0.38 },
  stegosaurus:  { style:'walk_wander',   fleeRadius:6,  frontFleeBoost:1.3, captureChanceBack:0.65, captureChanceFront:0.45 },
  triceratops:  { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.22,
                  aggroRange:18, damage:28, attackCooldown:3.0 },
  brachiosaurus:{ style:'walk_wander',   fleeRadius:4,  frontFleeBoost:1.2, captureChanceBack:0.65, captureChanceFront:0.55 },
  raptor:       { style:'stalk_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.22,
                  aggroRange:24, damage:22, attackCooldown:1.6 },
  t_rex:        { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.12,
                  aggroRange:28, damage:38, attackCooldown:3.8 },
  spinosaurus:  { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.12,
                  aggroRange:26, damage:35, attackCooldown:3.5 },
  ankylosaurus: { style:'stomp_charge',  fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.68, captureChanceFront:0.18,
                  aggroRange:15, damage:30, attackCooldown:4.0 },
  parasaurolophus:{ style:'walk_wander', fleeRadius:8,  frontFleeBoost:1.8, captureChanceBack:0.65, captureChanceFront:0.35 },
  giganotosaurus:{ style:'stomp_charge', fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.60, captureChanceFront:0.10,
                  aggroRange:30, damage:42, attackCooldown:4.0 },
  // ─── 우주 ────────────────────────────────
  drone:        { style:'erratic_hover', fleeRadius:8,  frontFleeBoost:2.0, captureChanceBack:0.65, captureChanceFront:0.30 },
  alien:        { style:'erratic_hover', fleeRadius:6,  frontFleeBoost:1.8, captureChanceBack:0.65, captureChanceFront:0.40 },
  debris:       { style:'flap_drift',    fleeRadius:2,  frontFleeBoost:1.0, captureChanceBack:0.65, captureChanceFront:0.65 },
  giant_beetle: { style:'walk_wander',   fleeRadius:5,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.25,
                  aggroRange:12, damage:18, attackCooldown:2.5 },
  giant_shark:  { style:'circle_charge', fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.65, captureChanceFront:0.20,
                  aggroRange:22, damage:28, attackCooldown:2.0 },
  ufo:          { style:'ufo_hover',     fleeRadius:0,  frontFleeBoost:0,   captureChanceBack:0.60, captureChanceFront:0.40 },
};

const DEFAULT_PROFILE = {
  style: 'walk_wander', fleeRadius: 5, frontFleeBoost: 1.5,
  captureChanceBack: 0.85, captureChanceFront: 0.50,
  aggroRange: 0, damage: 0, attackCooldown: 2.0,
};

// ── 생물 모양 빌더 ────────────────────────────────────────────────
const BUILDERS = {

  dragonfly(color) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const r = 0.045 - i * 0.005;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r + 0.005, 0.09, 6),
        mat(i % 2 === 0 ? color : 0x224422)
      );
      seg.rotation.x = Math.PI / 2;
      seg.position.z = i * 0.09 + 0.04;
      g.add(seg);
    }
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat(0x3a7744));
    thorax.position.z = -0.1;
    g.add(thorax);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), mat(0x3a7744));
    head.position.z = -0.2;
    g.add(head);
    const eyeMat = mat(0x5555ff);
    for (const x of [-0.055, 0.055]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeMat.clone());
      eye.position.set(x, 0.03, -0.23);
      g.add(eye);
    }
    const wMat = mat(0xcceeFF, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, flatShading: false });
    const wings = [];
    [[-0.24, 0.02, -0.1, 0.3, 0.1], [0.24, 0.02, -0.1, 0.3, 0.1],
     [-0.2,  0.02,  0.04, 0.24, 0.08], [0.2,  0.02,  0.04, 0.24, 0.08]].forEach(([x, y, z, w, h]) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wMat.clone());
      wing.position.set(x, y, z);
      g.add(wing);
      wings.push(wing);
    });
    g.userData.wings = wings;
    return g;
  },

  butterfly(color) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.055 - i * 0.01, 6, 6), mat(0x332200));
      seg.position.z = i * 0.07;
      g.add(seg);
    }
    for (const x of [-0.03, 0.03]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 4), mat(0x332200));
      ant.position.set(x, 0.1, -0.1);
      ant.rotation.z = x < 0 ? -0.4 : 0.4;
      g.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 4, 4), mat(0x332200));
      tip.position.set(x * 1.6, 0.19, -0.12);
      g.add(tip);
    }
    const wings = [];
    const topMat = mat(color, { transparent: true, opacity: 0.85, side: THREE.DoubleSide, flatShading: false });
    const botMat = mat(0xdd6600, { transparent: true, opacity: 0.85, side: THREE.DoubleSide, flatShading: false });
    [[-0.28, 0.04, -0.04, 0.42, 0.22], [0.28, 0.04, -0.04, 0.42, 0.22]].forEach(([x, y, z, w, h]) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(w, h), topMat.clone());
      wing.position.set(x, y, z);
      wing.rotation.x = -0.2;
      g.add(wing);
      wings.push(wing);
    });
    [[-0.22, 0, 0.14, 0.3, 0.2], [0.22, 0, 0.14, 0.3, 0.2]].forEach(([x, y, z, w, h]) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(w, h), botMat.clone());
      wing.position.set(x, y, z);
      wing.rotation.x = -0.15;
      g.add(wing);
      wings.push(wing);
    });
    g.userData.wings = wings;
    return g;
  },

  bee(color) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const r = 0.08 - i * 0.01;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(i % 2 === 0 ? 0x222200 : 0xddaa00));
      seg.scale.set(1, 0.8, 1.2);
      seg.position.z = i * 0.1;
      g.add(seg);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat(0x222200));
    head.position.z = -0.12;
    g.add(head);
    for (const x of [-0.04, 0.04]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), mat(0x44ff44));
      eye.position.set(x, 0.035, -0.16);
      g.add(eye);
    }
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 5), mat(0x333300));
    stinger.rotation.x = -Math.PI / 2;
    stinger.position.z = 0.43;
    g.add(stinger);
    const wMat = mat(0xeeffff, { transparent: true, opacity: 0.5, side: THREE.DoubleSide, flatShading: false });
    const wings = [];
    [[-0.2, 0.06, -0.02, 0.26, 0.1], [0.2, 0.06, -0.02, 0.26, 0.1],
     [-0.15, 0.05, 0.07, 0.2, 0.08], [0.15, 0.05, 0.07, 0.2, 0.08]].forEach(([x, y, z, w, h]) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wMat.clone());
      wing.position.set(x, y, z);
      g.add(wing);
      wings.push(wing);
    });
    g.userData.wings = wings;
    return g;
  },

  /**
   * frog — 개구리
   * 실루엣 포인트: 넓적한 납작 몸통 + 볼록 툭 튀어나온 눈 + 강력한 뒷다리 3절
   */
  frog(color) {
    const g = new THREE.Group();
    const darkC  = new THREE.Color(color).multiplyScalar(0.55).getHex();
    const bellyC = 0xE8D8A0; // 연한 배 색

    // 몸통 — 납작하고 넓적한 타원
    const body = new THREE.Mesh(geo('SphereGeometry', 0.22, 9, 7), mat(color));
    body.scale.set(1.28, 0.62, 1.12);
    body.position.set(0, 0.14, 0.04);
    g.add(body);

    // 배 (밝은 크림색)
    const belly = new THREE.Mesh(geo('SphereGeometry', 0.18, 8, 6), mat(bellyC));
    belly.scale.set(1.0, 0.35, 0.90);
    belly.position.set(0, 0.07, 0.06);
    g.add(belly);

    // 등줄 무늬
    const stripe = new THREE.Mesh(geo('BoxGeometry', 0.04, 0.04, 0.30), mat(darkC));
    stripe.position.set(0, 0.26, 0.04);
    g.add(stripe);

    // 머리 — 몸통과 자연스럽게 이어지는 넓은 구조
    const head = new THREE.Mesh(geo('SphereGeometry', 0.17, 8, 6), mat(color));
    head.scale.set(1.15, 0.68, 0.95);
    head.position.set(0, 0.14, -0.24);
    g.add(head);

    // 입 라인 (평평하고 넓은)
    const mouth = new THREE.Mesh(geo('BoxGeometry', 0.22, 0.025, 0.040), mat(darkC));
    mouth.position.set(0, 0.10, -0.30);
    mouth.rotation.x = 0.15;
    g.add(mouth);

    // ★ 볼록 눈 — 개구리의 가장 특징적인 부분
    for (const s of [-1, 1]) {
      // 눈 받침대
      const eyeBase = new THREE.Mesh(geo('SphereGeometry', 0.08, 7, 6), mat(color));
      eyeBase.position.set(s * 0.105, 0.28, -0.18);
      g.add(eyeBase);

      // 홍채 (금색-갈색)
      const iris = new THREE.Mesh(geo('SphereGeometry', 0.062, 7, 6), mat(0xB8860B));
      iris.position.set(s * 0.105, 0.30, -0.21);
      g.add(iris);

      // 동공 (수평 타원형 — 개구리 특유)
      const pupil = new THREE.Mesh(geo('SphereGeometry', 0.040, 6, 5), mat(0x0A0A08));
      pupil.scale.set(0.6, 1, 0.4);
      pupil.position.set(s * 0.105, 0.30, -0.225);
      g.add(pupil);

      // 눈 반짝임
      const shine = new THREE.Mesh(geo('SphereGeometry', 0.016, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xFFFFEE }));
      shine.position.set(s * 0.097, 0.314, -0.232);
      g.add(shine);
    }

    // 앞다리 (짧고 가느다란)
    for (const s of [-1, 1]) {
      const armUpper = new THREE.Mesh(geo('CylinderGeometry', 0.032, 0.026, 0.14, 5), mat(color));
      armUpper.position.set(s * 0.205, 0.07, -0.15);
      armUpper.rotation.z = s * 1.05;
      g.add(armUpper);

      const armLower = new THREE.Mesh(geo('CylinderGeometry', 0.022, 0.018, 0.13, 5), mat(darkC));
      armLower.position.set(s * 0.320, 0.02, -0.14);
      armLower.rotation.z = s * 0.55;
      g.add(armLower);

      // 손가락 (4개, 부채꼴)
      for (let fi = 0; fi < 4; fi++) {
        const finger = new THREE.Mesh(geo('CylinderGeometry', 0.010, 0.007, 0.09, 4), mat(darkC));
        const fanAngle = (fi - 1.5) * 0.28;
        finger.position.set(s * (0.38 + Math.sin(fanAngle) * 0.04), -0.01, -0.12 + Math.cos(fanAngle) * 0.02);
        finger.rotation.z = s * 0.3 + fanAngle;
        g.add(finger);
      }
    }

    // ★ 뒷다리 — 3절 구조, 강력한 도약 포즈
    for (const s of [-1, 1]) {
      // 허벅지 (굵고 강함 — 옆으로 뻗음)
      const thigh = new THREE.Mesh(geo('CylinderGeometry', 0.068, 0.055, 0.30, 6), mat(color));
      thigh.position.set(s * 0.18, 0.10, 0.20);
      thigh.rotation.z = s * 1.10;   // 옆으로 크게 벌어짐
      thigh.rotation.x = 0.20;
      g.add(thigh);

      // 정강이 (뒤로 꺾임)
      const shin = new THREE.Mesh(geo('CylinderGeometry', 0.042, 0.032, 0.28, 5), mat(darkC));
      shin.position.set(s * 0.40, -0.04, 0.26);
      shin.rotation.z = s * 0.30;
      shin.rotation.x = 0.55;
      g.add(shin);

      // 발 (앞으로 뻗은 물갈퀴 발)
      const foot = new THREE.Mesh(geo('SphereGeometry', 0.06, 6, 5), mat(darkC));
      foot.scale.set(0.5, 0.3, 1.5);
      foot.position.set(s * 0.46, -0.12, 0.40);
      g.add(foot);

      // 물갈퀴 발가락 (5개)
      for (let fi = 0; fi < 5; fi++) {
        const toe = new THREE.Mesh(geo('CylinderGeometry', 0.009, 0.006, 0.11, 4), mat(darkC));
        const fanA = (fi - 2) * 0.25;
        toe.position.set(s * (0.46 + Math.sin(fanA) * 0.04), -0.14, 0.48 + fi * 0.01);
        toe.rotation.x = -0.3;
        toe.rotation.z = s * fanA * 0.5;
        g.add(toe);
      }
    }

    return g;
  },

  fish(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(color));
    body.scale.set(0.65, 0.6, 1.6);
    g.add(body);
    for (const y of [0.06, -0.06]) {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), mat(color));
      tail.rotation.z = Math.PI / 2;
      tail.position.set(-0.32, y, 0);
      g.add(tail);
    }
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat(color));
    dorsal.position.set(0, 0.15, 0.06);
    g.add(dorsal);
    for (const x of [-0.14, 0.14]) {
      const pec = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), mat(color));
      pec.position.set(x, -0.02, 0.04);
      pec.rotation.z = x < 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(pec);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 5), mat(0x111111));
    eye.position.set(0.1, 0.02, -0.22);
    g.add(eye);
    return g;
  },

  crab(color) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(color));
    shell.scale.set(1.5, 0.5, 1.1);
    shell.position.y = 0.08;
    g.add(shell);
    for (const x of [-0.35, 0.35]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5), mat(color));
      arm.position.set(x * 0.72, 0.06, -0.12);
      arm.rotation.z = x < 0 ? -1.0 : 1.0;
      g.add(arm);
      const claw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(0xcc4400));
      claw.scale.set(0.8, 0.65, 0.95);
      claw.position.set(x, 0.06, -0.16);
      g.add(claw);
    }
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.22, 4), mat(color));
        leg.position.set(s * 0.26, 0.01, (i - 1) * 0.13 + 0.06);
        leg.rotation.z = s < 0 ? -1.2 : 1.2;
        g.add(leg);
      }
    }
    for (const x of [-0.07, 0.07]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 4), mat(color));
      stalk.position.set(x, 0.17, -0.19);
      g.add(stalk);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.027, 5, 5), mat(0x111111));
      eye.position.set(x, 0.24, -0.2);
      g.add(eye);
    }
    return g;
  },

  jellyfish(color) {
    const g = new THREE.Group();
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(color, { transparent: true, opacity: 0.7 })
    );
    bell.rotation.x = Math.PI;
    bell.position.y = 0.1;
    g.add(bell);
    const tenMat = mat(color, { transparent: true, opacity: 0.45 });
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const ten = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.004, 0.28 + Math.random() * 0.18, 4), tenMat.clone());
      ten.position.set(Math.cos(angle) * 0.14, -0.22, Math.sin(angle) * 0.14);
      g.add(ten);
    }
    return g;
  },

  t_rex(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.85), mat(color));
    body.position.y = 0.5;
    g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.38, 6), mat(color));
    neck.position.set(0, 0.92, -0.28);
    neck.rotation.x = -0.35;
    g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.7), mat(color));
    head.position.set(0, 1.12, -0.6);
    g.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.6), mat(0x886655));
    jaw.position.set(0, 0.93, -0.64);
    g.add(jaw);
    for (let i = 0; i < 5; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.065, 4), mat(0xf5f5dc));
      tooth.position.set(-0.16 + i * 0.08, 0.96, -0.93);
      tooth.rotation.x = -0.3;
      g.add(tooth);
    }
    for (const x of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), mat(0x882200));
      eye.position.set(x, 1.21, -0.88);
      g.add(eye);
    }
    for (const x of [-0.33, 0.33]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.28, 5), mat(color));
      arm.position.set(x, 0.58, -0.15);
      arm.rotation.z = x < 0 ? -0.85 : 0.85;
      arm.rotation.x = 0.65;
      g.add(arm);
    }
    for (const x of [-0.2, 0.2]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.42, 6), mat(color));
      thigh.position.set(x, 0.22, 0.16);
      g.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.34, 6), mat(color));
      shin.position.set(x, -0.05, 0.24);
      shin.rotation.x = -0.35;
      g.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.26), mat(0x664433));
      foot.position.set(x, -0.19, 0.36);
      g.add(foot);
    }
    for (let i = 0; i < 7; i++) {
      const ts = new THREE.Mesh(new THREE.SphereGeometry(0.14 - i * 0.016, 6, 5), mat(color));
      ts.position.set(0, 0.42 - i * 0.05, 0.38 + i * 0.2);
      g.add(ts);
    }
    return g;
  },

  pteranodon(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), mat(color));
    body.scale.set(0.85, 0.72, 1.5);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 6), mat(color));
    head.position.set(0, 0.08, -0.35);
    g.add(head);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3, 4), mat(0xcc6644));
    crest.position.set(0, 0.3, -0.24);
    crest.rotation.x = 0.65;
    g.add(crest);
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.28, 4), mat(0xddbb66));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.04, -0.57);
    g.add(beak);
    const wMat = mat(color, { transparent: true, opacity: 0.78, side: THREE.DoubleSide, flatShading: false });
    const wings = [];
    for (const x of [-0.62, 0.62]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.38), wMat.clone());
      wing.position.set(x, 0.02, 0.02);
      wing.rotation.x = 0.18;
      g.add(wing);
      wings.push(wing);
    }
    g.userData.wings = wings;
    return g;
  },

  ufo(color) {
    const g = new THREE.Group();
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.35, 0.55, 22), mat(color));
    g.add(disk);
    const bottomRing = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.95, 0.18, 22), mat(0x223344));
    bottomRing.position.y = -0.32;
    g.add(bottomRing);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0x88ffff, { transparent: true, opacity: 0.5 })
    );
    dome.position.y = 0.28;
    g.add(dome);
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.42, 0.14, 8, 36),
      new THREE.MeshLambertMaterial({ color: 0x00ffff, emissive: 0x00aaaa, emissiveIntensity: 1.2 })
    );
    glowRing.position.y = -0.06;
    g.add(glowRing);
    const podGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pod = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0xffff00, emissive: 0xaaaa00, emissiveIntensity: 0.9 })
      );
      pod.position.set(Math.cos(angle) * 1.9, -0.18, Math.sin(angle) * 1.9);
      podGroup.add(pod);
    }
    g.add(podGroup);
    g.userData.podGroup = podGroup;
    const beam = new THREE.Mesh(
      geo('ConeGeometry', 0.8, 2.2, 10),
      matU(0x00ff88, { transparent: true, opacity: 0.12, side: THREE.DoubleSide }) // opacity 런타임 변경 → 개별 인스턴스
    );
    beam.position.y = -1.35;
    g.add(beam);
    g.userData.beam = beam;
    return g;
  },

  // ── Generic fallback builders ─────────────────────────────────

  flying(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 8), mat(color));
    g.add(body);
    const wMat = mat(0xaaddff, { transparent: true, opacity: 0.65, side: THREE.DoubleSide, flatShading: false });
    const wings = [];
    for (const x of [-0.24, 0.24]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.16), wMat.clone());
      wing.position.set(x, 0.04, 0);
      wing.rotation.y = x < 0 ? 0.3 : -0.3;
      g.add(wing);
      wings.push(wing);
    }
    g.userData.wings = wings;
    return g;
  },

  /**
   * ground — 소형 지상 절지동물 범용 모델
   * 설계: 명확한 머리/가슴/배 분절 + 6다리 + 더듬이
   * 이 하나로 무당벌레/딱정벌레/지네/달팽이 등 20종 커버
   */
  ground(color) {
    const g = new THREE.Group();
    const darkC = new THREE.Color(color).multiplyScalar(0.55).getHex();
    const lightC = new THREE.Color(color).multiplyScalar(1.35).getHex();

    // 배 (가장 크고 둥근 부분 — 뒤쪽)
    const abd = new THREE.Mesh(geo('SphereGeometry', 0.20, 8, 6), mat(color));
    abd.scale.set(1.0, 0.75, 1.25);
    abd.position.set(0, 0.12, 0.12);
    g.add(abd);

    // 가슴 (중간 분절)
    const thorax = new THREE.Mesh(geo('SphereGeometry', 0.13, 7, 5), mat(darkC));
    thorax.scale.set(0.95, 0.72, 0.85);
    thorax.position.set(0, 0.13, -0.12);
    g.add(thorax);

    // 머리 (작고 앞쪽)
    const head = new THREE.Mesh(geo('SphereGeometry', 0.11, 7, 6), mat(darkC));
    head.scale.set(0.9, 0.80, 0.90);
    head.position.set(0, 0.15, -0.28);
    g.add(head);

    // 겹눈 — 가장 특징적인 디테일
    const eyeMat = mat(0x111122);
    const shineMat2 = new THREE.MeshBasicMaterial({ color: 0x8888FF });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(geo('SphereGeometry', 0.052, 6, 5), eyeMat);
      eye.position.set(s * 0.085, 0.20, -0.30);
      g.add(eye);
      // 눈 반짝임
      const sh = new THREE.Mesh(geo('SphereGeometry', 0.016, 4, 4), shineMat2);
      sh.position.set(s * 0.092, 0.224, -0.315);
      g.add(sh);
    }

    // 더듬이 (2개, 앞쪽으로 뻗음)
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(geo('CylinderGeometry', 0.010, 0.008, 0.24, 4), mat(darkC));
      ant.position.set(s * 0.06, 0.22, -0.34);
      ant.rotation.z = s * 0.45;
      ant.rotation.x = -0.55;
      g.add(ant);
      const tip = new THREE.Mesh(geo('SphereGeometry', 0.018, 4, 4), mat(lightC));
      tip.position.set(s * 0.115, 0.30, -0.42);
      g.add(tip);
    }

    // 6다리 — 가슴 양쪽에 3쌍 (자연스러운 걸음 자세)
    const legAngles = [-0.32, 0.0, 0.32]; // Z 오프셋으로 앞/중/뒷다리 구분
    for (let li = 0; li < 3; li++) {
      for (const s of [-1, 1]) {
        const legGroup = new THREE.Group();
        legGroup.position.set(s * 0.14, 0.08, -0.14 + li * 0.12);

        // 대퇴절 (짧고 굵음)
        const femur = new THREE.Mesh(geo('CylinderGeometry', 0.022, 0.018, 0.14, 4), mat(darkC));
        femur.rotation.z = s * (0.9 + li * 0.15);
        femur.rotation.x = -0.3;
        femur.position.set(s * 0.05, -0.02, 0);
        legGroup.add(femur);

        // 경절 (길고 가늠)
        const tibia = new THREE.Mesh(geo('CylinderGeometry', 0.012, 0.009, 0.16, 4), mat(darkC));
        tibia.rotation.z = s * (0.4);
        tibia.rotation.x = 0.6;
        tibia.position.set(s * 0.13, -0.08, 0.04);
        legGroup.add(tibia);

        g.add(legGroup);
      }
    }

    // 등 무늬 (랜덤 반점 — 무당벌레/딱정벌레 느낌)
    const spotMat = mat(darkC);
    for (let si = 0; si < 2; si++) {
      for (const s of [-1, 1]) {
        const spot = new THREE.Mesh(geo('SphereGeometry', 0.045, 5, 4), spotMat);
        spot.scale.set(1, 0.25, 1);
        spot.position.set(s * 0.09, 0.29 + si * 0.02, 0.05 + si * 0.10);
        g.add(spot);
      }
    }

    return g;
  },

  water(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 6), mat(color));
    body.scale.set(0.6, 0.55, 1.5);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), mat(color));
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.3;
    g.add(tail);
    return g;
  },

  /**
   * large — 대형 사족보행 동물 범용 모델
   * 설계: 올바른 척추 동물 해부학 — 어깨/허리 들림, 목, 4절 다리, 꼬리
   * 코뿔소/코끼리/공룡/얼룩말 등 20여종에 공통 적용
   */
  large(color) {
    const g = new THREE.Group();
    const darkC  = new THREE.Color(color).multiplyScalar(0.62).getHex();
    const lightC = new THREE.Color(color).multiplyScalar(1.18).getHex();

    // ── 몸통 — 앞이 높고 뒤가 낮은 아치 형태 (척추동물 자연스러운 자세)
    const bodyGeo = geo('BoxGeometry', 0.72, 0.52, 1.05);
    const body = new THREE.Mesh(bodyGeo, mat(color));
    body.position.set(0, 0.62, 0.06);
    g.add(body);

    // 어깨 돌출부 (앞이 약간 높음 — 사자/말 실루엣)
    const shoulder = new THREE.Mesh(geo('SphereGeometry', 0.30, 7, 5), mat(color));
    shoulder.scale.set(1.2, 0.82, 0.80);
    shoulder.position.set(0, 0.80, -0.32);
    g.add(shoulder);

    // 엉덩이 (뒤쪽 볼록)
    const hip = new THREE.Mesh(geo('SphereGeometry', 0.28, 7, 5), mat(color));
    hip.scale.set(1.15, 0.75, 0.80);
    hip.position.set(0, 0.72, 0.38);
    g.add(hip);

    // ── 목 — 앞 아래쪽으로 자연스럽게 연결
    const neck = new THREE.Mesh(geo('CylinderGeometry', 0.19, 0.24, 0.55, 7), mat(color));
    neck.position.set(0, 0.82, -0.60);
    neck.rotation.x = 0.45;    // 앞으로 기울어짐
    g.add(neck);

    // ── 머리 — 특징적인 주둥이 구조
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, -0.90);
    g.add(headGroup);

    const skull = new THREE.Mesh(geo('BoxGeometry', 0.44, 0.40, 0.44), mat(color));
    skull.position.y = 0.06;
    headGroup.add(skull);

    // 주둥이 (앞으로 돌출)
    const snout = new THREE.Mesh(geo('BoxGeometry', 0.30, 0.28, 0.36), mat(darkC));
    snout.position.set(0, -0.02, -0.30);
    headGroup.add(snout);

    // 콧구멍
    for (const s of [-1, 1]) {
      const nostril = new THREE.Mesh(geo('SphereGeometry', 0.04, 5, 4), mat(darkC));
      nostril.position.set(s * 0.08, 0.02, -0.48);
      headGroup.add(nostril);
    }

    // 눈
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(geo('SphereGeometry', 0.070, 7, 6), mat(0x111111));
      eye.position.set(s * 0.225, 0.12, -0.10);
      headGroup.add(eye);
      const iris = new THREE.Mesh(geo('SphereGeometry', 0.048, 6, 5), mat(lightC));
      iris.position.set(s * 0.240, 0.12, -0.12);
      headGroup.add(iris);
      // 눈 하이라이트
      const shine = new THREE.Mesh(geo('SphereGeometry', 0.018, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
      shine.position.set(s * 0.248, 0.130, -0.13);
      headGroup.add(shine);
    }

    // 귀 (뒤로 젖혀진 형태)
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(geo('ConeGeometry', 0.10, 0.22, 5), mat(darkC));
      ear.position.set(s * 0.24, 0.32, 0.04);
      ear.rotation.z = s * 0.30;
      ear.rotation.x = -0.25;
      headGroup.add(ear);
    }

    // ── 4다리 — 상부/하부 분절로 자연스러운 무릎 표현
    const legData = [
      // [x,    z,    front/back,  knee direction]
      [-0.22, -0.38, true,   1],   // 왼쪽 앞다리
      [ 0.22, -0.38, true,  -1],   // 오른쪽 앞다리
      [-0.22,  0.36, false,  1],   // 왼쪽 뒷다리
      [ 0.22,  0.36, false, -1],   // 오른쪽 뒷다리
    ];
    legData.forEach(([lx, lz, isFront, ks]) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(lx, 0.58, lz);
      g.add(legGroup);

      // 상박 (대퇴부)
      const upper = new THREE.Mesh(geo('CylinderGeometry', 0.11, 0.09, 0.36, 6), mat(color));
      upper.position.y = -0.18;
      upper.rotation.x = isFront ? 0.12 : -0.08; // 앞다리는 약간 앞으로
      legGroup.add(upper);

      // 무릎 관절 (살짝 볼록)
      const knee = new THREE.Mesh(geo('SphereGeometry', 0.078, 6, 5), mat(darkC));
      knee.position.set(0, -0.37, isFront ? -0.04 : 0.04);
      legGroup.add(knee);

      // 하박 (경골)
      const lower = new THREE.Mesh(geo('CylinderGeometry', 0.075, 0.06, 0.34, 6), mat(color));
      lower.position.set(0, -0.55, isFront ? -0.04 : 0.04);
      lower.rotation.x = isFront ? -0.18 : 0.12; // 무릎 방향 꺾임
      legGroup.add(lower);

      // 발굽/발바닥
      const hoof = new THREE.Mesh(geo('BoxGeometry', 0.14, 0.09, 0.18), mat(darkC));
      hoof.position.set(0, -0.74, isFront ? -0.06 : 0.04);
      legGroup.add(hoof);
    });

    // ── 꼬리 — 뒤로 뻗은 3분절 꼬리
    const tailBase = new THREE.Mesh(geo('CylinderGeometry', 0.09, 0.06, 0.28, 5), mat(color));
    tailBase.position.set(0, 0.60, 0.72);
    tailBase.rotation.x = -0.45;
    g.add(tailBase);

    const tailMid = new THREE.Mesh(geo('CylinderGeometry', 0.055, 0.035, 0.24, 5), mat(color));
    tailMid.position.set(0, 0.52, 0.92);
    tailMid.rotation.x = -0.65;
    g.add(tailMid);

    const tailTip = new THREE.Mesh(geo('SphereGeometry', 0.038, 5, 4), mat(darkC));
    tailTip.position.set(0, 0.42, 1.08);
    g.add(tailTip);

    // ── 등 표면 패턴 (어두운 등쪽 / 밝은 배쪽 - 역광 효과)
    const belly = new THREE.Mesh(geo('BoxGeometry', 0.50, 0.08, 0.80), mat(lightC));
    belly.position.set(0, 0.35, 0.06);
    g.add(belly);

    return g;
  },

  // ══════════════════════════════════════════════════════════════
  // Stylized creature-specific builders
  // 설계 원칙: 특징 1개를 300% 과장, 나머지는 단순화
  // ══════════════════════════════════════════════════════════════

  // 메뚜기 — 실루엣 포인트: 거대한 뒷다리 + 긴 몸통
  grasshopper(color) {
    const g = new THREE.Group();

    // 가늘고 긴 몸통 (Z축으로 늘린 타원)
    const body = new THREE.Mesh(geo('SphereGeometry', 0.16, 6, 5), mat(color));
    body.scale.set(0.58, 0.62, 2.4);
    body.position.y = 0.32;
    g.add(body);

    // 머리 (눈이 강조되므로 약간 작게)
    const head = new THREE.Mesh(geo('SphereGeometry', 0.13, 6, 5), mat(color));
    head.position.set(0, 0.38, -0.52);
    g.add(head);

    // 화합물 눈 (크고 불룩한 — 가장 특징적인 부분)
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(geo('SphereGeometry', 0.075, 7, 6), mat(0x1a0033));
      eye.scale.set(1.0, 1.35, 0.85);
      eye.position.set(s * 0.1, 0.46, -0.6);
      g.add(eye);
      // 눈 하이라이트
      const hi = new THREE.Mesh(geo('SphereGeometry', 0.025, 4, 4), mat(0x6633cc));
      hi.position.set(s * 0.12, 0.49, -0.65);
      g.add(hi);
    }

    // ★ 거대한 뒷다리 (핵심 실루엣)
    for (const s of [-1, 1]) {
      // 허벅지 — 두껍고 굵게
      const thigh = new THREE.Mesh(geo('CylinderGeometry', 0.075, 0.05, 0.42, 5), mat(0x336600));
      thigh.position.set(s * 0.17, 0.18, 0.22);
      thigh.rotation.z = s * 0.65;
      thigh.rotation.x = -0.22;
      g.add(thigh);

      // 정강이 — 얇고 길게 + 뒤로 꺾임
      const shin = new THREE.Mesh(geo('CylinderGeometry', 0.03, 0.025, 0.50, 5), mat(0x448800));
      shin.position.set(s * 0.3, -0.06, 0.42);
      shin.rotation.z = s * 0.18;
      shin.rotation.x = 0.72;
      g.add(shin);

      // 발톱 (작은 cone)
      const claw = new THREE.Mesh(geo('ConeGeometry', 0.022, 0.08, 4), mat(0x222200));
      claw.position.set(s * 0.32, -0.28, 0.62);
      claw.rotation.x = -0.4;
      g.add(claw);
    }

    // 앞다리 (얇고 짧음 — 뒷다리와 대비)
    for (const s of [-1, 1]) {
      const fl = new THREE.Mesh(geo('CylinderGeometry', 0.018, 0.014, 0.22, 4), mat(color));
      fl.position.set(s * 0.1, 0.2, -0.18);
      fl.rotation.z = s * 1.1;
      fl.rotation.x = 0.3;
      g.add(fl);
    }

    // 더듬이
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(geo('CylinderGeometry', 0.007, 0.003, 0.38, 4), mat(0x222200));
      ant.position.set(s * 0.07, 0.52, -0.64);
      ant.rotation.z = s * 0.28;
      ant.rotation.x = -0.5;
      g.add(ant);
    }

    return g;
  },

  // 상어 — 실루엣 포인트: 거대한 등지느러미 + 유선형 몸통
  shark(color) {
    const g = new THREE.Group();

    // 유선형 몸통 (torpedo shape)
    const body = new THREE.Mesh(geo('SphereGeometry', 0.26, 8, 6), mat(color));
    body.scale.set(0.68, 0.58, 3.0);
    g.add(body);

    // 흰 배 (색상 대비)
    const belly = new THREE.Mesh(geo('SphereGeometry', 0.24, 8, 6), mat(0xf5f5f5));
    belly.scale.set(0.5, 0.32, 2.5);
    belly.position.set(0, -0.08, 0);
    g.add(belly);

    // ★ 등지느러미 (핵심 실루엣 — 실제보다 훨씬 크게)
    const dorsal = new THREE.Mesh(geo('ConeGeometry', 0.14, 0.62, 3), mat(color));
    dorsal.position.set(0, 0.35, 0.1);
    dorsal.rotation.z = -0.18; // 뒤로 살짝 기울어
    g.add(dorsal);

    // 가슴지느러미 (날개처럼 넓게)
    for (const s of [-1, 1]) {
      const pec = new THREE.Mesh(geo('ConeGeometry', 0.1, 0.42, 3), mat(color));
      pec.position.set(s * 0.35, -0.08, 0.12);
      pec.rotation.z = s * (Math.PI / 2 + 0.35);
      pec.rotation.x = 0.28;
      g.add(pec);
    }

    // 꼬리 (초승달 모양 — 위아래로 두 개)
    for (const [y, rx] of [[0.14, -0.38], [-0.1, 0.42]]) {
      const tail = new THREE.Mesh(geo('ConeGeometry', 0.1, 0.35, 3), mat(color));
      tail.position.set(0, y, 0.76);
      tail.rotation.x = Math.PI / 2 + rx;
      g.add(tail);
    }

    // 눈 (검은색, 작고 측면에)
    const eye = new THREE.Mesh(geo('SphereGeometry', 0.045, 5, 5), mat(0x111111));
    eye.position.set(0.22, 0.05, -0.52);
    g.add(eye);

    // 입 (넓게 벌어진)
    const jaw = new THREE.Mesh(geo('BoxGeometry', 0.3, 0.06, 0.16), mat(0x334444));
    jaw.position.set(0, -0.1, -0.75);
    jaw.rotation.x = 0.2;
    g.add(jaw);

    return g;
  },

  // 재규어 — 실루엣 포인트: 긴 꼬리 + 낮은 자세 + 점박이 패턴
  jaguar(color) {
    const g = new THREE.Group();

    // 낮고 긴 몸통 (crouching silhouette)
    const body = new THREE.Mesh(geo('BoxGeometry', 0.46, 0.36, 0.98), mat(color));
    body.position.y = 0.2;
    g.add(body);

    // 어깨 (muscular hump)
    const shoulder = new THREE.Mesh(geo('SphereGeometry', 0.24, 6, 5), mat(color));
    shoulder.scale.set(1.1, 0.8, 0.9);
    shoulder.position.set(0, 0.3, -0.28);
    g.add(shoulder);

    // 머리 (크고 둥글게 — 귀여운 비율)
    const head = new THREE.Mesh(geo('SphereGeometry', 0.21, 7, 6), mat(color));
    head.scale.set(1.05, 0.98, 1.0);
    head.position.set(0, 0.36, -0.6);
    g.add(head);

    // 뾰족한 귀
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(geo('ConeGeometry', 0.062, 0.16, 4), mat(color));
      ear.position.set(s * 0.13, 0.56, -0.56);
      g.add(ear);
      const earInner = new THREE.Mesh(geo('ConeGeometry', 0.038, 0.10, 4), mat(0xffaaaa));
      earInner.position.set(s * 0.13, 0.56, -0.565);
      g.add(earInner);
    }

    // 초록 눈 (특징적인 색상)
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(geo('SphereGeometry', 0.045, 5, 5), mat(0x44cc00));
      eye.position.set(s * 0.1, 0.42, -0.78);
      g.add(eye);
      const pupil = new THREE.Mesh(geo('SphereGeometry', 0.025, 4, 4), mat(0x111111));
      pupil.position.set(s * 0.1, 0.42, -0.805);
      g.add(pupil);
    }

    // ★ 긴 꼬리 (핵심 실루엣 — S자 곡선)
    const tailColor = color;
    const tipColor  = mat(0x221100);
    for (let i = 0; i < 6; i++) {
      const r = 0.07 - i * 0.008;
      const tp = new THREE.Mesh(geo('SphereGeometry', Math.max(r, 0.03), 5, 4),
        i === 5 ? tipColor : mat(tailColor));
      const angle = (i / 5.5) * 1.9;
      tp.position.set(0, 0.14 + Math.sin(angle) * 0.2, 0.4 + i * 0.2);
      g.add(tp);
    }

    // 다리 (낮고 굵음)
    for (const x of [-0.18, 0.18]) {
      for (const z of [-0.28, 0.28]) {
        const leg = new THREE.Mesh(geo('CylinderGeometry', 0.058, 0.046, 0.26, 5), mat(color));
        leg.position.set(x, 0.06, z);
        g.add(leg);
      }
    }

    // 점박이 패턴 (납작한 sphere로 — flat disc)
    const spot = mat(0x553300);
    const spots = [[0.19, 0.3, -0.1], [-0.19, 0.3, 0.1], [0, 0.3, 0.18], [0.19, 0.3, 0.28]];
    for (const [sx, sy, sz] of spots) {
      const s = new THREE.Mesh(geo('SphereGeometry', 0.075, 5, 4), spot);
      s.scale.set(1, 0.25, 1);
      s.position.set(sx, sy, sz);
      g.add(s);
    }

    return g;
  },

  // 펭귄 — 실루엣 포인트: 뒤뚱뒤뚱 비율 + 흑백 패턴
  penguin(color) {
    const g = new THREE.Group();

    // 통통하고 세로로 긴 몸통
    const body = new THREE.Mesh(geo('SphereGeometry', 0.24, 7, 6), mat(0x111111));
    body.scale.set(0.82, 1.35, 0.88);
    body.position.y = 0.28;
    g.add(body);

    // 흰 배 (색상 대비 — 펭귄의 핵심 패턴)
    const belly = new THREE.Mesh(geo('SphereGeometry', 0.2, 7, 6), mat(0xffffff));
    belly.scale.set(0.6, 1.1, 0.55);
    belly.position.set(0, 0.28, -0.08);
    g.add(belly);

    // 큰 머리 (body와 거의 같은 크기 — 귀여운 비율)
    const head = new THREE.Mesh(geo('SphereGeometry', 0.2, 7, 6), mat(0x111111));
    head.scale.set(0.95, 1.0, 0.95);
    head.position.set(0, 0.66, -0.04);
    g.add(head);

    // 흰 얼굴 패치
    const face = new THREE.Mesh(geo('SphereGeometry', 0.16, 6, 5), mat(0xffffff));
    face.scale.set(0.78, 0.82, 0.4);
    face.position.set(0, 0.68, -0.12);
    g.add(face);

    // 눈 (귀엽고 크게)
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(geo('SphereGeometry', 0.045, 5, 5), mat(0x111111));
      eye.position.set(s * 0.09, 0.72, -0.19);
      g.add(eye);
      const shine = new THREE.Mesh(geo('SphereGeometry', 0.018, 4, 4), mat(0xffffff));
      shine.position.set(s * 0.1, 0.74, -0.225);
      g.add(shine);
    }

    // 부리 (주황색 — 대비)
    const beak = new THREE.Mesh(geo('ConeGeometry', 0.04, 0.12, 4), mat(0xff8800));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.65, -0.24);
    g.add(beak);

    // 지느러미 팔 (날개 형태)
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(geo('BoxGeometry', 0.08, 0.28, 0.14), mat(0x111111));
      fin.position.set(s * 0.28, 0.32, -0.02);
      fin.rotation.z = s * 0.22;
      fin.rotation.x = 0.18;
      g.add(fin);
    }

    // 통통한 발 (주황색)
    for (const s of [-1, 1]) {
      const foot = new THREE.Mesh(geo('BoxGeometry', 0.12, 0.06, 0.22), mat(0xff8800));
      foot.position.set(s * 0.1, 0.03, -0.06);
      g.add(foot);
    }

    return g;
  },

  // 사마귀 — 실루엣 포인트: 삼각형 머리 + 낫 모양 앞발
  mantis(color) {
    const g = new THREE.Group();

    // 가늘고 긴 몸통
    const body = new THREE.Mesh(geo('BoxGeometry', 0.12, 0.14, 0.55), mat(color));
    body.position.y = 0.38;
    g.add(body);

    // 삼각형 머리 (특징적)
    const head = new THREE.Mesh(geo('ConeGeometry', 0.1, 0.18, 4), mat(color));
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.48, -0.4);
    g.add(head);

    // 큰 복잡한 눈
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(geo('SphereGeometry', 0.055, 6, 6), mat(0x00aa44));
      eye.position.set(s * 0.08, 0.52, -0.5);
      g.add(eye);
    }

    // ★ 낫 모양 앞발 (두 마디)
    for (const s of [-1, 1]) {
      // 위 마디
      const arm1 = new THREE.Mesh(geo('BoxGeometry', 0.06, 0.28, 0.06), mat(0x336600));
      arm1.position.set(s * 0.14, 0.52, -0.2);
      arm1.rotation.z = s * 0.5;
      g.add(arm1);
      // 낫 마디 (꺾임)
      const arm2 = new THREE.Mesh(geo('BoxGeometry', 0.04, 0.25, 0.05), mat(0x224400));
      arm2.position.set(s * 0.22, 0.36, -0.24);
      arm2.rotation.z = s * 1.1;
      g.add(arm2);
    }

    // 뒷다리 (얇은 3쌍)
    for (let i = 0; i < 2; i++) {
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(geo('CylinderGeometry', 0.014, 0.01, 0.32, 4), mat(color));
        leg.position.set(s * 0.1, 0.22, 0.05 + i * 0.2);
        leg.rotation.z = s * 1.2;
        g.add(leg);
      }
    }

    return g;
  },

  // 코브라 — 실루엣 포인트: 펼쳐진 후드 + S자 몸통
  cobra(color) {
    const g = new THREE.Group();

    // S자 몸통 (여러 세그먼트)
    const bodyMat = mat(color);
    const segments = 6;
    for (let i = 0; i < segments; i++) {
      const r = 0.09 - i * 0.01;
      const seg = new THREE.Mesh(geo('SphereGeometry', Math.max(r, 0.04), 6, 5), bodyMat);
      const angle = (i / segments) * 2.2;
      seg.position.set(Math.sin(angle) * 0.12, 0.06 + (segments - i) * 0.09, i * 0.14);
      g.add(seg);
    }

    // ★ 펼쳐진 후드 (핵심 — 납작한 원형)
    const hood = new THREE.Mesh(geo('CylinderGeometry', 0.32, 0.18, 0.06, 8), mat(0xcc2200));
    hood.position.set(Math.sin(2.2) * 0.12, 0.06 + segments * 0.09, (segments - 1) * 0.14);
    g.add(hood);

    // 머리
    const head = new THREE.Mesh(geo('SphereGeometry', 0.13, 6, 5), mat(color));
    head.scale.set(1.2, 0.75, 1.3);
    head.position.set(Math.sin(2.6) * 0.1, 0.06 + segments * 0.09 + 0.12, (segments) * 0.14);
    g.add(head);

    // 눈
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(geo('SphereGeometry', 0.03, 5, 5), mat(0xff4400));
      eye.position.set(
        Math.sin(2.6) * 0.1 + s * 0.06,
        0.06 + segments * 0.09 + 0.14,
        (segments) * 0.14 - 0.08
      );
      g.add(eye);
    }

    // 혀 (두 갈래)
    for (const s of [-1, 1]) {
      const tongue = new THREE.Mesh(geo('CylinderGeometry', 0.006, 0.003, 0.12, 4), mat(0xff2222));
      tongue.position.set(
        Math.sin(2.6) * 0.1 + s * 0.03,
        0.06 + segments * 0.09 + 0.11,
        (segments) * 0.14 - 0.2
      );
      tongue.rotation.x = -0.4;
      tongue.rotation.z = s * 0.2;
      g.add(tongue);
    }

    return g;
  },
};

// ── 타입 → 빌더 매핑 ─────────────────────────────────────────────
// 전용 빌더 우선 배정 → silhouette 차별화
const SHAPE_MAP = {
  // 곤충 — 전용 빌더
  dragonfly:'dragonfly', butterfly:'butterfly', bee:'bee',
  grasshopper:'grasshopper', mantis:'mantis', cricket:'ground',
  cicada:'flying', ladybug:'ground', beetle:'ground',
  stag:'flying', worm:'ground', mole:'ground',
  snail:'ground', pill_bug:'ground', centipede:'ground', firefly:'flying',

  // 연못
  frog:'frog', tadpole:'water', water_strider:'ground',
  water_beetle:'water', larvae:'ground',
  leech:'ground', crayfish:'crab', salamander:'ground',
  crucian:'fish', loach:'fish', catfish:'fish', soft_turtle:'ground',
  heron:'flying',

  // 바다 — 상어 전용
  crab:'crab', conch:'ground', abalone:'ground',
  octopus:'jellyfish', starfish:'ground',
  shark:'shark', giant_shark:'shark',             // ★ 전용 빌더
  puffer:'fish', jellyfish:'jellyfish', ray:'fish', whale:'fish',

  // 열대/사바나
  parrot:'flying', chameleon:'ground', sloth:'ground',
  iguana:'ground', spider:'ground',
  zebra:'large', ostrich:'large',
  hyena:'large', croc:'large',
  cheetah:'jaguar', jaguar:'jaguar',               // ★ 전용 빌더
  snow_leopard:'jaguar',                           // ★ 같은 실루엣 공유
  cobra:'cobra',                                   // ★ 전용 빌더
  polar_bear:'large', penguin:'penguin',            // ★ 전용 빌더
  reindeer:'large', mammoth:'large', gorilla:'large',
  elephant:'large', rhino:'large',

  // 공룡
  pteranodon:'pteranodon', stegosaurus:'large', triceratops:'large',
  brachiosaurus:'large', raptor:'large', t_rex:'t_rex',
  spinosaurus:'large', ankylosaurus:'large', parasaurolophus:'large',
  giganotosaurus:'large',

  // 우주
  drone:'flying', alien:'flying', debris:'flying',
  giant_beetle:'large', ufo:'ufo',
};

// ── 이동 스타일 분류 ─────────────────────────────────────────────
const FLYING_STYLES  = new Set(['erratic_hover','flap_drift','buzz_hover','soar_circle','ufo_hover','pulse_drift']);
const WATER_STYLES   = new Set(['swim_curve','pulse_drift']);
const GROUND_STYLES  = new Set(['walk_wander','hop_pause','sidewalk','stomp_charge','stalk_charge','circle_charge']);

export class Creature {
  /**
   * @param {THREE.Scene} scene
   * @param {object} config  — creatures cfg (type, color, speed, …)
   * @param {number} spawnArea — 랜덤 스폰 반경 (기본 40)
   * @param {{x:number,z:number}|null} spawnHint — World.getSpawnPosition() 결과
   *   null이면 완전 랜덤, 아니면 hint 좌표 ± 15 m 범위 내 스폰
   */
  constructor(scene, config, spawnArea = 40, spawnHint = null) {
    this.scene      = scene;
    this.config     = config;
    this.captured   = false;
    this.alive      = true;
    this.time       = Math.random() * Math.PI * 2;
    this.isBoss     = config.phases !== undefined;
    this.phase      = 0;
    this.spawnArea  = spawnArea;
    this._spawnHint = spawnHint; // 서식지 힌트 (구역 시스템)

    // 프로필 적용
    const prof = PROFILES[config.type] || DEFAULT_PROFILE;
    this.profile = { ...DEFAULT_PROFILE, ...prof };

    // 이동 상태
    this._state       = 'WANDER'; // WANDER | FLEE | AGGRO | ATTACK | HOP_WAIT | CIRCLE
    this._stateTimer  = 0;
    this._targetPos   = new THREE.Vector3();
    this._wanderTimer = 0;
    this._wanderInterval = 2 + Math.random() * 3;
    this._hopTimer    = 0;
    this._hopDur      = 0;
    this._hopVel      = new THREE.Vector3();
    this._circleAngle = Math.random() * Math.PI * 2;
    this._attackCooldown = 0;
    this._isCharging  = false;
    this._chargeTarget = new THREE.Vector3();
    this._aggroed     = false;

    this._buildMesh();
    this._randomSpawn();
    this._newWanderTarget();
  }

  // ── 메시 생성 ────────────────────────────────────────────────
  _buildMesh() {
    const key = SHAPE_MAP[this.config.type] || 'flying';
    const builder = BUILDERS[key] || BUILDERS.flying;
    this.mesh = builder(this.config.color || 0x88aaff);

    const scale = this.isBoss ? 3.0 : (['large','t_rex','pteranodon'].includes(key) ? 1.4 : 0.9);
    this.mesh.scale.setScalar(scale);

    // ── 지면 그림자 링 — 생물 위치를 바닥에서 직관적으로 표시 ──
    // 그림자 없는 환경에서도 "여기 있다"는 시각 신호 제공
    const shadowRing = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 10),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    shadowRing.rotation.x = -Math.PI / 2;
    shadowRing.position.y = -0.5; // 생물 발 아래
    this.mesh.add(shadowRing);
    this._shadowRing = shadowRing;

    if (this.isBoss) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.config.name, 128, 40);
      const tex = new THREE.CanvasTexture(canvas);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
      );
      label.position.y = 4.5;
      this.mesh.add(label);
      this.label = label;
    }

    this.scene.add(this.mesh);
  }

  _randomSpawn() {
    const style    = this.profile.style;
    const isFlying = FLYING_STYLES.has(style);

    let sx, sz;
    if (this._spawnHint) {
      // 서식지 힌트 ± 15 m 내 스폰 — 구역 생태계 반영
      const scatter = 15;
      sx = this._spawnHint.x + (Math.random() - 0.5) * scatter * 2;
      sz = this._spawnHint.z + (Math.random() - 0.5) * scatter * 2;
    } else {
      const half = this.spawnArea;
      sx = (Math.random() - 0.5) * half * 2;
      sz = (Math.random() - 0.5) * half * 2;
    }

    this.mesh.position.set(
      sx,
      isFlying ? 1.5 + Math.random() * 3 : 0.3,
      sz
    );
    this.baseY = this.mesh.position.y;
  }

  _newWanderTarget() {
    const half = this.spawnArea * 0.9;
    const style = this.profile.style;
    const isFlying = FLYING_STYLES.has(style);
    this._targetPos.set(
      (Math.random() - 0.5) * half * 2,
      isFlying ? 1.0 + Math.random() * 4 : 0.3,
      (Math.random() - 0.5) * half * 2
    );
  }

  // ── 포획 확률 계산 ────────────────────────────────────────────
  // 모듈 레벨 임시 벡터(_tv0, _tv1) 재사용 → 매 호출 new Vector3() 방지
  getCaptureChance(playerPos, _playerForward) {
    const prof = this.profile;
    // 생물 앞 방향 (로컬 -Z)
    _tv0.set(
      -Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y)
    ).normalize();
    // 생물→플레이어 벡터 (모듈 레벨 임시 벡터 재사용)
    _tv1.copy(playerPos).sub(this.mesh.position).normalize();
    const approachDot = _tv0.dot(_tv1); // +1=정면, -1=후방
    const t = (approachDot + 1) / 2;   // 0(후방) ~ 1(전방)
    const baseChance = prof.captureChanceFront * t + prof.captureChanceBack * (1 - t);
    // 거리 10 이내 접근 보너스 (가까이 다가갈수록 포획 쉬워짐)
    const distToCreature = this.mesh.position.distanceTo(playerPos);
    const closeBonus = distToCreature < 10 ? 0.1 : 0;
    return Math.min(1, baseChance + closeBonus);
  }

  // ── 메인 업데이트 ─────────────────────────────────────────────
  update(delta, playerPos, onDamage) {
    if (!this.alive || this.captured) return;
    this.time += delta;
    this._stateTimer += delta;
    if (this._attackCooldown > 0) this._attackCooldown -= delta;

    const style   = this.profile.style;
    const speed   = (this.config.speed || 1);
    const distToPlayer = this.mesh.position.distanceTo(playerPos);
    // 플레이어 근접 시 도주 속도 부스트 (15유닛 이내)
    const _proximityBoost = (distToPlayer < 15 && this._state === 'FLEE') ? 1.4 : 1.0;

    // ── 상태 전환 결정 ───────────────────────────────────────
    this._updateState(distToPlayer, playerPos, speed);

    // ── 미끼 유인 — _baitTimer 동안 _baitTarget 쪽으로 WANDER ──
    // 공격/도주 중이 아닐 때만 적용 (전투 AI 우선)
    if (this._baitTimer > 0) {
      this._baitTimer -= delta;
      if (this._state !== 'ATTACK' && this._state !== 'AGGRO') {
        this._targetPos.copy(this._baitTarget);
        this._state = 'WANDER';
        this._wanderTimer = 0;
      }
    }

    // ── 이동 스타일별 처리 ───────────────────────────────────
    const _boostedSpeed = speed * _proximityBoost;
    switch (style) {
      case 'erratic_hover':   this._moveErraticHover(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'flap_drift':      this._moveFlapDrift(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'buzz_hover':      this._moveBuzzHover(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'hop_pause':       this._moveHopPause(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'swim_curve':      this._moveSwimCurve(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'sidewalk':        this._moveSidewalk(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'pulse_drift':     this._movePulseDrift(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'walk_wander':     this._moveWalkWander(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'soar_circle':     this._moveSoarCircle(delta, playerPos, distToPlayer, _boostedSpeed); break;
      case 'circle_charge':   this._moveCircleCharge(delta, playerPos, distToPlayer, _boostedSpeed, onDamage); break;
      case 'stalk_charge':    this._moveStalkCharge(delta, playerPos, distToPlayer, _boostedSpeed, onDamage); break;
      case 'stomp_charge':    this._moveStompCharge(delta, playerPos, distToPlayer, _boostedSpeed, onDamage); break;
      case 'ufo_hover':       this._moveUfoHover(delta, playerPos, distToPlayer, _boostedSpeed); break;
      default:                this._moveWalkWander(delta, playerPos, distToPlayer, _boostedSpeed); break;
    }

    // ── 공통 애니메이션 ──────────────────────────────────────
    this._animateWings();
    this._animateBoss(delta);
    this._faceDirection(delta);

    if (this.label) {
      // _tv2 재사용 — 매 프레임 new Vector3() 방지
      this.label.getWorldPosition(_tv2);
      this.label.lookAt(playerPos.x, _tv2.y, playerPos.z);
    }
  }

  _updateState(distToPlayer, playerPos, speed) {
    const prof = this.profile;

    // ── 진행 중인 특수 상태는 외부에서 강제 전환 금지 ─────────
    // RETREAT: 돌진 실패 후퇴 완료될 때까지 보호
    // HOP_WAIT: 착지 후 scan 완료될 때까지 보호
    // ROAR: 포효 완료될 때까지 보호
    if (this._state === 'RETREAT' || this._state === 'HOP_WAIT' ||
        this._state === 'ROAR') return;

    // 공격형 동물 — AGGRO
    if (prof.aggroRange > 0 && !this.isBoss) {
      if (distToPlayer < prof.aggroRange && this._state !== 'ATTACK') {
        this._state = 'AGGRO';
      } else if (distToPlayer >= prof.aggroRange && this._state === 'AGGRO') {
        this._state = 'WANDER';
        this._stateTimer = 0;
        this._hasRoared = false; // aggro 범위 벗어나면 다음 진입 시 다시 포효
      }
    }

    // 도망형 동물 — FLEE
    if (prof.fleeRadius > 0 && distToPlayer < prof.fleeRadius && this._state !== 'ATTACK') {
      if (this._state !== 'FLEE') {
        // 첫 FLEE 진입 — alert 리셋 (다음 도망 시 다시 freeze)
        this._alertDone  = false;
        this._alertTimer = 0;
      }
      this._state = 'FLEE';
    } else if (this._state === 'FLEE' && distToPlayer > prof.fleeRadius * 1.5) {
      this._state = 'WANDER';
      this._stateTimer  = 0;
      this._wanderTimer = 0;
    }
  }

  // ── 이동 스타일 구현 ─────────────────────────────────────────

  // 잠자리: micro-hover (이동 → 순간정지 → 급방향전환) + 수직 탈출
  _moveErraticHover(delta, playerPos, distToPlayer, speed) {
    const prof = this.profile;

    if (this._state === 'FLEE') {
      // ── 수직 탈출: 위로 솟구치며 지그재그 ─────────────────
      _tv0.copy(this.mesh.position).sub(playerPos);
      _tv0.y = 0;
      _tv0.normalize();

      // 앞에서 오는지 체크
      _tv1.set(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y));
      const frontApproach = -_tv1.dot(_tv0); // creatureFwd·toPlayer = -creatureFwd·away
      const mult = 1 + Math.max(0, frontApproach) * (prof.frontFleeBoost - 1);

      this.mesh.position.addScaledVector(_tv0, speed * 3.5 * mult * delta);
      // 상승 탈출 (잠자리 특유 — 땅 쪽으로 도망가지 않음)
      this.baseY = Math.min((this.baseY ?? 2) + 2.8 * delta, 7);

      this._wanderTimer += delta;
      if (this._wanderTimer > 0.1 + Math.random() * 0.18) {
        this._wanderTimer = 0;
        this.mesh.position.x += (Math.random() - 0.5) * 1.8;
        this.mesh.position.z += (Math.random() - 0.5) * 1.8;
      }
    } else {
      // ── Micro-hover 패턴: 이동(0.3s) → 완전정지(0.1s) 반복 ─
      // 정지 순간이 "잠자리다운 느낌"의 핵심
      if (this._microTimer === undefined) { this._microTimer = 0; this._microPhase = 'move'; }
      this._microTimer -= delta;

      if (this._microTimer <= 0) {
        if (this._microPhase === 'move') {
          this._microPhase  = 'freeze';
          this._microTimer  = 0.06 + Math.random() * 0.12; // 순간 정지
          this._newWanderTarget();                           // 정지 시 다음 방향 결정
        } else {
          this._microPhase = 'move';
          this._microTimer = 0.22 + Math.random() * 0.55;
        }
      }

      if (this._microPhase === 'move') {
        _tv0.copy(this._targetPos).sub(this.mesh.position);
        _tv0.y = 0;
        if (_tv0.length() > 0.5) {
          _tv0.normalize();
          this.mesh.position.addScaledVector(_tv0, speed * 2.8 * delta);
        }
      }
      // freeze 시: 완전 정지 (추가 이동 없음)
    }

    this.baseY = this.baseY ?? 2;
    this.mesh.position.y = this.baseY + Math.sin(this.time * 4.5 + this.spawnArea) * 0.35;
    this.mesh.position.y = Math.max(1.0, this.mesh.position.y);
  }

  // 나비: 부드럽게 떠다님
  _moveFlapDrift(delta, playerPos, distToPlayer, speed) {
    if (this._state === 'FLEE') {
      _tv0.copy(this.mesh.position).sub(playerPos); _tv0.normalize();
      this.mesh.position.addScaledVector(_tv0, speed * 2.5 * delta);
    } else {
      this._wanderTimer += delta;
      if (this._wanderTimer > this._wanderInterval) {
        this._newWanderTarget();
        this._wanderTimer = 0;
        this._wanderInterval = 2 + Math.random() * 3;
      }
      _tv0.copy(this._targetPos).sub(this.mesh.position);
      if (_tv0.length() > 0.5) {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 1.2 * delta);
      }
    }
    this.baseY = this.baseY ?? 2;
    this.mesh.position.y = this.baseY + Math.sin(this.time * 1.8) * 0.5 + Math.cos(this.time * 0.9) * 0.2;
    this.mesh.position.y = Math.max(0.8, this.mesh.position.y);
  }

  // 꿀벌: 8자 패턴 호버
  _moveBuzzHover(delta, playerPos, distToPlayer, speed) {
    if (this._state === 'FLEE') {
      // XZ 평면에서만 도망 (Y 성분 제거 → 위로 솟지 않음)
      const ax = this.mesh.position.x - playerPos.x;
      const az = this.mesh.position.z - playerPos.z;
      const aLen = Math.sqrt(ax * ax + az * az) || 1;
      this.mesh.position.x += (ax / aLen) * speed * 2 * delta;
      this.mesh.position.z += (az / aLen) * speed * 2 * delta;
    } else {
      this._wanderTimer += delta;
      if (this._wanderTimer > this._wanderInterval) {
        this._newWanderTarget();
        this._wanderTimer = 0;
        this._wanderInterval = 3 + Math.random() * 2;
      }
      // 8자 패턴
      const cx = this._targetPos.x, cz = this._targetPos.z;
      const figureX = cx + Math.sin(this.time * 1.5) * 1.5;
      const figureZ = cz + Math.sin(this.time * 3.0) * 0.75;
      const dir = new THREE.Vector3(figureX - this.mesh.position.x, 0, figureZ - this.mesh.position.z);
      if (dir.length() > 0.1) {
        dir.normalize();
        this.mesh.position.addScaledVector(dir, speed * 2.5 * delta);
      }
    }
    this.baseY = this.baseY ?? 2;
    this.mesh.position.y = this.baseY + Math.sin(this.time * 4) * 0.15;
    this.mesh.position.y = Math.max(1.0, this.mesh.position.y);
  }

  // 개구리/메뚜기: 홉-정지  (메뚜기는 ALERT → BURST flee 포함)
  _moveHopPause(delta, playerPos, distToPlayer, speed) {
    const prof = this.profile;

    // ── HOP_WAIT: 착지 후 좌우 살피기 (scan) ─────────────────────
    if (this._state === 'HOP_WAIT') {
      this._hopTimer -= delta;
      // 착지 후 머리를 좌우로 흔드는 scan
      this.mesh.rotation.y += Math.sin(this.time * 1.5) * 0.04;
      if (this._hopTimer <= 0) {
        this._state = 'WANDER';
        this._newWanderTarget();
      }
      this.mesh.position.y = 0.3;
      return;
    }

    // ── FLEE 진입 시 ALERT freeze ─────────────────────────────────
    if (this._state === 'FLEE') {
      // ALERT: 처음 위험 감지 → 0.18s 정지 후 BURST
      if (!this._alertDone) {
        this._alertTimer = (this._alertTimer ?? 0) + delta;
        if (this._alertTimer < 0.18) {
          // 위험 방향으로 회전만 (점프 없음)
          _tv0.copy(playerPos).sub(this.mesh.position); _tv0.y = 0;
          if (_tv0.lengthSq() > 0.01) {
            const targetY = Math.atan2(_tv0.x, _tv0.z);
            let d = targetY - this.mesh.rotation.y;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            this.mesh.rotation.y += d * 0.35;
          }
          this.mesh.position.y = 0.3;
          return; // 정지
        }
        // ALERT 완료 → BURST 돌입
        this._alertDone  = true;
        this._burstCount = 3 + Math.floor(Math.random() * 3); // 3~5회 연속 점프
        this._burstTimer = 0;
      }

      // BURST 연속 점프
      if ((this._burstCount ?? 0) > 0) {
        this._burstTimer = (this._burstTimer ?? 0) + delta;
        // 0.22s 간격으로 한 번씩 점프 (빠른 리듬)
        const hopInterval = 0.22;
        _tv0.copy(this.mesh.position).sub(playerPos); _tv0.y = 0; _tv0.normalize();
        _tv1.set(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y));
        const frontApproach = -_tv1.dot(_tv0);
        const mult = 1 + Math.max(0, frontApproach) * (prof.frontFleeBoost - 1);
        this.mesh.position.addScaledVector(_tv0, speed * 5.5 * mult * delta);
        this.mesh.position.y = 0.3 + Math.abs(Math.sin(this._burstTimer / hopInterval * Math.PI)) * 1.1;
        if (this._burstTimer >= hopInterval) {
          this._burstTimer = 0;
          this._burstCount--;
        }
        return;
      }

      // BURST 완료 → 일반 flee 홉 (더 느림)
      _tv0.copy(this.mesh.position).sub(playerPos); _tv0.y = 0; _tv0.normalize();
      this.mesh.position.addScaledVector(_tv0, speed * 3 * delta);
      this.mesh.position.y = 0.3 + Math.abs(Math.sin(this.time * 8)) * 0.8;
      return;
    }

    // ── WANDER: 목표 방향으로 홉 ──────────────────────────────────
    this._wanderTimer += delta;
    _tv0.copy(this._targetPos).sub(this.mesh.position);
    const dist2d = Math.sqrt(_tv0.x * _tv0.x + _tv0.z * _tv0.z);
    if (dist2d < 0.8 || this._wanderTimer > this._wanderInterval) {
      this._state = 'HOP_WAIT';
      this._hopTimer = 0.8 + Math.random() * 1.5;
      this._wanderTimer = 0;
      this._wanderInterval = 1.5 + Math.random() * 2.5;
      this.mesh.position.y = 0.3;
    } else {
      _tv0.y = 0;
      _tv0.normalize();
      this.mesh.position.addScaledVector(_tv0, speed * 4 * delta);
      this.mesh.position.y = 0.3 + Math.abs(Math.sin(this.time * 10)) * 0.7;
    }
  }

  // 물고기: 부드러운 곡선 이동
  _moveSwimCurve(delta, playerPos, distToPlayer, speed) {
    if (this._state === 'FLEE') {
      _tv0.copy(this.mesh.position).sub(playerPos); _tv0.y = 0; _tv0.normalize();
      this.mesh.position.addScaledVector(_tv0, speed * 2.5 * delta);
    } else {
      this._wanderTimer += delta;
      if (this._wanderTimer > this._wanderInterval) {
        this._newWanderTarget();
        this._wanderTimer = 0;
        this._wanderInterval = 3 + Math.random() * 4;
      }
      _tv0.copy(this._targetPos).sub(this.mesh.position); _tv0.y = 0;
      if (_tv0.length() > 0.5) {
        _tv0.normalize();
        // 부드러운 곡선을 위해 좌우 사인파 추가
        _tv0.x += Math.sin(this.time * 0.8) * 0.25;
        _tv0.z += Math.cos(this.time * 0.6) * 0.25;
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 2 * delta);
      }
    }
    this.mesh.position.y = 0.4; // 수면 고정
  }

  // 게: 옆걸음
  _moveSidewalk(delta, playerPos, distToPlayer, speed) {
    if (this._state === 'FLEE') {
      // 대각선 도망 — 모듈 레벨 temp 벡터 재사용
      _tv0.copy(this.mesh.position).sub(playerPos); _tv0.y = 0; _tv0.normalize();
      _tv1.set(-_tv0.z, 0, _tv0.x); // away 의 수직 방향
      _tv1.multiplyScalar(Math.sign(Math.sin(this.time * 2)));
      _tv0.add(_tv1).normalize();
      this.mesh.position.addScaledVector(_tv0, speed * 2.5 * delta);
    } else {
      this._wanderTimer += delta;
      if (this._wanderTimer > this._wanderInterval) {
        this._newWanderTarget();
        this._wanderTimer = 0;
        this._wanderInterval = 2 + Math.random() * 3;
      }
      _tv0.copy(this._targetPos).sub(this.mesh.position); _tv0.y = 0;
      if (_tv0.length() > 0.5) {
        _tv0.normalize();
        _tv1.set(-_tv0.z, 0, _tv0.x); // 90° 측면
        this.mesh.position.addScaledVector(_tv1, speed * 1.5 * delta);
        this.mesh.position.addScaledVector(_tv0, speed * 0.5 * delta);
      }
    }
    this.mesh.position.y = 0.15;
  }

  // 해파리: 위아래 펄스
  _movePulseDrift(delta, playerPos, distToPlayer, speed) {
    if (this._state === 'FLEE') {
      _tv0.copy(this.mesh.position).sub(playerPos); _tv0.normalize();
      this.mesh.position.addScaledVector(_tv0, speed * 1.5 * delta);
    } else {
      this._wanderTimer += delta;
      if (this._wanderTimer > this._wanderInterval) {
        this._newWanderTarget();
        this._wanderTimer = 0;
        this._wanderInterval = 4 + Math.random() * 5;
      }
      _tv0.copy(this._targetPos).sub(this.mesh.position);
      if (_tv0.length() > 0.5) {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 0.8 * delta);
      }
    }
    // 펄스 위아래
    this.baseY = this.baseY ?? 1.5;
    this.mesh.position.y = this.baseY + Math.sin(this.time * 2) * 0.6;
    this.mesh.position.y = Math.max(0.5, this.mesh.position.y);
  }

  // 기본 배회
  _moveWalkWander(delta, playerPos, distToPlayer, speed) {
    if (this._state === 'FLEE') {
      _tv0.copy(this.mesh.position).sub(playerPos); _tv0.y = 0; _tv0.normalize();
      // 도주 중 랜덤 방향 변경 (빈도 0.035/frame — 빠른 지그재그)
      if (Math.random() < 0.035) {
        const angle = (Math.random() - 0.5) * Math.PI * 0.6;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const nx = _tv0.x * cos - _tv0.z * sin;
        const nz = _tv0.x * sin + _tv0.z * cos;
        _tv0.x = nx; _tv0.z = nz;
      }
      this.mesh.position.addScaledVector(_tv0, speed * 2.5 * delta);
    } else if (this._state === 'AGGRO') {
      _tv0.copy(playerPos).sub(this.mesh.position); _tv0.y = 0;
      if (_tv0.length() > 0.5) {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 1.8 * delta);
      }
    } else {
      this._wanderTimer += delta;
      if (this._wanderTimer > this._wanderInterval) {
        this._newWanderTarget();
        this._wanderTimer = 0;
        this._wanderInterval = 2 + Math.random() * 3;
      }
      _tv0.copy(this._targetPos).sub(this.mesh.position); _tv0.y = 0;
      if (_tv0.length() > 0.5) {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 2 * delta);
      }
    }
    this.mesh.position.y = 0.3;
  }

  // 익룡: 원선 비행
  _moveSoarCircle(delta, playerPos, distToPlayer, speed) {
    if (this._state === 'FLEE') {
      const away = this.mesh.position.clone().sub(playerPos).normalize();
      this.mesh.position.addScaledVector(away, speed * 3 * delta);
    } else {
      // 플레이어 중심 원선 비행 (크게)
      this._circleAngle += delta * speed * 0.6;
      const radius = 12 + Math.sin(this.time * 0.3) * 4;
      this.mesh.position.x = playerPos.x + Math.cos(this._circleAngle) * radius;
      this.mesh.position.z = playerPos.z + Math.sin(this._circleAngle) * radius;
    }
    this.baseY = 4 + Math.sin(this.time * 0.7) * 2;
    this.mesh.position.y = this.baseY;
  }

  // 상어/하이에나: 원선 → 돌진
  // 상어: 좁혀드는 원형 패턴 → 임계 반지름에서 돌진 → 리셋
  _moveCircleCharge(delta, playerPos, distToPlayer, speed, onDamage) {
    const prof = this.profile;

    if (this._isCharging) {
      // 돌진 중 — 직선 쇄도
      _tv0.copy(this._chargeTarget).sub(this.mesh.position);
      const dist = _tv0.length();
      if (dist < 0.8) {
        if (distToPlayer < 2.5 && this._attackCooldown <= 0) {
          this._attackCooldown = prof.attackCooldown;
          if (onDamage) onDamage(prof.damage);
        }
        this._isCharging    = false;
        this._state         = 'CIRCLE';
        this._stateTimer    = 0;
        this._circleRadius  = 8.0; // 돌진 후 큰 원으로 리셋
      } else {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 6 * delta);
      }
      this.mesh.position.y = 0.4;
      return;
    }

    if (this._state === 'AGGRO' || this._state === 'CIRCLE') {
      // ── 좁혀드는 나선 ──────────────────────────────────────────
      // 진입 시 반지름 초기화
      if (this._circleRadius === undefined) this._circleRadius = 8.0;
      if (this._circleAngle  === undefined) this._circleAngle  = 0;

      // 매 프레임 반지름 축소 (8 → 3)
      this._circleRadius = Math.max(3.0, this._circleRadius - 1.6 * delta);
      // 각속도: 반지름 작을수록 빠르게 (실제 상어 행동 모사)
      const angSpeed = speed * (0.7 + (8 - this._circleRadius) * 0.08);
      this._circleAngle += angSpeed * delta;

      const tx = playerPos.x + Math.cos(this._circleAngle) * this._circleRadius;
      const tz = playerPos.z + Math.sin(this._circleAngle) * this._circleRadius;
      // 부드럽게 목표 궤도로 당김
      this.mesh.position.x += (tx - this.mesh.position.x) * 3.5 * delta;
      this.mesh.position.z += (tz - this.mesh.position.z) * 3.5 * delta;
      this.mesh.position.y  = 0.4;

      // 돌진 트리거: 반지름이 임계값 이하 또는 타이머 초과
      const chargeReady = this._circleRadius <= 3.2 || this._stateTimer > 4.5;
      if (chargeReady && this._attackCooldown <= 0) {
        this._isCharging = true;
        this._chargeTarget.copy(playerPos);
        this._stateTimer = 0;
      }
    } else if (this._state === 'WANDER') {
      this._moveWalkWander(delta, playerPos, distToPlayer, speed * 0.6);
    }
  }

  // 재규어/랩터: 측면 잠복(플랭킹) → 빠른 돌진 → RETREAT 후퇴
  _moveStalkCharge(delta, playerPos, distToPlayer, speed, onDamage) {
    const prof = this.profile;

    // ── RETREAT: 돌진 직후 뒤로 물러남 ──────────────────────────
    if (this._state === 'RETREAT') {
      this._retreatTimer = (this._retreatTimer ?? 0) + delta;
      _tv0.copy(this.mesh.position).sub(playerPos); _tv0.y = 0; _tv0.normalize();
      this.mesh.position.addScaledVector(_tv0, speed * 3.5 * delta);
      this.mesh.position.y = 0.3;
      if (this._retreatTimer >= 1.5) {
        this._retreatTimer = 0;
        this._state        = 'AGGRO';  // 다시 잠복 접근
        this._stateTimer   = 0;
        // 다음 측면 각도 갱신 (반대편으로 플랭킹)
        this._flankAngle   = (this._flankAngle ?? 0) + Math.PI + (Math.random() - 0.5) * 0.6;
      }
      return;
    }

    if (this._isCharging) {
      _tv0.copy(playerPos).sub(this.mesh.position); _tv0.y = 0;
      const dist = _tv0.length();
      if (dist < 1.5) {
        if (this._attackCooldown <= 0) {
          this._attackCooldown = prof.attackCooldown;
          if (onDamage) onDamage(prof.damage);
        }
        this._isCharging  = false;
        this._state       = 'RETREAT'; // 돌진 후 항상 RETREAT
        this._retreatTimer = 0;
        this._stateTimer  = 0;
      } else {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 6.5 * delta);
      }
      this.mesh.position.y = 0.3;
      return;
    }

    if (this._state === 'AGGRO') {
      // ── 플랭킹 잠복: 플레이어 측면 90° 지점으로 접근 ──────────
      if (this._flankAngle === undefined) {
        // 처음 어그로 — 현재 각도에서 ±90° 오프셋
        _tv0.copy(playerPos).sub(this.mesh.position);
        this._flankAngle = Math.atan2(_tv0.x, _tv0.z) + (Math.PI / 2) * (Math.random() > 0.5 ? 1 : -1);
      }

      // 플랭크 목표: playerPos + 측면 벡터 * stalkDist
      const stalkDist = Math.max(3.5, distToPlayer * 0.6);
      const tx = playerPos.x + Math.sin(this._flankAngle) * stalkDist;
      const tz = playerPos.z + Math.cos(this._flankAngle) * stalkDist;

      _tv0.set(tx - this.mesh.position.x, 0, tz - this.mesh.position.z);
      if (_tv0.length() > 0.5) {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 1.8 * delta);
      }
      this.mesh.position.y = 0.3;

      // 돌진 조건: 플랭크 위치 근접 + 플레이어 사정거리 내
      const flankDist = Math.sqrt((this.mesh.position.x - tx) ** 2 + (this.mesh.position.z - tz) ** 2);
      if ((flankDist < 2.0 || distToPlayer < prof.aggroRange * 0.42) && this._stateTimer > 0.8) {
        this._isCharging = true;
        this._stateTimer = 0;
      }
    } else {
      this._moveWalkWander(delta, playerPos, distToPlayer, speed * 0.7);
    }
  }

  // T렉스/매머드: 포효(ROAR) → 느린 추적(발구름) → 강한 돌진
  _moveStompCharge(delta, playerPos, distToPlayer, speed, onDamage) {
    const prof = this.profile;

    // ── ROAR 상태: 첫 어그로 시 1.2s 포효 ────────────────────────
    if (this._state === 'ROAR') {
      this._roarTimer = (this._roarTimer ?? 0) + delta;
      this.mesh.userData.roaring = true; // 외부에서 연기/VFX 트리거용
      // 포효 중 몸체 미세 진동 (분노)
      this.mesh.rotation.z = Math.sin(this._roarTimer * 18) * 0.04;
      if (this._roarTimer >= 1.2) {
        this._hasRoared            = true;
        this.mesh.userData.roaring = false;
        this.mesh.rotation.z       = 0;
        this._roarTimer            = 0;
        this._state                = 'AGGRO';
        this._stateTimer           = 0;
      }
      return;
    }

    if (this._isCharging) {
      _tv0.copy(playerPos).sub(this.mesh.position); _tv0.y = 0;
      const dist = _tv0.length();
      if (dist < 2.0) {
        if (this._attackCooldown <= 0) {
          this._attackCooldown = prof.attackCooldown;
          if (onDamage) onDamage(prof.damage);
        }
        this._isCharging = false;
        this._state      = 'AGGRO';
        this._stateTimer = 0;
      } else {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 4.5 * delta);
      }
      this.mesh.position.y = 0.4;
      return;
    }

    if (this._state === 'AGGRO') {
      // 첫 어그로 진입 시 포효
      if (!this._hasRoared) {
        this._state     = 'ROAR';
        this._roarTimer = 0;
        return;
      }

      // 느린 추적 + 발구름 (무게감)
      _tv0.copy(playerPos).sub(this.mesh.position); _tv0.y = 0;
      if (_tv0.length() > 3) {
        _tv0.normalize();
        this.mesh.position.addScaledVector(_tv0, speed * 1.2 * delta);
      }
      // 발구름 바디 밥: 3.5Hz, 진폭 0.08 (무거운 육중한 보행감)
      this.mesh.position.y = 0.4 + Math.abs(Math.sin(this.time * 3.5)) * 0.08;

      // 돌진 조건
      if (distToPlayer < prof.aggroRange * 0.55 && this._stateTimer > 2.0) {
        this._isCharging = true;
        this._stateTimer = 0;
      }
    } else {
      this._moveWalkWander(delta, playerPos, distToPlayer, speed * 0.5);
    }
  }

  // UFO 보스: 호버 + 빔
  _moveUfoHover(delta, playerPos, distToPlayer, speed) {
    this._wanderTimer += delta;
    if (this._wanderTimer > this._wanderInterval) {
      this._newWanderTarget();
      this._wanderTimer = 0;
      this._wanderInterval = 4 + Math.random() * 6;
    }
    const dir = this._targetPos.clone().sub(this.mesh.position);
    dir.y = 0;
    if (dir.length() > 2) {
      dir.normalize();
      this.mesh.position.addScaledVector(dir, speed * 1.5 * delta);
    }
    this.baseY = 5 + Math.sin(this.time * 0.5) * 1.5;
    this.mesh.position.y = this.baseY;
  }

  // ── 공통 애니메이션 ──────────────────────────────────────────
  _animateWings() {
    if (!this.mesh.userData.wings) return;
    const flap = Math.sin(this.time * 12) * 0.4;
    this.mesh.userData.wings.forEach(wing => {
      const dir = wing.position.x < 0 ? 1 : -1;
      wing.rotation.y = dir * (0.25 + flap);
    });
  }

  _animateBoss(delta) {
    if (!this.isBoss) return;
    this.mesh.rotation.y += delta * 0.5;
    if (this.mesh.userData.podGroup) {
      this.mesh.userData.podGroup.rotation.y += delta * 1.2;
    }
    if (this.mesh.userData.beam) {
      this.mesh.userData.beam.material.opacity = 0.1 + Math.sin(this.time * 3) * 0.06;
    }
  }

  _faceDirection(_delta) {
    // _tv2 재사용: pos - _prevPos (매 프레임 clone() 방지)
    const pos = this.mesh.position;
    if (!this._prevPos) { this._prevPos = new THREE.Vector3().copy(pos); return; }
    _tv2.copy(pos).sub(this._prevPos);
    _tv2.y = 0;
    if (_tv2.lengthSq() > 0.0001) {
      const targetAngle = Math.atan2(_tv2.x, _tv2.z);
      let diff = targetAngle - this.mesh.rotation.y;
      while (diff > Math.PI)  diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * 0.15;
    }
    this._prevPos.copy(pos);
  }

  // ── 포획 ─────────────────────────────────────────────────────
  capture() {
    this.captured = true;
    this.alive = false;
    this._captureEffect();
    this.scene.remove(this.mesh);
  }

  _captureEffect() {
    // particlePool 위임:
    // - 단일 Game loop 에서 update() 호출 → orphan RAF 없음
    // - 고정 풀 재사용 → GC 없음
    // - deltaTime 기반 정확한 물리 시뮬레이션
    particlePool.emit(this.scene, this.mesh.position, this.config.color ?? 0xffff00);
  }

  dispose() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);

    // 지오메트리 해제 — 캐시 외 개별 인스턴스만 (공유 캐시는 게임 전체 지속)
    this.mesh.traverse(child => {
      if (!child.isMesh) return;
      if (child.geometry && !_cachedGeos.has(child.geometry)) {
        child.geometry.dispose();
      }
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => m.dispose());
      }
    });
    this.mesh = null;
  }
}
