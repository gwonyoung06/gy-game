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
import { loadSave, addCoins, markStageCleared, updateSave, recordCapturedType } from './utils/storage.js';
import { SHOP_ITEMS, CONSUMABLES } from './data/shop.js';
import { particlePool, _cachedMats, _cachedGeos } from './entities/Creature.js';
import { audioManager } from './systems/AudioManager.js';
import { submitScore, fetchGlobalLeaderboard } from './utils/supabase.js';
import { DebugOverlay } from './utils/DebugOverlay.js';

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
    this.debug     = null; // 디버그 오버레이 (게임 시작 후 초기화)
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
    document.getElementById('btn-dex').addEventListener('click', () => {
      this._showScreen('dex');
      this._renderDex();
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
    document.getElementById('btn-to-dex').addEventListener('click', () => {
      this._showScreen('dex');
      this._renderDex();
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

    // 도감
    document.getElementById('btn-back-from-dex').addEventListener('click', () => this._showScreen('title'));

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
      const defaults = { sens: 100, master: 100, music: 70, amb: 43, sfx: 100 };
      const s = Object.assign({}, defaults, JSON.parse(localStorage.getItem('gy_settings') || '{}'));
      document.getElementById('setting-sens').value   = s.sens;
      document.getElementById('setting-master').value = s.master;
      document.getElementById('setting-music').value  = s.music;
      document.getElementById('setting-amb').value    = s.amb;
      document.getElementById('setting-sfx').value    = s.sfx;
      document.getElementById('sens-val').textContent   = s.sens;
      document.getElementById('master-val').textContent = s.master;
      document.getElementById('music-val').textContent  = s.music;
      document.getElementById('amb-val').textContent    = s.amb;
      document.getElementById('sfx-val').textContent    = s.sfx;
      if (this.camCtrl) this.camCtrl.sensitivity = 0.0028 * (s.sens / 100);
      audioManager.setMasterVolume?.(s.master / 100);
      audioManager.setMusicVolume?.(s.music / 100);
      audioManager.setAmbientVolume?.(s.amb / 100);
      audioManager.setSfxVolume?.(s.sfx / 100);
    };

    const saveSettings = () => {
      const sens   = parseInt(document.getElementById('setting-sens').value);
      const master = parseInt(document.getElementById('setting-master').value);
      const music  = parseInt(document.getElementById('setting-music').value);
      const amb    = parseInt(document.getElementById('setting-amb').value);
      const sfx    = parseInt(document.getElementById('setting-sfx').value);
      localStorage.setItem('gy_settings', JSON.stringify({ sens, master, music, amb, sfx }));
      document.getElementById('sens-val').textContent   = sens;
      document.getElementById('master-val').textContent = master;
      document.getElementById('music-val').textContent  = music;
      document.getElementById('amb-val').textContent    = amb;
      document.getElementById('sfx-val').textContent    = sfx;
      if (this.camCtrl) this.camCtrl.sensitivity = 0.0028 * (sens / 100);
      audioManager.setMasterVolume?.(master / 100);
      audioManager.setMusicVolume?.(music / 100);
      audioManager.setAmbientVolume?.(amb / 100);
      audioManager.setSfxVolume?.(sfx / 100);
    };

    ['setting-sens', 'setting-master', 'setting-music', 'setting-amb', 'setting-sfx'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', saveSettings);
    });
    loadSettings();

    // 키보드
    document.addEventListener('keydown', e => {
      if (this.currentScreen === 'game') {
        // 이동키 입력 시 포인터락 미획득 상태면 자동 획득
        const _moveCodes = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
        if (!this.camCtrl?.isLocked && _moveCodes.includes(e.code)) {
          this.camCtrl?.requestLock();
        }

        // 스킬 슬롯 Q / E / R
        if (e.code === 'KeyQ') this._useSkillSlot('Q');
        if (e.code === 'KeyE') this._useSkillSlot('E');
        if (e.code === 'KeyR') this._useSkillSlot('R');

        // 핫바 1~9
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) this._useHotbarSlot(num - 1);

        // I: 인벤토리 (포인터락 해제 후 전환)
        if (e.code === 'KeyI') {
          if (this.player) this.player.keys = {};
          this.camCtrl?.exitLock();
          if (this.camCtrl) this.camCtrl._shakeIntensity = 0;
          document.body.style.cursor = '';
          this._stopLoop();
          this.hud.hide();
          this._showScreen('inventory');
          this.inventory.open(this.player?.mesh ?? null);
        }

        // P: 상점
        if (e.code === 'KeyP') {
          if (this.player) this.player.keys = {};
          this.camCtrl?.exitLock();
          if (this.camCtrl) this.camCtrl._shakeIntensity = 0;
          document.body.style.cursor = '';
          this._stopLoop();
          this.hud.hide();
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

    const MAX_R   = 50;  // 조이스틱 최대 반경 px (업그레이드)
    const DEAD    = 0.18; // 데드존 (0~1)
    let jTouchId  = null, lookTouchId = null;
    let lookPrevX = 0, lookPrevY = 0;
    let jx = 0, jy = 0;     // 정규화 (-1~1)
    let jOriginX = 0, jOriginY = 0; // 플로팅 베이스 원점

    const showPanel = (show) => {
      panel.classList.toggle('hidden', !show);
    };

    // 게임 화면 전환 시 터치 패널 표시/숨김
    const origShow = this._showScreen.bind(this);
    this._showScreen = (name) => {
      origShow(name);
      showPanel(name === 'game');
    };

    // 플로팅 베이스 위치 업데이트
    const moveJBase = (cx, cy) => {
      jOriginX = cx; jOriginY = cy;
      const zRect = jZone.getBoundingClientRect();
      jBase.style.left = `${cx - zRect.left - 55}px`;
      jBase.style.top  = `${cy - zRect.top  - 55}px`;
      jBase.style.opacity = '1';
    };

    // 조이스틱 터치 (플로팅)
    jZone.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (jTouchId === null) {
          jTouchId = t.identifier;
          jx = 0; jy = 0;
          moveJBase(t.clientX, t.clientY);
          jBase.style.transform = 'scale(1.08)';
        }
      }
    }, { passive: false });

    jZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== jTouchId) continue;
        const dx    = t.clientX - jOriginX;
        const dy    = t.clientY - jOriginY;
        const dist  = Math.hypot(dx, dy);
        const clamp = Math.min(dist, MAX_R);
        const angle = Math.atan2(dy, dx);
        const ratio = clamp / MAX_R;
        // 데드존 적용
        jx = ratio > DEAD ? Math.cos(angle) * ratio : 0;
        jy = ratio > DEAD ? Math.sin(angle) * ratio : 0;
        jKnob.style.transform = `translate(${Math.cos(angle)*clamp}px, ${Math.sin(angle)*clamp}px)`;
      }
    }, { passive: false });

    const jEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === jTouchId) {
          jTouchId = null; jx = 0; jy = 0;
          jKnob.style.transform = 'translate(0,0)';
          jBase.style.opacity   = '0.45';
          jBase.style.transform = 'scale(1)';
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

    // 게임 루프에서 조이스틱 입력 → Player.keys + 아날로그 속도 스케일
    this._touchJoystick = () => {
      if (!this.player) return;
      // 키보드 on/off 매핑 (기존 이동 시스템과 호환)
      this.player.keys['KeyW'] = jy < -DEAD;
      this.player.keys['KeyS'] = jy >  DEAD;
      this.player.keys['KeyA'] = jx < -DEAD;
      this.player.keys['KeyD'] = jx >  DEAD;
      // 아날로그 속도 스케일 (1.0 = 최대 속도, 작은 값 = 느린 속도)
      this.player._touchSpeedScale = Math.max(Math.abs(jx), Math.abs(jy));
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

    // 스테이지 진행 바 갱신
    const clearedCount = save.clearedStages.length;
    const totalStages  = STAGES.length;
    const progFill = document.getElementById('stage-prog-fill');
    const progText = document.getElementById('stage-prog-text');
    if (progFill) progFill.style.width = `${Math.round((clearedCount / totalStages) * 100)}%`;
    if (progText) progText.textContent = `${clearedCount} / ${totalStages}`;

    const grid = document.getElementById('stage-grid');
    grid.innerHTML = '';

    let idx = 0;
    STAGES.forEach(stage => {
      const unlocked = stage.id === 1 || save.clearedStages.includes(stage.id - 1);
      const cleared  = save.clearedStages.includes(stage.id);
      const best     = save.highScores[stage.id] || 0;
      const stars    = (save.stageStars || {})[stage.id] || 0;
      const starStr  = cleared ? ('⭐'.repeat(stars) + '☆'.repeat(3 - stars)) : '';
      // 잠금 해제됐지만 한 번도 클리어 못한 스테이지 (1 제외) = "NEW!"
      const isNew    = unlocked && !cleared && stage.id > 1;

      const card = document.createElement('div');
      card.className = `stage-card${unlocked ? '' : ' locked'}${cleared ? ' cleared' : ''}`;
      // 순차 슬라이드-인 애니메이션
      card.style.cssText = `opacity:0;animation:slideUp 0.35s ease ${idx * 38}ms both`;
      card.innerHTML = `
        <div class="stage-num">${stage.id}</div>
        <div class="stage-theme-icon">${stage.icon}</div>
        <div class="stage-name">${stage.name}</div>
        ${cleared  ? `<div class="stage-star-row">${starStr}</div><div class="stage-cleared">${best.toLocaleString()}점</div>` : ''}
        ${!unlocked ? '<div class="stage-cleared">🔒 잠김</div>' : ''}
        ${isNew ? '<div class="stage-new-badge">NEW!</div>' : ''}
      `;
      if (unlocked) {
        card.addEventListener('click', () => {
          this.selectedStage = stage.id;
          document.getElementById('pregame-title').textContent = `${stage.id}스테이지 - ${stage.name}`;
          this._renderPregameCreatures(stage);
          this._showScreen('pregame');
        });
        // 3D 틸트 호버 효과
        card.addEventListener('mousemove', e => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
          const y = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
          card.style.transform = `perspective(700px) rotateY(${x * 11}deg) rotateX(${-y * 9}deg) scale(1.04) translateZ(8px)`;
          card.style.boxShadow = `0 20px 40px rgba(0,0,0,0.45), 0 0 22px rgba(${x > 0 ? '255,140,50' : '80,200,255'},0.20)`;
          card.style.transition = 'box-shadow 0.1s ease';
        });
        card.addEventListener('mouseleave', () => {
          card.style.transform  = '';
          card.style.boxShadow  = '';
          card.style.transition = 'transform 0.35s ease, box-shadow 0.35s ease';
        });
      }
      grid.appendChild(card);
      idx++;
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
      const bColor = unlocked ? `border-color:#ffd700;` : '';
      card.style.cssText = `${bColor}opacity:0;animation:slideUp 0.35s ease ${idx * 38}ms both`;
      card.innerHTML = `
        <div class="stage-num" style="color:#ffd700">★</div>
        <div class="stage-theme-icon">${bs.icon}</div>
        <div class="stage-name">${bs.name}</div>
        ${!unlocked ? '<div class="stage-cleared">🔒 잠김</div>' : ''}
      `;
      grid.appendChild(card);
      idx++;
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
    this._slowMoTimer = 0;
    this.totalDamageTaken = 0;
    this._footstepTimer = 0;
    const save = loadSave();
    this.totalCoins = save.coins;
    this._stagePB   = save.highScores[this.selectedStage] || 0;
    this._newRecord = false;

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
        if (!isCountdown) {
          audioManager.sfxWaveComplete();
          if (wave > 3) this._bossFlash(); // 보스 웨이브 드라마틱 연출
        }
      },
      (result) => this._onStageComplete(result),
      ()       => this._onStageFail(),
      (dmg)    => this._onDamage(dmg),
      this.world
    );

    // 웨이브 클리어 시 업그레이드 카드 훅
    this.waves.onWaveClear = (_nextWave, spawnFn) => {
      this._showUpgradeCards(spawnFn);
    };

    const minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
      this.minimap = new Minimap(minimapCanvas, stageData.id, this.world._zones, 130);
    }

    audioManager.init();
    audioManager.setBiome(stageData.id);
    audioManager.setState('exploration');

    // PB 디스플레이 초기화
    const pbEl    = document.getElementById('hud-pb');
    const pbValEl = document.getElementById('hud-pb-val');
    if (pbEl) {
      pbEl.classList.toggle('hidden', this._stagePB === 0);
      pbEl.classList.remove('pb-new-record');
    }
    if (pbValEl && this._stagePB > 0) pbValEl.textContent = this._stagePB.toLocaleString();

    // ── 디버그 오버레이 초기화 (이전 것 정리 후 새로 생성) ──────
    this.debug?.dispose();
    this.debug = new DebugOverlay(this.renderer, this.scene, this.camera);
    // 디버그 추가 기능 연결
    this.debug.onScreenshot   = () => this._debugScreenshot();
    this.debug.onSpeedChange  = (mult) => { this._debugSpeedMult = mult; };
    this.debug.onGodMode      = (on)   => { this._debugGodMode   = on; };
    this.debug.onFreeCamera   = (on)   => { this._debugFreeCamera = on; if (!on && this.camCtrl) { this.camCtrl._freeCam = false; } };
    this._debugSpeedMult  = 1.0;
    this._debugGodMode    = false;
    this._debugFreeCamera = false;

    this.hud.show(`스테이지 ${stageData.id} - ${stageData.name}`);
    this._showScreen('game');
    this._applyWeatherOverlay(this.settings.weather);
    this._startLoop();
    this._showCountdown(); // 3-2-1-GO! 오버레이

    // 카운트다운 종료 후 자동 포인터락 획득 (3×820ms + 여유 200ms = 2660ms)
    setTimeout(() => {
      if (this.currentScreen === 'game' && this.camCtrl) {
        this.camCtrl.requestLock();
      }
    }, 2660);

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
    // FPS 기반 LOD 자동조정 상태
    let _fpsSamples = [];         // 최근 60프레임 delta 샘플
    let _lodLevel   = 0;          // 0=High 1=Mid 2=Low
    let _lodCooldown = 0;         // 변경 후 쿨다운(초) — 진동 방지
    const isMobile  = window.matchMedia('(pointer: coarse)').matches;

    const applyLOD = (level) => {
      if (_lodLevel === level) return;
      _lodLevel = level;
      const pr = level === 0 ? Math.min(window.devicePixelRatio, 2)
               : level === 1 ? 1.0
               :               0.75;
      this.renderer.setPixelRatio(pr);
      // WaveSystem 크리처 AI 틱 간격 조정 (LOD 2에서 격프레임)
      if (this.waves) this.waves._lodSkip = level >= 2 ? 2 : 1;
    };

    const loop = (timestamp) => {
      this.rafId = requestAnimationFrame(loop);
      this.clock.update(timestamp);
      const rawDelta = Math.min(this.clock.getDelta(), 0.05);

      // ── FPS 자동 LOD (모바일 한정) ──────────────────────────
      if (isMobile) {
        _fpsSamples.push(rawDelta);
        if (_fpsSamples.length > 60) _fpsSamples.shift();
        if (_fpsSamples.length === 60) {
          const avgDelta = _fpsSamples.reduce((a, b) => a + b, 0) / 60;
          const avgFPS   = 1 / avgDelta;
          if (_lodCooldown > 0) {
            _lodCooldown -= rawDelta;
          } else if (avgFPS < 28 && _lodLevel < 2) {
            applyLOD(_lodLevel + 1); _lodCooldown = 3.0; // 3초 쿨다운
          } else if (avgFPS > 50 && _lodLevel > 0) {
            applyLOD(_lodLevel - 1); _lodCooldown = 5.0;
          }
        }
      }

      // 슬로우모션 (콤보 8+ 포획 시 0.3배속)
      if (this._slowMoTimer > 0) {
        this._slowMoTimer -= rawDelta;
      }
      // 디버그 속도 배율 (F6) 적용
      const delta = rawDelta * (this._slowMoTimer > 0 ? 0.3 : 1.0) * (this._debugSpeedMult ?? 1.0);

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
        this._updateCrosshair();
        this._updateDangerIndicators();

        // 발자국 먼지 파티클 (이동 중 0.14s 마다)
        this._footstepTimer += delta;
        if (this.player._isMoving && this._footstepTimer > 0.14) {
          this._footstepTimer = 0;
          particlePool.emit(this.scene, new THREE.Vector3(
            this.player.position.x + (Math.random() - 0.5) * 0.4,
            0.18,
            this.player.position.z + (Math.random() - 0.5) * 0.4
          ), 0x9a8a72, 2);
        }
        // 보스 경고 업데이트
        this._updateBossWarning(state);
        // PB 경신 체크
        if (this._stagePB > 0 && this.sessionScore >= this._stagePB && !this._newRecord) {
          this._newRecord = true;
          this._showPBFlash();
        }
      }

      // 디버그 오버레이 업데이트 (HUD·AI라벨·무적 등)
      if (this.debug) {
        // 갓모드: 무적타이머 항상 유지
        if (this._debugGodMode) this._invincibleTimer = 99;
        this.debug.update(
          rawDelta,
          this.player?.position ?? null,
          this.waves  ?? null,
          this.world  ?? null,
          this.player ?? null,
        );
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
      const dist = c.mesh.position.distanceTo(playerPos);
      const inRange = dist <= this.player.captureRange;
      label.className = inRange ? 'creature-label creature-label--in-range' : 'creature-label';
      let gaugeHtml = '';
      if (inRange) {
        const fwd = this.player.getForward(this.camCtrl);
        const pct = Math.round(c.getCaptureChance(playerPos, fwd) * 100);
        const hue = pct < 40 ? 0 : pct < 70 ? 40 : 120;
        gaugeHtml = `<div class="label-chance-gauge"><div class="label-chance-fill" style="width:${pct}%;background:hsl(${hue},90%,52%)"></div></div>`
                  + `<div class="label-hint">포획확률 ${pct}%　클릭!</div>`;
      }
      label.innerHTML = inRange
        ? `<span>${c.config.name || c.config.type}</span> <span class="label-coins">💰${c.config.coins}</span>${gaugeHtml}`
        : `${c.config.name || c.config.type} 💰${c.config.coins}`;
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
    // 생물 레이블 / 위험 지시기 정리
    const labels = document.getElementById('creature-labels');
    if (labels) labels.innerHTML = '';
    const dangerEl = document.getElementById('danger-indicators');
    if (dangerEl) dangerEl.innerHTML = '';
    const crosshairEl = document.getElementById('crosshair');
    if (crosshairEl) { crosshairEl.textContent = '+'; crosshairEl.className = 'crosshair'; }
    // 날씨 오버레이 제거
    document.getElementById('weather-overlay')?.remove();
    // HP 위험 클래스 해제
    document.body.classList.remove('hp-danger');
    // 콤보 글로우 리셋 (body-level 요소 — hud.hide()로 안 숨겨짐)
    const glowEl = document.getElementById('combo-glow');
    if (glowEl) { glowEl.style.opacity = '0'; glowEl.className = ''; }
    // 포획 피드 초기화
    const feedEl = document.getElementById('capture-feed');
    if (feedEl) feedEl.innerHTML = '';
    // 업그레이드 카드 초기화
    const upgradeEl = document.getElementById('upgrade-card-overlay');
    if (upgradeEl) upgradeEl.classList.add('hidden');
    const cnpEl = document.getElementById('capture-name-popup');
    if (cnpEl) cnpEl.classList.add('hidden');
    this._coinMult = 1; this._scoreMult = 1;
    this._luckBonus = 0; this._bonusCapture = 0;
    // 스트릭 어나운서 초기화
    const streakEl = document.getElementById('streak-announcer');
    if (streakEl) { streakEl.classList.remove('streak-show'); streakEl.classList.add('hidden'); }
    clearTimeout(this._streakTimer);
    // 타이머 긴박감 오버레이 리셋
    const urgEl = document.getElementById('timer-urgency');
    if (urgEl) urgEl.style.opacity = '0';
    // 보스 경고 / PB 숨기기
    document.getElementById('boss-warning')?.classList.add('hidden');
    document.getElementById('hud-pb')?.classList.add('hidden');
    particlePool.reset();

    this.debug?.dispose();
    this.debug = null;
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

  // ── 타이틀 3D 씬 (배경 플로팅 오브 애니메이션) ───────────────────
  _startTitleScene() {
    if (this._titleRafId) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);
    scene.fog = new THREE.Fog(0x0a0f1e, 30, 80);
    this._titleScene = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 8, 30);
    camera.lookAt(0, 0, 0);
    this._titleCamera = camera;

    const colors = [0x4ecdc4, 0xffd700, 0xff6b35, 0x4488ff, 0xff88ff, 0xaaffaa];
    const orbs = [];
    for (let i = 0; i < 28; i++) {
      const geo = new THREE.SphereGeometry(0.25 + Math.random() * 0.55, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length], transparent: true, opacity: 0.55 + Math.random() * 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 56,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 36 - 8
      );
      mesh.userData.vx = (Math.random() - 0.5) * 0.018;
      mesh.userData.vy = (Math.random() - 0.5) * 0.012;
      mesh.userData.phase = Math.random() * Math.PI * 2;
      scene.add(mesh);
      orbs.push(mesh);
    }

    let t = 0;
    const loop = () => {
      this._titleRafId = requestAnimationFrame(loop);
      t += 0.016;
      orbs.forEach((o, i) => {
        o.position.x += o.userData.vx;
        o.position.y += o.userData.vy + Math.sin(t * 0.6 + o.userData.phase) * 0.003;
        if (o.position.x > 32)  o.position.x = -32;
        if (o.position.x < -32) o.position.x = 32;
        if (o.position.y > 18)  o.position.y = -18;
        if (o.position.y < -18) o.position.y = 18;
        o.rotation.y += 0.012;
      });
      camera.position.x = Math.sin(t * 0.04) * 4;
      camera.lookAt(0, 0, 0);
      this.renderer.render(scene, camera);
    };
    loop();
  }

  _stopTitleScene() {
    if (this._titleRafId) {
      cancelAnimationFrame(this._titleRafId);
      this._titleRafId = null;
    }
    if (this._titleScene) {
      this._titleScene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { obj.material.map?.dispose(); obj.material.dispose(); }
      });
      this._titleScene = null;
      this._titleCamera = null;
    }
  }

  // ── 3-2-1-GO! 카운트다운 오버레이 ─────────────────────────────
  _showCountdown() {
    // 스타일 1회 주입
    if (!document.getElementById('_countAnimStyle')) {
      const s = document.createElement('style');
      s.id = '_countAnimStyle';
      s.textContent = `@keyframes countPop {
        0%   { transform:scale(1.8);opacity:0; }
        18%  { transform:scale(1.0);opacity:1; }
        72%  { transform:scale(1.0);opacity:1; }
        100% { transform:scale(0.4);opacity:0; }
      }`;
      document.head.appendChild(s);
    }
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:500;';
    document.body.appendChild(wrap);

    const nums = ['3','2','1','GO!'];
    let i = 0;
    const next = () => {
      const span = document.createElement('span');
      const isGo = nums[i] === 'GO!';
      span.textContent = nums[i];
      span.style.cssText = `
        font-size:${isGo ? 88 : 120}px;font-weight:900;font-family:'Rajdhani',sans-serif;
        color:${isGo ? '#4ecdc4' : '#fff'};letter-spacing:${isGo ? '4px' : '0'};
        text-shadow:0 0 40px ${isGo ? 'rgba(78,205,196,0.9)' : 'rgba(255,255,255,0.8)'},0 4px 20px rgba(0,0,0,0.9);
        animation:countPop 0.82s ease-out forwards;position:absolute;
      `;
      wrap.innerHTML = '';
      wrap.appendChild(span);
      i++;
      if (i < nums.length) setTimeout(next, 820);
      else setTimeout(() => wrap.remove(), 820);
    };
    next();
  }

  // ── 날씨 오버레이 적용 ─────────────────────────────────────────
  _applyWeatherOverlay(weather) {
    document.getElementById('weather-overlay')?.remove();
    if (!weather || weather === 'sunny') return;
    const el = document.createElement('div');
    el.id = 'weather-overlay';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
    if (weather === 'rain') {
      el.style.background = `repeating-linear-gradient(-60deg,
        transparent,transparent 2px,rgba(174,214,241,0.12) 2px,rgba(174,214,241,0.12) 3px)`;
      el.style.backgroundSize = '6px 18px';
      el.style.animation = 'rainStreaks 0.18s linear infinite';
    } else if (weather === 'fog') {
      el.style.background = `
        radial-gradient(ellipse at 20% 50%, rgba(200,210,220,0.18) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 30%, rgba(180,200,215,0.14) 0%, transparent 55%)`;
      el.style.animation = 'fogDrift 8s ease-in-out infinite alternate';
    }
    document.body.appendChild(el);
  }

  // ── 컨페티 (스테이지 클리어 이펙트) ──────────────────────────
  _launchConfetti() {
    const MAX = 60;
    if (document.querySelectorAll('.confetti-p').length >= MAX) return;
    if (!document.getElementById('_confettiStyle')) {
      const s = document.createElement('style');
      s.id = '_confettiStyle';
      s.textContent = `@keyframes confettiFall {
        0%   { transform:translateY(0) rotate(0deg);   opacity:1; }
        100% { transform:translateY(110vh) rotate(720deg); opacity:0; }
      }`;
      document.head.appendChild(s);
    }
    const colors = ['#ffd700','#ff6b35','#4ecdc4','#ff88ff','#4488ff','#fff','#aaff88'];
    const count  = Math.min(22, MAX - document.querySelectorAll('.confetti-p').length);
    for (let i = 0; i < count; i++) {
      const el  = document.createElement('div');
      el.className = 'confetti-p';
      const sz  = 6 + Math.random() * 9;
      const dur = 1300 + Math.random() * 900;
      const del = Math.random() * 350;
      el.style.cssText = `
        position:fixed;left:${15 + Math.random() * 70}%;top:-12px;
        width:${sz}px;height:${sz}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        pointer-events:none;z-index:600;
        animation:confettiFall ${dur}ms ${del}ms ease-in forwards;
      `;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
      setTimeout(() => el.remove(), dur + del + 200);
    }
  }

  // ── 점수 리더보드 등록 ────────────────────────────────────────
  async _registerScore() {
    const nickInput = document.getElementById('nickname-input');
    const btn       = document.getElementById('btn-register');
    if (!nickInput || !btn) return;
    const nick = nickInput.value.trim();
    if (!nick) { nickInput.placeholder = '닉네임을 입력해주세요'; nickInput.focus(); return; }

    btn.disabled = true;
    btn.textContent = '등록 중...';
    const stage = STAGES.find(s => s.id === this.selectedStage);
    const ok = await submitScore(nick, this.sessionScore, this.selectedStage, stage?.name || `스테이지 ${this.selectedStage}`);
    if (ok) {
      localStorage.setItem('gy_last_nickname', nick);
      btn.textContent = '✓ 등록 완료!';
      btn.style.background = 'rgba(78,205,196,0.25)';
      document.getElementById('nickname-row')?.classList.add('hidden');
    } else {
      btn.disabled = false;
      btn.textContent = '재시도';
      btn.style.color = '#ff6666';
    }
  }

  // ── 포획 ──────────────────────────────────────────────────────
  _tryCapture() {
    if (!this.player || !this.waves || !this.camCtrl) return;
    this.player.swing();
    const result = this.waves.tryCapture(
      this.player.position,
      this.player.getForward(this.camCtrl),
      this.player.captureRange,
      this._luckBonus ?? 0
    );
    if (result) {
      // 업그레이드 배율 적용
      result.coins = Math.floor(result.coins * (this._coinMult  ?? 1));
      result.score = Math.floor(result.score * (this._scoreMult ?? 1));
      this.sessionScore += result.score;
      this.sessionCoins += result.coins;
      this.totalCoins = addCoins(result.coins);
      this.hud.showCaptureEffect(result.coins);
      this.hud.showScorePopup(result.score);
      this._triggerCaptureFlash();
      this.camCtrl?.shake(0.13);
      audioManager.sfxCaptureSuccess();
      // 크리처 이름 팝업 (피드백 강화)
      { const cfg = result.creature?.config;
        this.hud.showCaptureNamePopup(cfg?.name || cfg?.type || '생물', this._creatureIcon(cfg?.type)); }
      // 도감 기록
      recordCapturedType(result.creature?.config?.type);
      // 실시간 포획 피드 항목 추가
      this._addFeedEntry(result.creature?.config?.name || result.creature?.config?.type || '생물', result.coins);
      // 콤보 처리
      const combo = this.waves?.combo ?? 0;
      // 콤보 버스트 (5× / 10×)
      if (combo === 5 || combo === 10) this._showComboBurst(combo);
      // 스트릭 어나운서 (마일스톤 콤보)
      if (combo === 3 || combo === 5 || combo === 8 || combo === 10 || combo === 15 || combo === 20) {
        this._showStreakAnnouncer(combo);
      }
      // 슬로우모션 (콤보 8+ 포획 시)
      if (combo >= 8) this._slowMoTimer = 0.45;
      // FOV 킥 — 포획 순간 시야 확대 후 복귀
      if (this.camera) {
        this.camera.fov = 83;
        this.camera.updateProjectionMatrix();
        clearTimeout(this._fovKickTimer);
        this._fovKickTimer = setTimeout(() => {
          if (this.camera) { this.camera.fov = 75; this.camera.updateProjectionMatrix(); }
        }, 180);
      }
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
      this.hud.showMissPopup?.();
    }
  }

  _triggerCaptureFlash() {
    const el = document.getElementById('capture-flash');
    if (!el) return;
    el.style.opacity = '1';
    if (this._captureFlashTimeout) clearTimeout(this._captureFlashTimeout);
    this._captureFlashTimeout = setTimeout(() => { el.style.opacity = '0'; }, 140);
  }

  // ── 웨이브 업그레이드 카드 ────────────────────────────────────
  _showUpgradeCards(onDone) {
    const UPGRADES = [
      { icon: '🎯', name: '포획 범위 +20%',  desc: '포획 가능 거리가 넓어집니다',
        apply: () => { if (this.player) this.player.captureRange *= 1.2; } },
      { icon: '⚡', name: '이동 속도 +15%',  desc: '플레이어가 더 빠르게 달립니다',
        apply: () => { if (this.player) this.player._speedBonus = (this.player._speedBonus ?? 1) * 1.15; } },
      { icon: '⏰', name: '시간 +20초',       desc: '스테이지 제한 시간이 증가합니다',
        apply: () => { this.waves?.addTime(20); } },
      { icon: '💰', name: '코인 +35%',        desc: '이번 스테이지 코인 획득량 증가',
        apply: () => { this._coinMult = (this._coinMult ?? 1) * 1.35; } },
      { icon: '🔥', name: '콤보 유지 +2초',   desc: '콤보가 끊기지 않는 시간이 늘어납니다',
        apply: () => { if (this.waves) this.waves.comboTimer = Math.max(0, (this.waves.comboTimer ?? 0) - 2); } },
      { icon: '❤️', name: 'HP +40 회복',      desc: '현재 HP를 즉시 회복합니다',
        apply: () => { this.playerHP = Math.min((this.playerHP ?? 100) + 40, this.playerMaxHP ?? 100); } },
      { icon: '🍀', name: '럭키 포획 +20%',   desc: '모든 생물의 포획 확률이 상승합니다',
        apply: () => { this._luckBonus = (this._luckBonus ?? 0) + 0.20; } },
      { icon: '🌟', name: '점수 배율 +25%',   desc: '획득 점수가 1.25배가 됩니다',
        apply: () => { this._scoreMult = (this._scoreMult ?? 1) * 1.25; } },
      { icon: '💨', name: '대시 쿨다운 -30%', desc: '대시를 더 자주 사용할 수 있습니다',
        apply: () => { if (this.player) this.player._dashCooldownMax = (this.player._dashCooldownMax ?? 1.2) * 0.7; } },
      { icon: '🛡', name: '즉시 무적 5초',     desc: '잠시 동안 피해를 받지 않습니다',
        apply: () => { this._invincibleTimer = 5; } },
      { icon: '✨', name: '광역 포획 +1',      desc: '범위 내 생물 1마리 추가 자동 포획',
        apply: () => { this._bonusCapture = (this._bonusCapture ?? 0) + 1; } },
      { icon: '🔮', name: '포획 확률 시각화',   desc: '크리처 머리 위 확률 게이지 강화',
        apply: () => { this._showCaptureRadius = true; } },
    ];
    const pool = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.showUpgradeCards(pool, (idx) => {
      pool[idx].apply();
      setTimeout(() => { this.camCtrl?.requestLock(); onDone(); }, 400);
    });
  }

  // ── 크리처 타입 → 이모지 ─────────────────────────────────────
  _creatureIcon(type) {
    const M = {
      dragonfly:'🪰',butterfly:'🦋',bee:'🐝',ladybug:'🐞',cicada:'🦗',
      beetle:'🪲',grasshopper:'🦗',mantis:'🪲',cricket:'🦗',stag:'🪲',
      worm:'🪱',mole:'🐀',snail:'🐌',pill_bug:'🐛',centipede:'🐛',
      frog:'🐸',tadpole:'🐸',water_strider:'💧',water_beetle:'🪲',larvae:'🐛',
      firefly:'✨',leech:'🪱',crayfish:'🦞',salamander:'🦎',giant_beetle:'👑',
      crucian:'🐟',loach:'🐟',catfish:'🐟',eel:'🐍',turtle:'🐢',
      crab:'🦀',jellyfish:'🪼',seahorse:'🐡',clownfish:'🐠',starfish:'⭐',
      shark:'🦈',whale:'🐋',octopus:'🐙',manta:'🦈',anglerfish:'🐡',
      parrot:'🦜',iguana:'🦎',toucan:'🐦',tree_frog:'🐸',python:'🐍',
      lion:'🦁',elephant:'🐘',zebra:'🦓',giraffe:'🦒',hyena:'🐺',
      penguin:'🐧',elk:'🦌',snow_fox:'🦊',yeti:'❄️',snowbird:'🐦',
      gorilla:'🦍',anaconda:'🐍',poison_frog:'🐸',jaguar:'🐆',
      trex:'🦖',triceratops:'🦕',raptor:'🦖',pterodactyl:'🐦',stegosaurus:'🦕',
      alien:'👾',robot:'🤖',space_jellyfish:'🪼',comet_bug:'⭐',moonwalker:'🌕',
    };
    return M[type] ?? '🐾';
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

  // ── 디버그: 스크린샷 PNG 저장 ────────────────────────────────
  _debugScreenshot() {
    // preserveDrawingBuffer 없이도 toDataURL 직후 렌더 직후엔 유효
    this.renderer.render(this.scene, this.camera);
    const url  = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.href     = url;
    link.download = `hunters_${Date.now()}.png`;
    link.click();
    // 화면 플래시 피드백
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0.5;z-index:99999;pointer-events:none;';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 120);
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
    // 스킬 포획도 일반 포획과 동일하게 점수 팝업 + 캡처 피드에 표시
    this.hud.showScorePopup?.(score);
    recordCapturedType(creature?.config?.type);
    this._addFeedEntry(
      creature?.config?.name || creature?.config?.type || '생물',
      coins
    );
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
          this.waves.comboTimer = 0;
          if (this.waves.combo > this.waves.maxCombo) this.waves.maxCombo = this.waves.combo;
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
            this.waves.comboTimer = 0;
            if (this.waves.combo > this.waves.maxCombo) this.waves.maxCombo = this.waves.combo;
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
    // 스킬 사용 시 화면 엣지 플래시 + 음향 피드백
    this._flashSkillActivation(skillId);
    audioManager.sfxCombo?.(Math.max(1, this.waves?.combo || 1));
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
        // 전 생물 플레이어 쪽으로 8초간 강제 유인 (일반 미끼보다 넓은 범위·긴 지속)
        if (this.waves && this.player) {
          const pos = this.player.position;
          this.waves.creatures.forEach(c => {
            if (!c.alive || c.captured) return;
            c._baitTarget = pos.clone();
            c._baitTimer  = 8;
          });
        }
        this.hud.showWaveMessage('💫 슈퍼 미끼! 전 생물 유인!');
        break;
    }

    audioManager.sfxUIClick?.();
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
    if (this.camCtrl) this.camCtrl._shakeIntensity = 0; // 재개 시 흔들림 방지
    if (this.player) this.player.keys = {};             // keyup 누락 방지
    document.body.style.cursor = '';                    // 커서 명시적 복원
    this._showLockHint(false);
    audioManager.setState('pause');
    this._showScreen('pause');
  }

  _resumeGame() {
    if (this.camCtrl) this.camCtrl._shakeIntensity = 0; // 재개 흔들림 방지
    if (this.player)  this.player.keys = {};            // 키 상태 리셋
    this._showScreen('game');
    this._startLoop();
    audioManager.setState('exploration');
    // 재개 시 포인터락 자동 재획득
    if (this.camCtrl) this.camCtrl.requestLock();
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
    this.totalDamageTaken = (this.totalDamageTaken || 0) + damage;
    this._invincibleTimer = 1.5; // 1.5초 무적
    this.hud.updateHP(this.playerHP, this.playerMaxHP);
    this.hud.flashDamage();
    this.hud.showDamagePopup(damage);
    audioManager.sfxDamage();
    this.camCtrl?.shake(0.22); // 피격 카메라 흔들림

    if (this.playerHP <= 0) {
      // HP 0 → 스테이지 실패
      this._stopLoop();
      this.hud.hide();
      document.getElementById('result-emoji').textContent = '💀';
      document.getElementById('result-title').textContent = '전투 불능!';
      document.getElementById('btn-next-stage').style.display = 'none';
      document.getElementById('nickname-row').classList.add('hidden');
      this._setResultStars(0);
      this._showScreen('result');
      this._animateResultNumbers(this.waves?.capturedCount || 0, 0, this.waves?.maxCombo || 0, this.totalDamageTaken || 0);
    }
  }

  _onStageComplete(result) {
    this._stopLoop();
    this.hud.hide();

    const stageData = STAGES.find(s => s.id === this.selectedStage);

    // ── 별점 계산 (4인수 가중 합산, 0~100점) ──────────────────────
    // ① 시간 효율: 남은 시간 비율 × 30점
    const timeRatio    = result.timeLeft / (stageData?.timeLimit || 60);
    // ② 포획 초과: 목표 초과분 / 목표치 (최대 1.0) × 25점
    const target       = stageData?.targetCount || 1;
    const captureBonus = Math.min(Math.max(result.captured - target, 0) / target, 1.0);
    // ③ 콤보 성과: 최고 콤보 / 10 (최대 1.0) × 20점
    const comboScore   = Math.min((result.maxCombo || 0) / 10, 1.0);
    // ④ 생존력: 무피해 25점 / 피격 1회당 -2.5점 (최소 0)
    const dmg          = this.totalDamageTaken || 0;
    const surviveScore = dmg === 0 ? 25 : Math.max(0, 10 - dmg * 2.5);

    const starScore = timeRatio * 30 + captureBonus * 25 + comboScore * 20 + surviveScore;
    const stars = starScore >= 65 ? 3 : starScore >= 33 ? 2 : 1;

    markStageCleared(this.selectedStage, this.sessionScore, stars);
    audioManager.sfxStageComplete();
    this._launchConfetti();

    // 무결 클리어 보너스 (피해 0)
    if (this.totalDamageTaken === 0 && result.captured > 0) {
      const bonus = 500;
      this.sessionCoins += bonus;
      this.totalCoins = addCoins(bonus);
      this._checkAchievement('no_damage', '💎', '완전 무결 클리어!');
    }
    if (stars === 3) {
      // 퍼펙트 클리어 — 컨페티 두 번 더 터짐
      setTimeout(() => this._launchConfetti(), 500);
      setTimeout(() => this._launchConfetti(), 1050);
    }
    this._checkAchievement('first_clear', '🎉', '첫 스테이지 클리어!');
    if (stars === 3) this._checkAchievement('perfect_clear', '⭐', '완벽 클리어!');

    document.getElementById('result-emoji').textContent = '🎉';
    document.getElementById('result-title').textContent = `스테이지 ${this.selectedStage} 클리어!`;
    document.getElementById('btn-next-stage').style.display = this.selectedStage < STAGES.length ? '' : 'none';
    document.getElementById('nickname-row').classList.remove('hidden');

    // 별점 상세 힌트
    const hintEl = document.getElementById('star-score-hint');
    if (hintEl) {
      const t = Math.round(timeRatio * 100);
      const c = Math.round(captureBonus * 100);
      const k = Math.round(comboScore * 100);
      const s = Math.round(surviveScore / 25 * 100);
      hintEl.textContent =
        `⏱ 시간 ${t}%  🎯 포획 +${c}%  🔥 콤보 ${k}%  💚 생존 ${s}%  → 종합 ${Math.round(starScore)}점`;
    }

    this._setResultStars(stars);

    // 마지막 닉네임 자동 채우기
    const savedNick = localStorage.getItem('gy_last_nickname') || '';
    const nickInput = document.getElementById('nickname-input');
    if (nickInput && savedNick) nickInput.value = savedNick;

    this._showScreen('result');
    this._animateResultNumbers(result.captured, result.timeLeft, result.maxCombo, this.totalDamageTaken || 0);
  }

  _onStageFail() {
    this._stopLoop();
    this.hud.hide();
    audioManager.sfxStageFail();

    document.getElementById('result-emoji').textContent = '😢';
    document.getElementById('result-title').textContent = '시간 초과!';
    document.getElementById('btn-next-stage').style.display = 'none';
    document.getElementById('nickname-row').classList.add('hidden');
    this._setResultStars(0);

    this._showScreen('result');
    this._animateResultNumbers(this.waves?.capturedCount || 0, 0, this.waves?.maxCombo || 0, this.totalDamageTaken || 0);
  }

  _animateResultNumbers(captured, timeLeft, maxCombo, damage = 0) {
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
      const dmgEl = document.getElementById('res-damage');
      if (dmgEl) dmgEl.textContent = Math.round(t * damage);
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
      // ── XSS 방어: innerHTML 대신 DOM 메서드 + textContent 사용 ──
      const row = document.createElement('div');
      row.className = 'lb-row';

      const rankDiv = document.createElement('div');
      rankDiv.className = `lb-rank${i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : ''}`;
      rankDiv.textContent = String(i + 1);

      const nameDiv = document.createElement('div');
      nameDiv.className = 'lb-name';
      nameDiv.textContent = String(rec.nickname ?? '');

      const stageDiv = document.createElement('div');
      stageDiv.className = 'lb-stage';
      stageDiv.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.5);margin:0 8px';
      stageDiv.textContent = String(rec.stage_name || `스테이지 ${rec.stage_id}`);

      const scoreDiv = document.createElement('div');
      scoreDiv.className = 'lb-score';
      scoreDiv.textContent = `${Number(rec.score || 0).toLocaleString()}점`;

      row.append(rankDiv, nameDiv, stageDiv, scoreDiv);
      container.appendChild(row);
    });
  }

  // ── 크리처 도감 렌더링 ────────────────────────────────────────
  _renderDex() {
    const content  = document.getElementById('dex-content');
    const countEl  = document.getElementById('dex-count');
    const pctEl    = document.getElementById('dex-pct');
    const fillEl   = document.getElementById('dex-bar-fill');
    if (!content) return;

    const save = loadSave();
    const captured = save.capturedTypes || {};

    // 전 스테이지 크리처를 type 기준으로 중복 제거 (보스 포함)
    const seen = new Map(); // type → { name, color, coins, stageIcon, isBoss }
    STAGES.forEach(stage => {
      stage.creatures.forEach(c => {
        if (!seen.has(c.type)) seen.set(c.type, { ...c, stageIcon: stage.icon });
      });
      if (stage.miniBoss && !seen.has(stage.miniBoss.type)) {
        seen.set(stage.miniBoss.type, { ...stage.miniBoss, stageIcon: stage.icon, isBoss: true });
      }
    });

    const total = seen.size;
    const discoveredCount = [...seen.keys()].filter(t => (captured[t] || 0) > 0).length;

    if (countEl) countEl.textContent = `${discoveredCount} / ${total}`;
    const pct = total > 0 ? Math.round(discoveredCount / total * 100) : 0;
    if (pctEl)  pctEl.textContent  = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;

    content.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'dex-grid';

    seen.forEach((c, type) => {
      const cnt   = captured[type] || 0;
      const found = cnt > 0;
      const clr = typeof c.color === 'number'
        ? `#${c.color.toString(16).padStart(6, '0')}`
        : (c.color || '#888');

      const card = document.createElement('div');
      card.className = `dex-card${found ? ' dex-caught' : ' dex-unknown'}`;

      const avatar = document.createElement('div');
      avatar.className = found ? 'dex-avatar' : 'dex-avatar dex-avatar-unknown';
      avatar.style.borderColor = found ? clr : 'rgba(255,255,255,0.12)';
      avatar.style.color = found ? clr : 'rgba(255,255,255,0.25)';
      avatar.textContent = found ? '' : '?';
      if (found) {
        const dot = document.createElement('div');
        dot.style.cssText = `width:28px;height:28px;border-radius:50%;background:${clr};opacity:0.85;box-shadow:0 0 10px ${clr}66;`;
        avatar.appendChild(dot);
      }
      if (c.isBoss && found) {
        const crown = document.createElement('div');
        crown.className = 'dex-boss-crown';
        crown.textContent = '\u{1F451}';
        avatar.appendChild(crown);
      }

      const nameEl = document.createElement('div');
      nameEl.className = `dex-name${found ? '' : ' dex-name-unknown'}`;
      nameEl.textContent = found ? c.name : '???';

      const metaEl = document.createElement('div');
      metaEl.className = 'dex-meta';
      metaEl.textContent = found ? `${c.stageIcon} \xd7${cnt}` : '';

      card.append(avatar, nameEl, metaEl);
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  // ── 스마트 조준선 ──────────────────────────────────────────────
  _updateCrosshair() {
    const el = document.getElementById('crosshair');
    if (!el || !this.waves || !this.player || !this.camCtrl) return;
    const fwd   = this.player.getForward(this.camCtrl);
    const pos   = this.player.position;
    const range = this.player.captureRange;
    const canCapture = this.waves.creatures.some(c => {
      if (!c.alive || c.captured) return false;
      const dx = c.mesh.position.x - pos.x;
      const dz = c.mesh.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > range) return false;
      return (dx / dist) * fwd.x + (dz / dist) * fwd.z >= 0.1;
    });
    el.classList.toggle('crosshair--target', canCapture);
    el.textContent = canCapture ? '◎' : '+';
  }

  // ── 위험 방향 지시기 (화면 가장자리 빨간 화살표) ─────────────
  // DOM 풀링 — 매 프레임 innerHTML = '' + createElement 대신
  // 기존 엘리먼트 재사용 → GC 압력 제로
  _updateDangerIndicators() {
    const container = document.getElementById('danger-indicators');
    if (!container || !this.waves || !this.player || !this.camera) return;

    const W = window.innerWidth, H = window.innerHeight;
    const cx = W / 2, cy = H / 2;
    const _v = _gv;
    const margin = 52;

    // 풀: 기존 자식 엘리먼트 수집 → 재사용 우선
    const pool = container.children;
    let poolIdx = 0;

    this.waves.creatures.forEach(c => {
      if (!c.alive || c.captured) return;
      const aggro = (c.profile?.aggroRange ?? 0) > 0;
      if (!aggro) return;
      const dist = c.mesh.position.distanceTo(this.player.position);
      if (dist > 40) return;

      _v.copy(c.mesh.position).project(this.camera);
      const sx = (_v.x  + 1) / 2 * W;
      const sy = (-_v.y + 1) / 2 * H;
      // 이미 화면 안에 있으면 표시 불필요
      if (_v.z < 1 && sx > margin && sx < W - margin && sy > margin && sy < H - margin) return;

      const angle = Math.atan2(sy - cy, sx - cx);
      const maxX  = cx - margin, maxY = cy - margin;
      const tan   = Math.tan(angle);
      let ex, ey;
      if (Math.abs(maxX * Math.sin(angle)) < Math.abs(maxY * Math.cos(angle))) {
        ex = Math.sign(Math.cos(angle)) * maxX;
        ey = ex * tan;
      } else {
        ey = Math.sign(Math.sin(angle)) * maxY;
        ex = ey / tan;
      }

      const opacity = Math.max(0.35, 1 - dist / 40);
      // 풀에 여유 엘리먼트 있으면 재사용, 없으면 신규 생성
      let el;
      if (poolIdx < pool.length) {
        el = pool[poolIdx];
      } else {
        el = document.createElement('div');
        el.className = 'danger-arrow';
        container.appendChild(el);
      }
      el.style.cssText = `left:${cx + ex}px;top:${cy + ey}px;transform:translate(-50%,-50%) rotate(${angle - Math.PI / 2}rad);opacity:${opacity};`;
      poolIdx++;
    });

    // 사용하지 않은 풀 엘리먼트 뒤에서부터 제거
    while (container.children.length > poolIdx) {
      container.removeChild(container.lastChild);
    }
  }

  // ── 프리게임 생물 미리보기 ────────────────────────────────────
  _renderPregameCreatures(stageData) {
    const el = document.getElementById('pregame-creatures');
    if (!el || !stageData) return;
    el.innerHTML = '';
    const list = [...(stageData.creatures || [])];
    if (stageData.miniBoss) list.push({ ...stageData.miniBoss, _boss: true });
    list.forEach((c, i) => {
      const chip = document.createElement('div');
      chip.className = `creature-chip${c._boss ? ' creature-chip--boss' : ''}`;
      chip.style.animationDelay = `${i * 40}ms`;
      const name = document.createElement('span');
      name.className = 'cc-name';
      name.textContent = c.name;
      const coins = document.createElement('span');
      coins.className = 'cc-coins';
      coins.textContent = `💰${c.coins}`;
      chip.append(name, coins);
      el.appendChild(chip);
    });
  }

  // ── 결과 화면 별점 (순차 팝업) ───────────────────────────────
  _setResultStars(stars) {
    const el = document.getElementById('res-stars');
    if (!el) return;
    el.innerHTML = '';
    for (let s = 0; s < 3; s++) {
      const span = document.createElement('span');
      span.className = 'res-star';
      span.textContent = s < stars ? '⭐' : '☆';
      span.style.animationDelay = `${s * 260}ms`;
      el.appendChild(span);
    }
  }

  // ── 콤보 스트릭 어나운서 텍스트 (3/5/8/10/15/20 마일스톤) ──────
  _showStreakAnnouncer(combo) {
    const el = document.getElementById('streak-announcer');
    if (!el) return;
    const tiers = [
      { at: 3,  text: '🔥 TRIPLE!',       color: '#ff8844' },
      { at: 5,  text: '⚡ AWESOME!',       color: '#ffd700' },
      { at: 8,  text: '🔥 ON FIRE!',       color: '#ff4422' },
      { at: 10, text: '💥 UNSTOPPABLE!',   color: '#ff2288' },
      { at: 15, text: '👑 LEGENDARY!',     color: '#ffe066' },
      { at: 20, text: '✨ GOD MODE!',      color: '#ffffff' },
    ];
    const tier = tiers.find(t => t.at === combo);
    if (!tier) return;
    el.textContent = tier.text;
    el.style.color = tier.color;
    el.classList.remove('hidden', 'streak-show');
    void el.offsetHeight; // reflow 강제
    el.classList.add('streak-show');
    clearTimeout(this._streakTimer);
    this._streakTimer = setTimeout(() => {
      el.classList.remove('streak-show');
      setTimeout(() => el.classList.add('hidden'), 260);
    }, 950);
  }

  // ── 실시간 포획 피드 항목 ────────────────────────────────────
  _addFeedEntry(name, coins) {
    const feed = document.getElementById('capture-feed');
    if (!feed) return;
    const el = document.createElement('div');
    el.className = 'feed-entry';
    el.textContent = `${name}  +${coins}💰`;
    feed.prepend(el);
    // 최대 4개 유지
    while (feed.children.length > 4) feed.lastChild?.remove();
    // 3초 후 페이드 아웃 → 제거
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 420);
    }, 3000);
  }

  // ── 보스 등장 경고 (wave 3이고 miniBoss 있는 스테이지, 남은 포획 ≤ 5) ──
  _updateBossWarning(state) {
    const el = document.getElementById('boss-warning');
    if (!el) return;
    const stageData = this.waves?.stage;
    const hasBoss = stageData?.miniBoss != null;
    const nearEnd = hasBoss && state.wave === 3 &&
                    (state.target - state.captured) <= 5 &&
                    state.target > state.captured;
    el.classList.toggle('hidden', !nearEnd);
  }

  // ── PB 경신 플래시 알림 ─────────────────────────────────────
  _showPBFlash() {
    const pbEl = document.getElementById('hud-pb');
    const pbValEl = document.getElementById('hud-pb-val');
    if (pbEl) {
      pbEl.classList.remove('hidden');
      pbEl.classList.add('pb-new-record');
      pbEl.textContent = '🏆 신기록!';
    }
    this.hud.showWaveMessage('🏆 신기록 달성!', true);
  }

  // ── 콤보 버스트 링 (5×/10× 콤보) ────────────────────────────
  _showComboBurst(combo) {
    const color = combo >= 10 ? '#ffee00' : '#ff8844';
    const rings  = combo >= 10 ? 5 : 3;
    if (combo >= 10) this.camCtrl?.shake(0.18);
    for (let i = 0; i < rings; i++) {
      const r = document.createElement('div');
      r.style.cssText = `
        position:fixed;left:50%;top:50%;
        width:80px;height:80px;border-radius:50%;
        border:3px solid ${color};
        pointer-events:none;z-index:400;
        animation:comboBurst ${0.55 + i * 0.08}s ease-out ${i * 75}ms forwards;
      `;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700 + i * 75);
    }
  }

  // ── 보스 웨이브 레드 플래시 ──────────────────────────────────
  _bossFlash() {
    this.camCtrl?.shake(0.42);
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;inset:0;
      background:radial-gradient(ellipse at center, rgba(180,0,0,0.5) 0%, rgba(255,0,0,0.15) 60%, transparent 100%);
      pointer-events:none;z-index:300;
      animation:skillFlash 0.7s ease forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }
}
