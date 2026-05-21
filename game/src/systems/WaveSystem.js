import * as THREE from 'three';
import { Creature } from '../entities/Creature.js';
import { DIFFICULTY } from '../data/stages.js';

// terrain Y 스냅에서 제외할 스타일:
//  - 비행형: 공중에서 자체 Y 제어
//  - 수중형: 수면(y=0.4) 고정 자체 제어
const _FLYING_STYLES_WS = new Set([
  'erratic_hover', 'flap_drift', 'buzz_hover',
  'soar_circle', 'ufo_hover', 'pulse_drift',
  'swim_curve', 'sidewalk', // 수중·수면 생물 — y 자체 관리
]);

export class WaveSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {object} stageData
   * @param {object} settings
   * @param {Function} onCapture
   * @param {Function} onWaveComplete
   * @param {Function} onStageComplete
   * @param {Function} onStageFail
   * @param {Function} onDamage
   * @param {World|null} world  — 구역 기반 스폰을 위한 World 레퍼런스 (옵셔널)
   */
  constructor(scene, stageData, settings, onCapture, onWaveComplete, onStageComplete, onStageFail, onDamage, world = null) {
    this.scene = scene;
    this.stage = stageData;
    this.settings = settings;
    this.onCapture = onCapture;
    this.onWaveComplete = onWaveComplete;
    this.onStageComplete = onStageComplete;
    this.onStageFail = onStageFail;
    this.onDamage = onDamage || (() => {}); // 플레이어 피격 콜백
    this.world  = world;   // 서식지 구역 스폰용 (null 허용 — 기존 랜덤 스폰으로 fallback)
    // 매 프레임 forEach 안에서 클로저 생성 방지 → 생성자에서 한 번만 바인딩
    this._damageCallback = dmg => this.onDamage(dmg);
    this._frame = 0; // LOD용 프레임 카운터

    const diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    this.timeLimit = stageData.timeLimit + diff.timeBonus;
    this.timeRemaining = this.timeLimit;
    this.targetCount = Math.ceil(stageData.targetCount * diff.countMult);
    this.capturedCount = 0;
    this.currentWave = 1;
    this.maxWaves = stageData.miniBoss ? 4 : 3;
    this.creatures = [];
    this.waveActive = false;
    this.miniBossSpawned = false;
    this.active = true;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this._spawnRings = []; // 스폰 링 이펙트 목록
    this.onWaveClear = null; // (nextWave, spawnFn) — 업그레이드 카드 훅
    this._spawnWave(1);
  }

  _spawnWave(wave) {
    this.currentWave = wave;
    this.waveActive = true;
    const diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;

    if (wave <= 3) {
      // 일반 웨이브 – 스폰 수 0.4 → 1.0 (맵이 비어보이지 않게)
      const spawnMultiplier = wave === 1 ? 1.0 : wave === 2 ? 1.5 : 2.0;
      // 웨이브 1 최소 스폰 거리: 플레이어로부터 30유닛 이상
      const minSpawnDist = wave === 1 ? 30 : 0;
      this.stage.creatures.forEach(cfg => {
        const count = Math.ceil(cfg.count * spawnMultiplier * diff.countMult * 1.0);
        const speedMult = diff.speedMult * (wave === 3 ? 1.3 : 1.0);
        for (let i = 0; i < count; i++) {
          // 서식지 기반 스폰: World가 있으면 생물 타입의 선호 구역에 배치
          // 없으면 기존 랜덤 스폰으로 fallback (하위 호환)
          const hint = this.world ? this.world.getSpawnPosition(cfg.type) : null;
          const creature = new Creature(this.scene, { ...cfg, speed: cfg.speed * speedMult }, 110, hint); // spawnArea: 플레이 반경 120m 전체 분포
          // 웨이브 1: 플레이어 위치(원점 기준)에서 최소 30유닛 이상 보장
          if (minSpawnDist > 0) {
            const pos = creature.mesh.position;
            const dx = pos.x, dz = pos.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < minSpawnDist) {
              const scale = minSpawnDist / Math.max(d, 0.1);
              pos.x *= scale;
              pos.z *= scale;
            }
          }
          // LOD 분산 — 같은 프레임에 몰리지 않도록 오프셋 배정
          creature._tickOffset = this.creatures.length & 3; // 0~3 순환
          this.creatures.push(creature);
          // 스폰 링 이펙트 (웨이브 2+ 만 — 웨이브1은 게임 시작 직후라 어색함)
          if (wave > 1) this._emitSpawnRing(creature.mesh.position, false, wave);
        }
      });
    } else if (wave === 4 && this.stage.miniBoss) {
      // 미니보스는 랜드마크 주변에 등장시켜 극적 효과 강화
      const hint = this.world ? this.world.getSpawnPosition(this.stage.miniBoss.type) : null;
      const boss = new Creature(this.scene, this.stage.miniBoss, 110, hint);
      this.creatures.push(boss);
      this.miniBossSpawned = true;
      this._emitSpawnRing(boss.mesh.position, true); // 보스 링 (빨간색, 크고 오래)
    }

    if (this.onWaveComplete) {
      this.onWaveComplete(wave, wave === 1); // wave 1: isInitial=true(sfx 스킵), 그 외 false(배너+sfx)
    }
  }

  update(delta, playerPos, player) {
    if (!this.active) return;

    // 타이머
    this.timeRemaining -= delta;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.active = false;
      this.onStageFail();
      return;
    }

    // 콤보 타이머
    if (this.combo > 0) {
      this.comboTimer += delta;
      if (this.comboTimer > 3) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }

    // ── 스폰 링 이펙트 업데이트 ─────────────────────────────────
    for (let i = this._spawnRings.length - 1; i >= 0; i--) {
      const r = this._spawnRings[i];
      r.t += delta;
      const p = r.t / r.maxT; // 0 → 1
      r.ring.scale.setScalar(1 + p * 5);
      r.mat.opacity = Math.max(0, (1 - p) * 0.95);
      if (r.t >= r.maxT) {
        this.scene.remove(r.ring);
        r.geo.dispose();
        r.mat.dispose();
        this._spawnRings.splice(i, 1);
      }
    }

    // ── AI LOD 업데이트 ──────────────────────────────────────────
    // 기본: 60유닛 이상은 4프레임에 1번 update
    // _lodSkip >= 2(저사양 모드): 30유닛 이상도 격프레임 처리
    this._frame = (this._frame + 1) & 255;
    const lodSkip = this._lodSkip ?? 1; // 1=정상, 2=절전
    let aliveCount = 0;

    for (const c of this.creatures) {
      if (!c.alive) continue;

      const dist = c.mesh.position.distanceTo(playerPos);
      // 거리 기반 스킵 임계치: 정상=60, 절전=30
      const skipThresh = lodSkip >= 2 ? 30 : 60;
      const skipMask   = lodSkip >= 2 ? 1  : 3;  // 절전: 2프레임에 1번
      if (dist > skipThresh && ((this._frame + (c._tickOffset ?? 0)) & skipMask) !== 0) {
        aliveCount++;
        continue;
      }

      c.update(delta, playerPos, this._damageCallback);
      // 지상 생물 지형 클리핑 방지 — 비행·수중 스타일 제외하고 terrain Y에 스냅
      if (c.alive && this.world && !_FLYING_STYLES_WS.has(c.profile?.style)) {
        const ty = Math.max(0, this.world.getHeight(c.mesh.position.x, c.mesh.position.z));
        if (c.mesh.position.y < ty + 0.05) c.mesh.position.y = ty + 0.05;
      }
      if (c.alive) aliveCount++;
    }

    // 웨이브 완료 체크 — filter() 대신 카운터 사용
    if (aliveCount === 0 && this.waveActive) {
      this.waveActive = false;
      const nextWave = this.currentWave + 1;
      if (nextWave <= this.maxWaves) {
        const isBoss = nextWave === 4 && this.stage.miniBoss;
        const label  = isBoss ? '👑 보스 등장' : `웨이브 ${nextWave}`;
        const doSpawn = () => {
          [3, 2, 1].forEach((n, idx) => {
            setTimeout(() => {
              if (this.onWaveComplete) this.onWaveComplete(`⚡ ${label} 준비 ${n}`, true);
            }, idx * 350);
          });
          setTimeout(() => this._spawnWave(nextWave), 1500);
        };
        if (this.onWaveClear) {
          this.onWaveClear(nextWave, doSpawn);
        } else {
          doSpawn();
        }
      }
    }

    // 클리어 체크
    if (this.capturedCount >= this.targetCount) {
      this.active = false;
      const timeUsed = this.timeLimit - this.timeRemaining;
      this.onStageComplete({
        captured:     this.capturedCount,
        timeLeft:     this.timeRemaining,
        maxCombo:     this.maxCombo,
        timeUsed:     Math.max(1, timeUsed),
        totalSpawned: this.creatures.length,
        // 초당 포획 속도
        capturePerSec: timeUsed > 0 ? (this.capturedCount / timeUsed).toFixed(2) : '0.00',
        // 포획률 (스폰 대비)
        captureRate: this.creatures.length > 0
          ? Math.round(this.capturedCount / this.creatures.length * 100) : 100,
      });
    }
  }

  // ── 스폰 링 이펙트 ────────────────────────────────────────────
  _emitSpawnRing(pos, isBoss = false, wave = 0) {
    // 웨이브 3은 주황색으로 긴장감 표현
    const color  = isBoss ? 0xff4400 : wave === 3 ? 0xff6600 : 0x4ecdc4;
    const radius = isBoss ? 1.2 : 0.6;
    const geo = new THREE.TorusGeometry(radius, 0.06, 4, 20);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(pos);
    ring.position.y = 0.08;
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this._spawnRings.push({ ring, geo, mat, t: 0, maxT: isBoss ? 0.7 : 0.45 });
  }

  // ── 포획 시도 (확률 기반) ─────────────────────────────────────
  tryCapture(playerPos, playerForward, captureRange, luckBonus = 0) {
    if (!this.active) return null;

    for (const creature of this.creatures) {
      if (!creature.alive || creature.captured) continue;

      const toCreature = creature.mesh.position.clone().sub(playerPos);
      const dist = toCreature.length();
      const adjustedRange = captureRange * (creature.isBoss ? 1.5 : 1.0);

      if (dist > adjustedRange) continue;

      // 플레이어가 생물을 향하고 있는가? (XZ 평면 기준 — 공중 생물도 포획 가능)
      const xzLen = Math.sqrt(toCreature.x * toCreature.x + toCreature.z * toCreature.z);
      const dot = xzLen > 0.01
        ? (toCreature.x * playerForward.x + toCreature.z * playerForward.z) / xzLen
        : 1; // 생물이 바로 위에 있으면 항상 향하고 있는 것으로 간주
      if (dot < (creature.isBoss ? 0.0 : 0.1)) continue;

      // 종별 포획 확률 체크 + 럭키 보너스 (업그레이드 카드)
      const chance = Math.min(1, creature.getCaptureChance(playerPos, playerForward) + luckBonus);
      if (Math.random() > chance) continue; // 확률 실패 → 놓침

      creature.capture();
      this.capturedCount++;
      this.combo++;
      this.comboTimer = 0;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      const diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
      const weatherMult = this.settings.weather === 'rain' ? 1.2
                        : this.settings.weather === 'snow' ? 1.3
                        : this.settings.weather === 'fog'  ? 1.5 : 1;
      const timeMult = this.settings.timeOfDay === 'night' ? 1.4
                     : this.settings.timeOfDay === 'dusk'  ? 1.1 : 1;
      const coinMult  = diff.coinMult  * weatherMult * timeMult;
      const coins  = Math.floor(creature.config.coins * coinMult);
      const score  = Math.floor(creature.config.score * diff.scoreMult * this._comboMult());

      this.onCapture({ creature, coins, score, combo: this.combo });
      return { creature, coins, score };
    }
    return null;
  }

  _comboMult() {
    if (this.combo >= 15) return 2.5;
    if (this.combo >= 10) return 2.0;
    if (this.combo >= 5)  return 1.5;
    if (this.combo >= 3)  return 1.2;
    return 1.0;
  }

  /** 소모품 '시간 연장' 사용 시 타이머 증가 */
  addTime(seconds) {
    this.timeRemaining = Math.min(this.timeRemaining + seconds, this.timeLimit + 60);
  }

  getState() {
    const COMBO_MAX = 3; // 콤보 유지 시간(초)
    return {
      timeRemaining: Math.ceil(this.timeRemaining),
      captured: this.capturedCount,
      target: this.targetCount,
      wave: this.currentWave,
      combo: this.combo,
      // 콤보 타이머 비율 (1.0 = 방금 포획, 0 = 곧 만료)
      comboTimeRatio: this.combo > 0 ? Math.max(0, 1 - this.comboTimer / COMBO_MAX) : 0,
    };
  }

  dispose() {
    this.creatures.forEach(c => c.dispose());
    this.creatures = [];
    // 남은 스폰 링 정리
    this._spawnRings.forEach(r => {
      this.scene.remove(r.ring);
      r.geo.dispose();
      r.mat.dispose();
    });
    this._spawnRings = [];
  }
}
