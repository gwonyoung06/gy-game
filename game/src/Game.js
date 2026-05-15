import * as THREE from 'three';
import { STAGES, DIFFICULTY } from './data/stages.js';
import { Player } from './entities/Player.js';
import { World } from './systems/World.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { CameraController } from './systems/CameraController.js';
import { HUD } from './ui/HUD.js';
import { Shop } from './ui/Shop.js';
import { Inventory } from './ui/Inventory.js';
import { Minimap } from './ui/Minimap.js';
import { loadSave, addCoins, markStageCleared, updateSave } from './utils/storage.js';
import { SHOP_ITEMS, CONSUMABLES } from './data/shop.js';
import { particlePool, _cachedMats, _cachedGeos } from './entities/Creature.js';
import { audioManager } from './systems/AudioManager.js';
import { submitScore, fetchGlobalLeaderboard } from './utils/supabase.js';

// 스킬 쿨다운 테이블
const SKILL_CD = {
  skill_slow: 30, skill_magnet: 45,
  skill_multi: 40, skill_vortex: 60,
};

export class Game {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.camCtrl = null;
    this.player = null;
    this.world = null;
    this.waves = null;
    this.hud       = new HUD();
    this.shop      = new Shop(() => this._onShopClose());
    this.inventory = new Inventory(
      document.getElementById('screen-inventory'),
      () => this._onInventoryClose()
    );
    this.minimap   = null; // 게임 시작 시 생성
    this.currentScreen = 'title';

    // 스킬 슬롯별 쿨다운 { Q, E, R }
    this._slotCDs  = { Q: 0, E: 0, R: 0 };
    this.selectedStage = 1;
    this.settings = { difficulty: 'easy', weather: 'sunny', timeOfDay: 'day' };
    this.totalCoins = 0;
    this.sessionScore = 0;
    this.sessionCoins = 0;
    this.rafId = null;
    this.clock = new THREE.Timer();

    this._titleRafId   = null;
    this._titleScene   = null;
    this._titleCamera  = null;

    this._initRenderer();
    this._initScreens();
    this._initTouchControls();

    // Wrap _showScreen to manage title 3D scene lifecycle
    const _origShow = this._showScreen.bind(this);
    this._showScreen = (name) => {
      _origShow(name);
      if (name === 'title') this._startTitleScene();
      else                  this._stopTitleScene();
    };

