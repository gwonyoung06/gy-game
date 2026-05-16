import { loadSave } from '../utils/storage.js';
import { SHOP_ITEMS, CONSUMABLES } from '../data/shop.js';

// 모든 아이템 플랫 목록 (아이콘 조회용)
function _allItems() {
  return [
    ...SHOP_ITEMS.tools, ...SHOP_ITEMS.abilities,
    ...SHOP_ITEMS.skills, ...SHOP_ITEMS.cosmetic,
    ...SHOP_ITEMS.pets, ...CONSUMABLES,
  ];
}

export class HUD {
  constructor() {
    this.el          = document.getElementById('hud');
    this.timer       = document.getElementById('hud-timer');
    this.coins       = document.getElementById('hud-coins');
    this.captured    = document.getElementById('hud-captured');
    this.target      = document.getElementById('hud-target');
    this.wave        = document.getElementById('hud-wave');
    this.stage       = document.getElementById('hud-stage');
    this.captureBar  = document.getElementById('hud-capture-bar');
    this.comboEl     = document.getElementById('hud-combo');
    this.comboCount  = document.getElementById('combo-count');
    this.comboMult   = document.getElementById('combo-mult');
    this.scoreEl     = document.getElementById('hud-score');
    this.captureFx   = document.getElementById('capture-fx');
    this.captureFxCoins = document.getElementById('capture-fx-coins');
    this.hpFill      = document.getElementById('hud-hp-fill');
    this.hpText      = document.getElementById('hud-hp-text');
    this._fxTimeout  = null;
    this._dmgFlashTimeout = null;
    this._prevCaptured = -1;

    // 스킬 쿨다운 상태 { Q, E, R } → { cd, maxCd }
    this._skillCDs   = { Q: 0, E: 0, R: 0 };

    this._buildHotbar();
    this._refreshSkillIcons();
  }