    this._showScreen('title');
  }

  // ── 렌더러 초기화 ──────────────────────────────────────────────
  _initRenderer() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // far 클리핑 2000 → 1000×1000 맵 전체 커버
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      if (this._titleCamera) {
        this._titleCamera.aspect = window.innerWidth / window.innerHeight;
        this._titleCamera.updateProjectionMatrix();
      }
    });
  }

  // ── 화면 전환 ─────────────────────────────────────────────────
  _showScreen(name) {
    const noFade = name === 'game' || name === 'pause';
    const fade = document.getElementById('fade-overlay');
    const doSwitch = () => {
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      const el = document.getElementById(`screen-${name}`);
      if (el) el.classList.remove('hidden');
      this.currentScreen = name;
    };
    if (!fade || noFade) { doSwitch(); return; }
    fade.classList.add('fade-out');
    clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      doSwitch();
      fade.classList.remove('fade-out');
    }, 220);
  }

  // ── 화면 이벤트 연결 ──────────────────────────────────────────
  _initScreens() {
    // 버튼 클릭 사운드 — 전역 위임 (btn 클래스 있는 버튼만)
    document.addEventListener('click', e => {
      if (e.target.closest('.btn, .opt-btn, .tab-btn, .stage-card')) {
        audioManager.sfxUIClick();
      }
    });

    // 타이틀
    document.getElementById('btn-start').addEventListener('click', () => {
      this._showScreen('stage-select');
      this._renderStageGrid();
    });
    document.getElementById('btn-leaderboard').addEventListener('click', () => {
      this._showScreen('leaderboard');
      this._renderLeaderboard('global');
    });

    // 스테이지 선택
    document.getElementById('btn-back-from-stage').addEventListener('click', () => this._showScreen('title'));

    // 게임 설정
    document.getElementById('btn-back-from-pregame').addEventListener('click', () => this._showScreen('stage-select'));
    document.getElementById('btn-play').addEventListener('click', () => this._startGame());

    this._initOptionGroup('difficulty-options', v => { this.settings.difficulty = v; });
    this._initOptionGroup('weather-options',    v => { this.settings.weather = v; });
    this._initOptionGroup('time-options',       v => { this.settings.timeOfDay = v; });

    // 결과
    document.getElementById('btn-to-shop').addEventListener('click', () => {
      this._showScreen('shop');
      this.shop.open(this.selectedStage);
    });
    document.getElementById('btn-retry').addEventListener('click', () => this._startGame());
    document.getElementById('btn-quit-result').addEventListener('click', () => {
      this._cleanup();
      this._showScreen('title');
    });
    document.getElementById('btn-next-stage').addEventListener('click', () => {
      this.selectedStage = Math.min(this.selectedStage + 1, STAGES.length);
      this._startGame();
    });
    document.getElementById('btn-register').addEventListener('click', () => this._registerScore());

    // 리더보드
    document.getElementById('btn-back-from-lb').addEventListener('click', () => this._showScreen('title'));
    document.querySelectorAll('#screen-leaderboard .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#screen-leaderboard .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderLeaderboard(btn.dataset.tab);
      });
    });

    // ── 일시정지 메뉴 버튼 ────────────────────────────────────
    document.getElementById('btn-resume').addEventListener('click', () => this._resumeGame());

    document.getElementById('btn-pause-shop').addEventListener('click', () => {
      this.hud.hide();
      this._showScreen('shop');
      this.shop.open(this.selectedStage);
    });

    document.getElementById('btn-quit-to-title').addEventListener('click', () => {
      this._stopLoop();
      this._cleanup();
      this.hud.hide();
      this._showScreen('title');
    });

    // 좌클릭 → 포인터락 요청 or 포획
    this.renderer.domElement.addEventListener('click', e => {
      if (this.currentScreen !== 'game') return;
      if (e.button !== 0) return;
      if (!this.camCtrl?.isLocked) {
        // 잠금 안 됐으면 먼저 잠금 요청
        this.camCtrl?.requestLock();
      } else {
        // 잠금 상태면 포획
        this._tryCapture();
      }
    });

    // ── 설정 패널 ────────────────────────────────────────────────
    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      const panel = document.getElementById('pause-settings-panel');
      if (panel) panel.classList.toggle('hidden');
    });

    const loadSettings = () => {
      const s = JSON.parse(localStorage.getItem('gy_settings') || '{"sens":100,"music":70,"sfx":100}');
      document.getElementById('setting-sens').value = s.sens;
      document.getElementById('setting-music').value = s.music;
      document.getElementById('setting-sfx').value = s.sfx;
      document.getElementById('sens-val').textContent = s.sens;
      document.getElementById('music-val').textContent = s.music;
      document.getElementById('sfx-val').textContent = s.sfx;
      if (this.camCtrl) this.camCtrl.sensitivity = 0.0028 * (s.sens / 100);
      audioManager.setMusicVolume?.(s.music / 100);
      audioManager.setSfxVolume?.(s.sfx / 100);
    };

    const saveSettings = () => {
      const sens  = parseInt(document.getElementById('setting-sens').value);
      const music = parseInt(document.getElementById('setting-music').value);
      const sfx   = parseInt(document.getElementById('setting-sfx').value);
      localStorage.setItem('gy_settings', JSON.stringify({ sens, music, sfx }));
      document.getElementById('sens-val').textContent = sens;
      document.getElementById('music-val').textContent = music;
      document.getElementById('sfx-val').textContent = sfx;
      if (this.camCtrl) this.camCtrl.sensitivity = 0.0028 * (sens / 100);
      audioManager.setMusicVolume?.(music / 100);
      audioManager.setSfxVolume?.(sfx / 100);
    };

    ['setting-sens', 'setting-music', 'setting-sfx'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', saveSettings);
    });
    loadSettings();

    // 키보드
    document.addEventListener('keydown', e => {
      if (this.currentScreen === 'game') {
        // 스킬 슬롯 Q / E / R
        if (e.code === 'KeyQ') this._useSkillSlot('Q');
        if (e.code === 'KeyE') this._useSkillSlot('E');
        if (e.code === 'KeyR') this._useSkillSlot('R');

        // 핫바 1~9
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) this._useHotbarSlot(num - 1);

        // I: 인벤토리
        if (e.code === 'KeyI') {
          this._stopLoop();
          this.hud.hide();
          this._showScreen('inventory');
          this.inventory.open(this.player?.mesh ?? null);
        }

        // P: 상점
        if (e.code === 'KeyP') {
          this._stopLoop();
          this.hud.hide();
          document.exitPointerLock();
          this._showScreen('shop');
          this.shop.open(this.selectedStage);
        }
      }

      // ESC: 게임 중 → 일시정지 / 일시정지 중 → 재개
      if (e.code === 'Escape') {
        if (this.currentScreen === 'game') {
          this._pauseGame();
        } else if (this.currentScreen === 'pause') {
          this._resumeGame();
        } else if (this.currentScreen === 'inventory') {
          this.inventory.close();
        }
      }
    });
  }

  // ── 모바일 터치 컨트롤 ────────────────────────────────────────
  _initTouchControls() {
    const panel    = document.getElementById('touch-controls');
    const jZone    = document.getElementById('joystick-zone');
    const jBase    = document.getElementById('joystick-base');
    const jKnob    = document.getElementById('joystick-knob');
    const btnCap   = document.getElementById('btn-touch-capture');
    const btnPause = document.getElementById('btn-touch-pause');
    if (!panel) return;

    const MAX_R = 32; // 조이스틱 최대 반경 px
    let jTouchId = null, lookTouchId = null;
    let lookPrevX = 0, lookPrevY = 0;
    let jx = 0, jy = 0; // 정규화된 조이스틱 입력 (-1~1)

    const showPanel = (show) => {
      panel.classList.toggle('hidden', !show);
    };

    // 게임 화면 전환 시 터치 패널 표시/숨김
    const origShow = this._showScreen.bind(this);
    this._showScreen = (name) => {
      origShow(name);
      showPanel(name === 'game');
    };

    // 조이스틱 터치
    jZone.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (jTouchId === null) {
          jTouchId = t.identifier;
          jx = 0; jy = 0;
        }
      }
    }, { passive: false });

    jZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== jTouchId) continue;
        const rect = jBase.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top  + rect.height / 2;
        const dx = t.clientX - cx;
        const dy = t.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const clamp = Math.min(dist, MAX_R);
        const angle = Math.atan2(dy, dx);
        jx = Math.cos(angle) * (clamp / MAX_R);
        jy = Math.sin(angle) * (clamp / MAX_R);
        jKnob.style.transform = `translate(${Math.cos(angle)*clamp}px, ${Math.sin(angle)*clamp}px)`;
      }
    }, { passive: false });

    const jEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === jTouchId) {
          jTouchId = null; jx = 0; jy = 0;
          jKnob.style.transform = 'translate(0,0)';
        }
      }
    };
    jZone.addEventListener('touchend',    jEnd, { passive: false });
    jZone.addEventListener('touchcancel', jEnd, { passive: false });

    // 오른쪽 드래그 → 카메라 룩
    const canvas = this.renderer.domElement;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const isLeft = t.clientX < window.innerWidth * 0.5;
        if (!isLeft && lookTouchId === null) {
          lookTouchId = t.identifier;
          lookPrevX = t.clientX;
          lookPrevY = t.clientY;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== lookTouchId) continue;
        const dx = t.clientX - lookPrevX;
        const dy = t.clientY - lookPrevY;
        lookPrevX = t.clientX;
        lookPrevY = t.clientY;
        this.camCtrl?.applyTouchLook(dx, dy);
      }
    }, { passive: false });

    const lookEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    };
    canvas.addEventListener('touchend',    lookEnd, { passive: false });
    canvas.addEventListener('touchcancel', lookEnd, { passive: false });

    // 포획 버튼
    btnCap.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.currentScreen === 'game') this._tryCapture();
    }, { passive: false });

    // 일시정지 버튼
    btnPause.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.currentScreen === 'game') this._pauseGame();
    }, { passive: false });

    // 게임 루프에서 조이스틱 입력을 Player.keys에 매핑
    this._touchJoystick = () => {
      if (!this.player) return;
      this.player.keys['KeyW'] = jy < -0.3;
      this.player.keys['KeyS'] = jy >  0.3;
      this.player.keys['KeyA'] = jx < -0.3;
      this.player.keys['KeyD'] = jx >  0.3;
    };
  }

  _initOptionGroup(groupId, onChange) {
    document.getElementById(groupId).addEventListener('click', e => {
      const btn = e.target.closest('.opt-btn');
      if (!btn) return;
      document.querySelectorAll(`#${groupId} .opt-btn`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.value);
    });
  }

  // ── 스테이지 그리드 ───────────────────────────────────────────
  _renderStageGrid() {
    const save = loadSave();
    this.totalCoins = save.coins;
    document.getElementById('total-coins').textContent = save.coins;

    const grid = document.getElementById('stage-grid');
    grid.innerHTML = '';

    STAGES.forEach(stage => {
      const unlocked = stage.id === 1 || save.clearedStages.includes(stage.id - 1);
      const cleared  = save.clearedStages.includes(stage.id);
      const best     = save.highScores[stage.id] || 0;

      const card = document.createElement('div');
      card.className = `stage-card${unlocked ? '' : ' locked'}${cleared ? ' cleared' : ''}`;
      card.innerHTML = `
        <div class="stage-num">${stage.id}</div>
        <div class="stage-theme-icon">${stage.icon}</div>
        <div class="stage-name">${stage.name}</div>
        ${cleared  ? `<div class="stage-cleared">✅ ${best.toLocaleString()}점</div>` : ''}
        ${!unlocked ? '<div class="stage-cleared">🔒 잠김</div>' : ''}
      `;
      if (unlocked) {
        card.addEventListener('click', () => {
          this.selectedStage = stage.id;
          document.getElementById('pregame-title').textContent = `${stage.id}스테이지 - ${stage.name}`;
          this._showScreen('pregame');
        });
      }
      grid.appendChild(card);
    });

    const bonusStages = [
      { id: 'bonus1', name: '황금 생물',  icon: '✨', unlock: () => save.clearedStages.includes(5)  },
      { id: 'bonus2', name: '야간 혼돈',  icon: '🌙', unlock: () => save.clearedStages.includes(10) },
      { id: 'bonus3', name: '혼돈 스테이지', icon: '🌀', unlock: () => save.clearedStages.includes(14) },
    ];
    bonusStages.forEach(bs => {
      const unlocked = bs.unlock();
      const card = document.createElement('div');
      card.className = `stage-card${unlocked ? '' : ' locked'}`;
      if (unlocked) card.style.borderColor = '#ffd700';
      card.innerHTML = `
        <div class="stage-num" style="color:#ffd700">★</div>
        <div class="stage-theme-icon">${bs.icon}</div>
        <div class="stage-name">${bs.name}</div>
        ${!unlocked ? '<div class="stage-cleared">🔒 잠김</div>' : ''}
      `;
      grid.appendChild(card);
    });
  }

  // ── 업적 시스템 ───────────────────────────────────────────────
  _showAchievement(icon, title) {
    const pop = document.getElementById('achievement-popup');
    const iconEl = document.getElementById('ach-icon');
    const titleEl = document.getElementById('ach-title');
    if (!pop || !iconEl || !titleEl) return;
    iconEl.textContent = icon;
    titleEl.textContent = title;
    pop.classList.remove('hidden');
    clearTimeout(this._achTimer);
    setTimeout(() => pop.classList.add('ach-show'), 10);
    this._achTimer = setTimeout(() => {
      pop.classList.remove('ach-show');
      setTimeout(() => pop.classList.add('hidden'), 400);
    }, 3000);
  }

  _checkAchievement(id, icon, title) {
    const key = `gy_ach_${id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    this._showAchievement(icon, title);
  }

  // ── 게임 시작 ─────────────────────────────────────────────────
  _startGame() {
    try {
      this._startGameImpl();
    } catch (err) {
      console.error('[_startGame] crash:', err);
      this._showScreen('title');
      const msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#c00;color:#fff;padding:12px;font-size:13px;z-index:9999;white-space:pre-wrap;word-break:break-all;';
      msg.textContent = '게임 시작 오류:\n' + (err?.stack || err);
      document.body.appendChild(msg);
      setTimeout(() => msg.remove(), 20000);
    }
  }

  _startGameImpl() {
    this._stopTitleScene();
    this._stopLoop();
    this._cleanup();

    const stageData = STAGES.find(s => s.id === this.selectedStage);
    if (!stageData) return;

    this.sessionScore = 0;
    this.sessionCoins = 0;
    this.playerHP = 100;
    this.playerMaxHP = 100;
    this._invincibleTimer = 0;
    const save = loadSave();
    this.totalCoins = save.coins;

    this.scene = new THREE.Scene();
    this.world  = new World(this.scene, stageData, this.settings);
    this.player = new Player(this.scene);
    this._applyShopEffects();
    this.camCtrl = new CameraController(this.camera, this.renderer.domElement);
    const _s = JSON.parse(localStorage.getItem('gy_settings') || '{"sens":100}');
    this.camCtrl.sensitivity = 0.0028 * (_s.sens / 100);

    this.waves = new WaveSystem(
      this.scene, stageData, this.settings,
      (data)   => this._onCapture(data),
      (wave, isCountdown) => {
        this.hud.showWaveMessage(wave, isCountdown);
        if (!isCountdown) audioManager.sfxWaveComplete();
      },
      (result) => this._onStageComplete(result),
      ()       => this._onStageFail(),
      (dmg)    => this._onDamage(dmg),
      this.world
    );

    const minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
      this.minimap = new Minimap(minimapCanvas, stageData.id, this.world._zones, 130);
    }

    audioManager.init();
    audioManager.setBiome(stageData.id);
    audioManager.setState('exploration');

    this.hud.show(`스테이지 ${stageData.id} - ${stageData.name}`);
    this._showScreen('game');
    this._startLoop();

    this._watchLockState();

    const seen = localStorage.getItem('gy_tutorial_seen');
    if (!seen) {
      this._showTutorial();
    } else {
      this._showLockHint(true);
    }
  }

  // ── 게임 루프 ─────────────────────────────────────────────────
  _startLoop() {
    const loop = (timestamp) => {
      this.rafId = requestAnimationFrame(loop);
      this.clock.update(timestamp);
      const delta = Math.min(this.clock.getDelta(), 0.05);

      if (this.player && this.waves && this.camCtrl) {
        // 모바일 조이스틱 → Player.keys 매핑
        this._touchJoystick?.();
        // 1. 플레이어 이동 (카메라 방향 기준)
        this.player.update(delta, this.camCtrl, this.world);
        // 2. 카메라를 플레이어 뒤로 배치 (이동 여부·방향 전달 → 자동 추적 + sway)
        this.camCtrl.update(
          this.player.position,
          this.player._isMoving,
          this.player.mesh.rotation.y,
          delta
        );
        // 3. 생물 / 웨이브 업데이트
        this.waves.update(delta, this.player.position, this.player);
        this.world?.update(delta);
        // 포획 파티클 풀 — Game loop 통합으로 orphan RAF 없음
        particlePool.update(delta);

        const state = this.waves.getState();
        this.hud.update(state, this.totalCoins, delta, this.sessionScore);
        this.hud.updateHP(this.playerHP, this.playerMaxHP);

        // 무적 타이머
        if (this._invincibleTimer > 0) this._invincibleTimer -= delta;
        // 슬롯별 쿨다운 감소
        for (const key of ['Q', 'E', 'R']) {
          if (this._slotCDs[key] > 0) this._slotCDs[key] = Math.max(0, this._slotCDs[key] - delta);
        }

        // 미니맵 업데이트
        if (this.minimap) {
          const creatures   = this.waves.creatures ?? [];
          const landmarks   = this.world?._zones?.landmarks ?? [];
          const structures  = this.world?._structures ?? [];
          this.minimap.update(this.player.position, creatures, landmarks, structures);
        }

        // 생물 이름표 + 타이머 긴박감
        this._updateCreatureLabels();
        this._updateTimerUrgency(this.waves.getState().timeRemaining);
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop(0);
  }

  _stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── 생물 이름표 (근거리 생물 위에 이름·코인 DOM 레이블) ────────
  _updateCreatureLabels() {
    if (!this.waves || !this.player || !this.camera) return;
    let container = document.getElementById('creature-labels');
    if (!container) return;

    const W = window.innerWidth, H = window.innerHeight;
    const playerPos = this.player.position;
    const LABEL_RANGE = 14;
    const _v = new THREE.Vector3();

    const near = this.waves.creatures.filter(c =>
      c.alive && !c.captured && c.mesh.position.distanceTo(playerPos) < LABEL_RANGE
    );

    // 기존 레이블 재사용 (DOM 최소화)
    const existing = [...container.children];
    near.forEach((c, i) => {
      _v.copy(c.mesh.position).project(this.camera);
      const sx = (_v.x + 1) / 2 * W;
      const sy = (-_v.y + 1) / 2 * H - 30;
      if (_v.z > 1) return; // 카메라 뒤

      let label = existing[i];
      if (!label) {
        label = document.createElement('div');
        label.className = 'creature-label';
        container.appendChild(label);
      }
      const dist = Math.round(c.mesh.position.distanceTo(playerPos));
      label.textContent = `${c.config.name || c.config.type} 💰${c.config.coins}`;
      label.style.transform = `translate(${sx}px, ${sy}px)`;
      label.style.opacity = Math.max(0.4, 1 - dist / LABEL_RANGE);
    });

    // 남은 기존 레이블 숨기기
    for (let i = near.length; i < existing.length; i++) {
      existing[i].remove();
    }
  }

  // ── 타이머 긴박감 (10초 이하 화면 펄스) ──────────────────────
  _updateTimerUrgency(timeRemaining) {
    const timerEl = document.getElementById('hud-timer');
    const urgencyEl = document.getElementById('timer-urgency');
    if (!timerEl) return;
    const urgent = timeRemaining <= 10 && timeRemaining > 0;
    timerEl.classList.toggle('urgent', urgent);
    if (urgencyEl) urgencyEl.style.opacity = urgent ? (Math.sin(Date.now() * 0.01) * 0.15 + 0.15).toString() : '0';
  }

  _cleanup() {
    // 파티클 풀 즉시 회수 — 씬 파괴 전에 orphan 파티클 제거
    // 생물 레이블 정리
    const labels = document.getElementById('creature-labels');
    if (labels) labels.innerHTML = '';
    particlePool.reset();

    this.camCtrl?.dispose();
    this.waves?.dispose();
    this.world?.dispose();
    this.player?.dispose();
    this.camCtrl = null;
    this.waves   = null;
    this.world   = null;
    this.player  = null;

    if (this.scene) {
      // 씬 내 모든 Mesh 의 geometry / material 해제
      // - _cachedGeos / _cachedMats 에 속한 것은 세션 간 재사용 → 스킵
      this.scene.traverse(obj => {
        if (!obj.isMesh) return;

        if (obj.geometry && !_cachedGeos.has(obj.geometry)) {
          obj.geometry.dispose();
        }

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m && !_cachedMats.has(m)) {
            m.map?.dispose();          // CanvasTexture 등
            m.alphaMap?.dispose();
            m.dispose();
          }
        }
      });

      // 씬에서 자식 제거
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }
    }
    this.scene = null;
  }

  // ── 포획 ──────────────────────────────────────────────────────
  _tryCapture() {
    if (!this.player || !this.waves || !this.camCtrl) return;
    this.player.swing();
    const result = this.waves.tryCapture(
      this.player.position,
      this.player.getForward(this.camCtrl),
      this.player.captureRange
    );
    if (result) {
      this.sessionScore += result.score;
      this.sessionCoins += result.coins;
      this.totalCoins = addCoins(result.coins);
      this.hud.showCaptureEffect(result.coins);
      this._triggerCaptureFlash();
      this.camCtrl?.shake(0.13);
      audioManager.sfxCaptureSuccess();
      // 업적 체크
      if (this.waves) {
        const total = this.waves.capturedCount;
        if (total === 1)  this._checkAchievement('first_catch', '🎯', '첫 포획!');
        if (total === 10) this._checkAchievement('10_catch',    '🏆', '10마리 포획!');
        if (total === 50) this._checkAchievement('50_catch',    '🌟', '포획 마스터!');
        if (this.waves.combo === 5)  this._checkAchievement('combo5',  '🔥', '5연속 콤보!');
        if (this.waves.combo === 10) this._checkAchievement('combo10', '💥', '10연속 콤보!');
      }
    } else {
      audioManager.sfxCaptureFail();
    }
  }

  _triggerCaptureFlash() {
    const el = document.getElementById('capture-flash');
    if (!el) return;
    el.style.opacity = '1';
    if (this._captureFlashTimeout) clearTimeout(this._captureFlashTimeout);
    this._captureFlashTimeout = setTimeout(() => { el.style.opacity = '0'; }, 140);
  }

  // ── 튜토리얼 오버레이 ─────────────────────────────────────────
  _showTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    const btn = document.getElementById('btn-tutorial-ok');
    if (btn) {
      btn.onclick = () => {
        overlay.classList.add('hidden');
        localStorage.setItem('gy_tutorial_seen', '1');
        this._showLockHint(true);
        this.camCtrl?.requestLock();
      };
    }
  }

  // ── 포인터락 힌트 표시/숨김 ───────────────────────────────────
  _showLockHint(show) {
    const el = document.getElementById('pointer-lock-hint');
    if (!el) return;
    el.classList.toggle('hidden', !show);
  }

  // ── 포인터락 상태 감시 (게임 루프와 별도) ────────────────────
  _watchLockState() {
    const check = () => {
      if (this.currentScreen !== 'game') return;
      const locked = document.pointerLockElement === this.renderer.domElement;
      this._showLockHint(!locked);
    };
    document.addEventListener('pointerlockchange', check);
    // dispose 시 제거를 위해 저장
    this._lockWatcher = check;
  }

  // 스킬로 생물 포획 시 코인/점수 처리
  _applySkillCapture(creature) {
    const diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
    const weatherMult = this.settings.weather === 'rain' ? 1.2
                      : this.settings.weather === 'fog'  ? 1.5 : 1;
    const timeMult = this.settings.timeOfDay === 'night' ? 1.4
                   : this.settings.timeOfDay === 'dusk'  ? 1.1 : 1;
    const comboMult = this.waves ? (
      this.waves.combo >= 10 ? 2.0 :
      this.waves.combo >= 5  ? 1.5 :
      this.waves.combo >= 3  ? 1.2 : 1.0
    ) : 1.0;
    const coins = Math.floor(creature.config.coins * diff.coinMult * weatherMult * timeMult);
    const score = Math.floor(creature.config.score * diff.scoreMult * comboMult);
    this.sessionScore += score;
    this.sessionCoins += coins;
    this.totalCoins = addCoins(coins);
    this.hud.showCaptureEffect(coins);
    if (this.waves && this.waves.combo > this.waves.maxCombo) {
      this.waves.maxCombo = this.waves.combo;
    }
  }

  // ── 스킬 슬롯 실행 (Q / E / R 각자 독립 쿨다운) ──────────────
  _useSkillSlot(key) {
    if (this._slotCDs[key] > 0) return; // 쿨다운 중
    const save = loadSave();
    const skillId = save.skillSlots?.[key];
    if (!skillId) return; // 빈 슬롯

    const skillItem = SHOP_ITEMS.skills.find(s => s.id === skillId);
    if (!skillItem) return;
    if (!save.ownedItems.includes(skillId)) return; // 미구매

    const cd = skillItem.cooldown ?? SKILL_CD[skillId] ?? 30;
    this._slotCDs[key] = cd;
    this.hud.startSkillCD(key, cd);

    // 스킬별 효과 실행
    switch (skillId) {
      case 'skill_vortex': {
        if (!this.waves || !this.player || !this.camCtrl) break;
        const pos = this.player.position;
        const fwd = this.player.getForward(this.camCtrl);
        let caught = 0;
        this.waves.creatures.forEach(c => {
          if (!c.alive || c.captured) return;
          if (c.mesh.position.distanceTo(pos) > 15) return;
          const toC = c.mesh.position.clone().sub(pos).normalize();
          if (toC.dot(fwd) < 0.2) return;
          c.capture();
          this.waves.capturedCount++;
          this.waves.combo++;
          this._applySkillCapture(c);
          caught++;
        });
        if (caught > 0) this.hud.showWaveMessage(`🌀 회오리! ${caught}마리 포획!`);
        break;
      }
      case 'skill_magnet': {
        if (!this.waves || !this.player) break;
        const pos = this.player.position;
        let caught = 0;
        this.waves.creatures.forEach(c => {
          if (!c.alive || c.captured) return;
          if (c.mesh.position.distanceTo(pos) <= 10) {
            c.capture();
            this.waves.capturedCount++;
            this.waves.combo++;
            this._applySkillCapture(c);
            caught++;
          }
        });
        if (caught > 0) this.hud.showWaveMessage(`🧲 자석! ${caught}마리 포획!`);
        break;
      }
      case 'skill_slow': {
        if (!this.waves) break;
        this.waves.creatures.forEach(c => { if (c.alive) c.config.speed *= 0.5; });
        setTimeout(() => {
          if (this.waves) this.waves.creatures.forEach(c => { if (c.alive) c.config.speed *= 2; });
        }, 5000);
        this.hud.showWaveMessage('⏱️ 슬로우 타임!');
        break;
      }
      case 'skill_multi': {
        // 분신 채망 — 3초간 포획 범위 3배
        if (!this.player) break;
        this.player.captureRange *= 3;
        setTimeout(() => { if (this.player) this.player.captureRange /= 3; }, 5000);
        this.hud.showWaveMessage('👐 분신 채망!');
        break;
      }
    }
  }

  // ── 핫바 슬롯 사용 (1~9 키) ───────────────────────────────────
  _useHotbarSlot(index) {
    const save = loadSave();
    const entry = save.hotbar?.[index];
    if (!entry || entry.count <= 0) return;

    switch (entry.id) {
      case 'time_extend':
        // 웨이브 타이머 +30초
        if (this.waves) this.waves.addTime?.(30);
        this.hud.showWaveMessage('⏰ +30초 연장!');
        break;
      case 'bait':
        // 생물을 플레이어 쪽으로 5초간 유인
        if (this.waves && this.player) {
          const pos = this.player.position;
          this.waves.creatures.forEach(c => {
            if (!c.alive || c.captured) return;
            c._baitTarget = pos.clone();
            c._baitTimer  = 5;
          });
        }
        this.hud.showWaveMessage('🍖 미끼 사용!');
        break;
      case 'radar_use':
        // 레이더 15초 → 미니맵에 모든 생물 강조
        if (this.minimap) this.minimap.showRadar(15);
        this.hud.showWaveMessage('📡 레이더 온!');
        break;
      case 'super_bait':
        // 희귀 생물 스폰 — WaveSystem에 플래그
        if (this.waves) this.waves._rareBuff = 10; // 다음 10초간 희귀율 2배
        this.hud.showWaveMessage('💫 슈퍼 미끼!');
        break;
    }

    // 수량 감소 후 저장
    entry.count -= 1;
    const newHotbar = [...save.hotbar];
    newHotbar[index] = entry.count > 0 ? entry : null;
    updateSave({ hotbar: newHotbar });
    this.hud._buildHotbar(); // 핫바 UI 즉시 갱신
    this.hud.activateHotbarSlot(index);
  }

  // ── 인벤토리 닫기 콜백 ────────────────────────────────────────
  _onInventoryClose() {
    // 인벤토리에서 스킬/핫바가 변경됐을 수 있으므로 HUD 갱신
    this.hud._refreshSkillIcons();
    this.hud._buildHotbar();
    // 게임이 진행 중이었으면 HUD 복원 후 재개
    if (this.scene && this.player) {
      const stage = STAGES.find(s => s.id === this.selectedStage);
      this.hud.show(stage ? `스테이지 ${stage.id} - ${stage.name}` : '');
      this._showScreen('game');
      this._startLoop();
    } else {
      this._showScreen('stage-select');
      this._renderStageGrid();
    }
  }

  // ── 일시정지 / 재개 ───────────────────────────────────────────
  _pauseGame() {
    this._stopLoop();
    this.camCtrl?.exitLock();
    this._showLockHint(false);
    audioManager.setState('pause');
    this._showScreen('pause');
  }

  _resumeGame() {
    this._showScreen('game');
    this._startLoop();
    audioManager.setState('exploration');
    this._showLockHint(!this.camCtrl?.isLocked);
  }

  _onShopClose() {
    // 상점에서 닫기 시 HUD 복원 후 게임 재개
    if (this.scene && this.player) {
      const stage = STAGES.find(s => s.id === this.selectedStage);
      this.hud.show(stage ? `스테이지 ${stage.id} - ${stage.name}` : '');
      this._resumeGame();
    } else {
      this._showScreen('stage-select');
      this._renderStageGrid();
    }
  }

  // ── 이벤트 핸들러 ─────────────────────────────────────────────
  _onCapture() {}

  // 공격형 동물에게 피격
  _onDamage(damage) {
    if (this._invincibleTimer > 0) return; // 무적 중
    this.playerHP = Math.max(0, this.playerHP - damage);
    this._invincibleTimer = 1.5; // 1.5초 무적
    this.hud.updateHP(this.playerHP, this.playerMaxHP);
    this.hud.flashDamage();
    this.hud.showDamagePopup(damage);
    audioManager.sfxDamage();

    if (this.playerHP <= 0) {
      // HP 0 → 스테이지 실패
      this._stopLoop();
      this.hud.hide();
      document.getElementById('result-emoji').textContent = '💀';
      document.getElementById('result-title').textContent = '전투 불능!';
      document.getElementById('btn-next-stage').style.display = 'none';
      document.getElementById('nickname-row').classList.add('hidden');
      const starElHP = document.getElementById('res-stars');
      if (starElHP) starElHP.textContent = '☆☆☆';
      this._showScreen('result');
      this._animateResultNumbers(this.waves?.capturedCount || 0, 0, this.waves?.maxCombo || 0);
    }
  }

  _onStageComplete(result) {
    this._stopLoop();
    this.hud.hide();

    markStageCleared(this.selectedStage, this.sessionScore);
    audioManager.sfxStageComplete();
    this._launchConfetti();
    this._checkAchievement('first_clear', '🎉', '첫 스테이지 클리어!');

    const stageData = STAGES.find(s => s.id === this.selectedStage);
    const timeRatio = result.timeLeft / (stageData?.timeLimit || 60);
    const stars = timeRatio >= 0.4 ? 3 : timeRatio >= 0.15 ? 2 : 1;
    if (stars === 3) this._checkAchievement('perfect_clear', '⭐', '완벽 클리어!');

    document.getElementById('result-emoji').textContent = '🎉';
    document.getElementById('result-title').textContent = `스테이지 ${this.selectedStage} 클리어!`;
    document.getElementById('btn-next-stage').style.display = this.selectedStage < STAGES.length ? '' : 'none';
    document.getElementById('nickname-row').classList.remove('hidden');

    const starEl = document.getElementById('res-stars');
    if (starEl) starEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

    this._showScreen('result');
    this._animateResultNumbers(result.captured, result.timeLeft, result.maxCombo);
  }

  _onStageFail() {
    this._stopLoop();
    this.hud.hide();
    audioManager.sfxStageFail();

    document.getElementById('result-emoji').textContent = '😢';
    document.getElementById('result-title').textContent = '시간 초과!';
    document.getElementById('btn-next-stage').style.display = 'none';
    document.getElementById('nickname-row').classList.add('hidden');
    const starEl = document.getElementById('res-stars');
    if (starEl) starEl.textContent = '☆☆☆';

    this._showScreen('result');
    this._animateResultNumbers(this.waves?.capturedCount || 0, 0, this.waves?.maxCombo || 0);
  }

  _animateResultNumbers(captured, timeLeft, maxCombo) {
    const coins  = this.sessionCoins;
    const score  = this.sessionScore;
    const dur    = 1200;
    const start  = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const t = Math.min(1, easeOut((now - start) / dur));
      document.getElementById('res-captured').textContent = Math.round(t * captured);
      document.getElementById('res-time').textContent     = `${Math.ceil(t * timeLeft)}초`;
      document.getElementById('res-combo').textContent    = Math.round(t * maxCombo);
      document.getElementById('res-coins').textContent    = `+${Math.round(t * coins).toLocaleString()}`;
      document.getElementById('res-score').textContent    = Math.round(t * score).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── 상점 업그레이드 효과 적용 ─────────────────────────────────
  /**
   * 저장된 구매 목록을 읽어 Player 스탯에 반영.
   * _startGame() 에서 Player 생성 직후 호출.
   *
   * 적용 우선순위:
   *  abilities → move_speed, noise_reduce 등 반복 레벨업 가능 항목
   *  tools     → net_plus, swing_speed
   */
  _applyShopEffects() {
    if (!this.player) return;
    const save = loadSave();
    const allItems = [
      ...SHOP_ITEMS.tools,
      ...SHOP_ITEMS.abilities,
    ];

    for (const item of allItems) {
      if (!item.effect) continue;
      const level = save.itemLevels[item.id] || 0;
      if (level === 0 && !save.ownedItems.includes(item.id)) continue;

      const effectiveLevel = Math.max(level, save.ownedItems.includes(item.id) ? 1 : 0);
      const { effect } = item;

      // 이동 속도 — 레벨당 +10% 누적
      if (effect.moveSpeed)    this.player.speed        *= Math.pow(effect.moveSpeed,    effectiveLevel);
      // 포획 범위 — 레벨당 +20% 누적
      if (effect.captureRange) this.player.captureRange *= Math.pow(effect.captureRange, effectiveLevel);
      // 스윙 속도 — 레벨당 +15% 누적
      if (effect.swingSpeed)   this.player.swingSpeed   *= Math.pow(effect.swingSpeed,   effectiveLevel);
    }

    // noise_reduce: 생물 fleeRadius 축소 비율을 WaveSystem에 전달
    const noiseItem = SHOP_ITEMS.abilities.find(i => i.id === 'noise_reduce');
    const noiseLevel = save.itemLevels['noise_reduce'] || 0;
    if (noiseLevel > 0 && this.waves) {
      const mult = Math.pow(noiseItem.effect.noiseReduce, noiseLevel);
      this.waves.creatures.forEach(c => {
        c.profile.fleeRadius *= mult;
      });
    }
  }

  // ── 리더보드 ──────────────────────────────────────────────────
  _renderLeaderboard(tab) {
    const container = document.getElementById('lb-content');
    container.innerHTML = '';

    if (tab === 'personal') {
      const save = loadSave();
      const records = Object.entries(save.highScores).sort((a, b) => b[1] - a[1]).slice(0, 20);
      if (records.length === 0) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.4)">아직 기록이 없습니다. 게임을 플레이해보세요!</div>';
        return;
      }
      records.forEach(([stageId, score], i) => {
        const stage = STAGES.find(s => s.id === parseInt(stageId));
        const row = document.createElement('div');
        row.className = 'lb-row';
        row.innerHTML = `
          <div class="lb-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</div>
          <div class="lb-name">${stage?.icon || '?'} ${stage?.name || `스테이지 ${stageId}`}</div>
          <div class="lb-score">${score.toLocaleString()}점</div>
        `;
        container.appendChild(row);
      });
    } else {
      this._loadGlobalLeaderboard(container);
    }
  }

  async _loadGlobalLeaderboard(container) {
    container.innerHTML = `
      <div style="padding:60px 20px;text-align:center;color:rgba(255,255,255,0.45)">
        <div style="font-size:32px;margin-bottom:12px">⏳</div>
        <div style="font-size:14px">불러오는 중...</div>
      </div>
    `;

    const records = await fetchGlobalLeaderboard(50);

    if (records.length === 0) {
      container.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:rgba(255,255,255,0.45)">
          <div style="font-size:48px;margin-bottom:16px">🌍</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">아직 등록된 기록이 없습니다</div>
          <div style="font-size:14px">게임을 클리어하고 닉네임으로 등록해보세요!</div>
        </div>
      `;
      return;
    }

    records.forEach((rec, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row';
      row.innerHTML = `
        <div class="lb-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</div>
        <div class="lb-name">${rec.nickname}</div>
        <div class="lb-stage" style="font-size:12px;color:rgba(255,255,255,0.5);margin:0 8px">${rec.stage_name || `스테이지 ${rec.stage_id}`}</div>
        <div class="lb-score">${rec.score.toLocaleString()}점</div>
      `;
      container.appendChild(row);
    });
  }

  // ── 타이틀 3D 배경 씬 ────────────────────────────────────────
  _startTitleScene() {
    if (this._titleRafId) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06090f);
    scene.fog = new THREE.FogExp2(0x06090f, 0.045);

    const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
    cam.position.set(0, 6, 22);
    cam.lookAt(0, 2, 0);

    // 바닥
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x050c08 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // 떠다니는 발광 구체 (생물 분위기)
    const colors = [0x4ecdc4, 0xff6b6b, 0xffd700, 0x88ff88, 0xff88ff, 0x88aaff, 0xff9944];
    const orbs = [];
    for (let i = 0; i < 45; i++) {
      const r = 0.10 + Math.random() * 0.28;
      const geo = new THREE.SphereGeometry(r, 7, 7);
      const col = colors[i % colors.length];
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.55 + Math.random() * 0.40,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 44,
        0.6 + Math.random() * 13,
        (Math.random() - 0.5) * 22 - 4
      );
      mesh._px   = mesh.position.x;
      mesh._py   = mesh.position.y;
      mesh._phase = Math.random() * Math.PI * 2;
      mesh._spd   = 0.25 + Math.random() * 0.55;
      mesh._amp   = 0.7 + Math.random() * 1.8;
      scene.add(mesh);
      orbs.push(mesh);
    }

    // 큰 발광 구체 3개 (배경 포인트)
    [[0xff6b35, -12, 4, -14], [0x4ecdc4, 12, 7, -18], [0xffd700, 0, 11, -22]].forEach(([c, x, y, z]) => {
      const g = new THREE.SphereGeometry(1.8, 10, 10);
      const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      scene.add(mesh);
    });

    this._titleScene  = scene;
    this._titleCamera = cam;

    let t = 0;
    const loop = (ts) => {
      if (this.currentScreen !== 'title') { this._titleRafId = null; return; }
      this._titleRafId = requestAnimationFrame(loop);
      t += 0.013;

      orbs.forEach(o => {
        o.position.x = o._px + Math.cos(t * o._spd + o._phase) * o._amp;
        o.position.y = o._py + Math.sin(t * o._spd * 0.65 + o._phase) * o._amp * 0.5;
      });

      cam.position.x = Math.sin(t * 0.08) * 2.5;
      cam.position.y = 6 + Math.sin(t * 0.05) * 0.8;
      cam.lookAt(0, 2, 0);

      this.renderer.render(scene, cam);
    };
    this._titleRafId = requestAnimationFrame(loop);
  }

  _stopTitleScene() {
    if (this._titleRafId) { cancelAnimationFrame(this._titleRafId); this._titleRafId = null; }
    if (this._titleScene) {
      this._titleScene.traverse(obj => {
        if (!obj.isMesh) return;
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => m?.dispose());
      });
      this._titleScene  = null;
      this._titleCamera = null;
    }
  }

  // ── 스테이지 클리어 컨페티 ─────────────────────────────────────
  _launchConfetti() {
    const palette = ['#4ecdc4','#ff6b6b','#ffd700','#88ff88','#ff88ff','#88aaff','#ffffff','#ff9944'];
    for (let i = 0; i < 90; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const size = 5 + Math.random() * 9;
      el.style.cssText = `
        left: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        background: ${palette[Math.floor(Math.random() * palette.length)]};
        border-radius: ${Math.random() > 0.45 ? '50%' : '2px'};
        animation-duration: ${1.6 + Math.random() * 2.2}s;
        animation-delay: ${Math.random() * 0.6}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4500);
    }
  }

  async _registerScore() {
    const nickname = document.getElementById('nickname-input').value.trim();
    if (!nickname) return;
    document.getElementById('nickname-row').classList.add('hidden');

    const stage = STAGES.find(s => s.id === this.selectedStage);
    const ok = await submitScore(nickname, this.sessionScore, this.selectedStage, stage?.name ?? '');

    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4ecdc4;color:#fff;padding:10px 24px;border-radius:20px;font-weight:700;z-index:200;';
    toast.textContent = ok ? `✅ ${nickname} 랭킹 등록!` : '❌ 등록 실패, 다시 시도해주세요';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}