  // ── 3×3 핫바 동적 생성 ──────────────────────────────────────
  _buildHotbar() {
    const wrap = document.getElementById('hud-hotbar');
    if (!wrap) return;
    wrap.innerHTML = '';
    const save = loadSave();

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.id = `hs-${i}`;

      const entry = save.hotbar?.[i];
      const item  = entry ? _allItems().find(it => it.id === entry.id) : null;

      if (item) {
        slot.innerHTML = `
          <span>${item.icon}</span>
          <span class="hotbar-key">${i + 1}</span>
          ${entry.count > 1 ? `<span class="hotbar-count">${entry.count}</span>` : ''}
        `;
      } else {
        slot.innerHTML = `<span class="hotbar-key">${i + 1}</span>`;
      }
      slot.title = item ? item.name : `슬롯 ${i + 1}`;
      wrap.appendChild(slot);
    }
  }

  /** 핫바 특정 슬롯 활성화 표시 */
  activateHotbarSlot(index) {
    document.querySelectorAll('.hotbar-slot').forEach((el, i) => {
      el.classList.toggle('hs-active', i === index);
    });
  }

  // ── 스킬 아이콘 갱신 (인벤토리 변경 후 호출) ────────────────
  _refreshSkillIcons() {
    const save = loadSave();
    ['Q', 'E', 'R'].forEach(key => {
      const iconEl = document.getElementById(`hsk-icon-${key}`);
      if (!iconEl) return;
      const id   = save.skillSlots?.[key];
      const item = id ? _allItems().find(i => i.id === id) : null;
      iconEl.textContent = item ? item.icon : '—';
    });
  }

  /** 스킬 쿨다운 시작 */
  startSkillCD(key, totalCd) {
    this._skillCDs[key] = { remaining: totalCd, total: totalCd };
  }

  /** 매 프레임 쿨다운 업데이트 (update()에서 호출) */
  _tickSkillCDs(delta) {
    ['Q', 'E', 'R'].forEach(key => {
      const cd = this._skillCDs[key];
      if (!cd || cd.remaining <= 0) return;
      cd.remaining = Math.max(0, cd.remaining - delta);

      const cdEl = document.getElementById(`hsk-cd-${key}`);
      const slot = document.getElementById(`hskill-${key}`);
      if (!cdEl) return;

      const pct = cd.remaining / cd.total;
      // clip-path inset: top% 으로 쿨다운 progress 표현
      cdEl.style.clipPath = `inset(${(1 - pct) * 100}% 0 0 0)`;
      if (slot) slot.classList.toggle('active-skill', cd.remaining <= 0);
    });
  }

  show(stageName) {
    this.el.classList.remove('hidden');
    if (stageName) this.stage.textContent = stageName;
  }

  hide() { this.el.classList.add('hidden'); }

  update(state, totalCoins, delta = 0, sessionScore = 0) {
    const t = state.timeRemaining;
    this.timer.textContent = t;
    this.timer.classList.toggle('urgent', t <= 10);

    // 포획 수 증가 시 바운스 애니메이션
    if (state.captured !== this._prevCaptured) {
      this._prevCaptured = state.captured;
      this.captured.classList.remove('hud-bounce');
      void this.captured.offsetHeight; // reflow
      this.captured.classList.add('hud-bounce');
      setTimeout(() => this.captured.classList.remove('hud-bounce'), 420);
    }
    this.captured.textContent = state.captured;
    this.target.textContent = state.target;
    this.coins.textContent = totalCoins;
    if (this.scoreEl) this.scoreEl.textContent = sessionScore.toLocaleString();
    // 포획 진행 바
    if (this.captureBar && state.target > 0) {
      const pct = Math.min(100, (state.captured / state.target) * 100);
      this.captureBar.style.width = pct + '%';
      // 색상: 청록(0%) → 금색(50%) → 주황(100%)
      const hue = Math.round(180 - pct * 1.5);
      this.captureBar.style.background = `hsl(${hue},90%,55%)`;
    }

    const waveName = state.wave <= 3 ? `웨이브 ${state.wave}` : '⚡ 보스!';
    this.wave.textContent = waveName;

    // 웨이브 진행 도트
    document.querySelectorAll('.wave-dot').forEach(d => {
      const w = parseInt(d.dataset.wave);
      const isCurrent = state.wave === w;
      const isDone    = state.wave > w;
      d.classList.toggle('wave-dot--active', isCurrent);
      d.classList.toggle('wave-dot--done',   isDone && !isCurrent);
    });

    const glow = document.getElementById('combo-glow');
    const multMap = { 10: '×2.0', 5: '×1.5', 3: '×1.2' };
    let multText = '', glowClass = '';
    if (state.combo >= 10) {
      this.comboEl.classList.remove('hidden');
      this.comboCount.textContent = state.combo;
      multText = '×2.0'; glowClass = 'combo-glow-10';
    } else if (state.combo >= 5) {
      this.comboEl.classList.remove('hidden');
      this.comboCount.textContent = state.combo;
      multText = '×1.5'; glowClass = 'combo-glow-5';
    } else if (state.combo >= 3) {
      this.comboEl.classList.remove('hidden');
      this.comboCount.textContent = state.combo;
      multText = '×1.2'; glowClass = 'combo-glow-3';
    } else {
      this.comboEl.classList.add('hidden');
    }
    if (this.comboMult) this.comboMult.textContent = multText;
    if (glow) { glow.style.opacity = glowClass ? '1' : '0'; glow.className = glowClass; }

    if (delta > 0) this._tickSkillCDs(delta);
  }

  // HP 바 업데이트
  updateHP(hp, maxHp) {
    if (!this.hpFill) return;
    const pct = Math.max(0, hp / maxHp) * 100;
    this.hpFill.style.width = pct + '%';
    // 색상: 녹색 → 노랑 → 빨강
    const hue = Math.round(pct * 1.2);
    this.hpFill.style.background = `hsl(${hue}, 90%, 45%)`;
    if (this.hpText) this.hpText.textContent = `${hp}/${maxHp}`;
    // HP 위험 상태 (30% 이하) — 펄스 + 비네트
    const critical = pct > 0 && pct < 30;
    this.hpFill.classList.toggle('hp-critical', critical);
    document.body.classList.toggle('hp-danger', critical);
  }

  // 피격 화면 플래시
  flashDamage() {
    const overlay = document.getElementById('damage-overlay');
    if (!overlay) return;
    overlay.style.opacity = '0.55';
    if (this._dmgFlashTimeout) clearTimeout(this._dmgFlashTimeout);
    this._dmgFlashTimeout = setTimeout(() => {
      overlay.style.opacity = '0';
    }, 350);
  }

  /** 피격 데미지 수치 팝업 — 화면 중앙 하단에 빨간 숫자 */
  showDamagePopup(damage) {
    if (!damage || damage <= 0) return;
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;left:50%;top:58%;
      transform:translate(-50%,-50%);
      font-size:28px;font-weight:900;
      color:#ff4444;text-shadow:0 2px 12px rgba(255,0,0,0.6);
      pointer-events:none;z-index:160;
      animation:scoreFloat 0.7s ease-out forwards;
    `;
    el.textContent = `-${damage}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }

  showCaptureEffect(coins) {
    this.captureFxCoins.textContent = coins;
    this.captureFx.classList.remove('hidden');
    this.captureFx.style.animation = 'none';
    this.captureFx.offsetHeight; // reflow
    this.captureFx.style.animation = '';

    if (this._fxTimeout) clearTimeout(this._fxTimeout);
    this._fxTimeout = setTimeout(() => {
      this.captureFx.classList.add('hidden');
    }, 800);

    // 코인 버스트 파티클
    this.spawnCoinBurst(Math.min(coins, 12));
  }

  /**
   * 화면 중앙(포획 지점)에서 코인 파티클을 흩뿌리고
   * HUD 코인 카운터 방향으로 호 포물선을 그리며 수렴한다.
   * @param {number} count  방출 파티클 수 (1~12)
   */
  spawnCoinBurst(count = 6) {
    if (count <= 0) return;
    // 동시 파티클 상한: DOM 폭탄 방지
    const MAX_LIVE = 48;
    const live = document.querySelectorAll('.coin-burst-particle').length;
    if (live >= MAX_LIVE) return;
    count = Math.min(count, MAX_LIVE - live);

    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;

    // HUD 코인 위치 (상단 우측)
    const hudCoin = this.coins;
    let tx = window.innerWidth  - 90;
    let ty = 36;
    if (hudCoin) {
      const r = hudCoin.getBoundingClientRect();
      tx = r.left + r.width  / 2;
      ty = r.top  + r.height / 2;
    }

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'coin-burst-particle';
      el.textContent = '💰';
      el.style.cssText = `
        position:fixed;
        left:${cx}px;top:${cy}px;
        font-size:${14 + Math.random() * 8}px;
        z-index:200;
        pointer-events:none;
        will-change:transform,opacity;
        transform:translate(-50%,-50%);
        user-select:none;
      `;
      document.body.appendChild(el);

      // 랜덤 초기 폭발 벡터
      const angle   = (Math.random() * Math.PI * 2);
      const spread  = 60 + Math.random() * 80;
      const bx      = Math.cos(angle) * spread;
      const by      = Math.sin(angle) * spread - 40; // 위쪽 편향
      const delay   = i * 35;                        // 시차

      // CSS custom property로 키프레임에 값 주입
      el.style.setProperty('--bx', `${bx}px`);
      el.style.setProperty('--by', `${by}px`);
      el.style.setProperty('--tx', `${tx - cx}px`);
      el.style.setProperty('--ty', `${ty - cy}px`);

      el.style.animationName      = 'coinBurst';
      el.style.animationDuration  = `${600 + Math.random() * 250}ms`;
      el.style.animationDelay     = `${delay}ms`;
      el.style.animationTimingFunction = 'ease-in';
      el.style.animationFillMode  = 'forwards';

      el.addEventListener('animationend', () => el.remove());
      // 안전망: 최대 1.2초 후 강제 제거
      setTimeout(() => el.remove(), delay + 1200);
    }
  }

  /** 포획 실패 팝업 — 화면 중앙에 짧게 "MISS" */
  showMissPopup() {
    // 너무 자주 나오면 방해됨 — 0.3s 쿨다운
    const now = Date.now();
    if (this._lastMiss && now - this._lastMiss < 300) return;
    this._lastMiss = now;
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;left:50%;top:46%;
      transform:translate(-50%,-50%);
      font-size:18px;font-weight:700;
      color:rgba(255,255,255,0.55);
      text-shadow:0 1px 6px rgba(0,0,0,0.5);
      pointer-events:none;z-index:155;
      animation:scoreFloat 0.55s ease