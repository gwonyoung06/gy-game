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
  }

  showWaveMessage(wave, isCountdown = false) {
    // 카운트다운 문자열 (웨이브 전환 중): 작은 토스트로 표시
    if (isCountdown || typeof wave === 'string') {
      const cd = document.createElement('div');
      cd.style.cssText = `
        position:fixed;top:36%;left:50%;transform:translate(-50%,-50%) scale(0.85);
        background:rgba(6,10,20,0.80);border:1px solid rgba(255,215,0,0.4);
        border-radius:10px;padding:8px 24px;font-size:18px;font-weight:900;
        color:#ffd700;letter-spacing:2px;z-index:150;pointer-events:none;
        transition:transform 0.15s ease,opacity 0.15s ease;opacity:0;
      `;
      cd.textContent = wave;
      document.body.appendChild(cd);
      requestAnimationFrame(() => { cd.style.transform = 'translate(-50%,-50%) scale(1)'; cd.style.opacity = '1'; });
      setTimeout(() => { cd.style.opacity = '0'; setTimeout(() => cd.remove(), 200); }, 380);
      return;
    }

    const isBoss = wave > 3;
    const msg    = isBoss ? '👑 보스 등장!' : `웨이브 ${wave}`;
    const sub    = isBoss ? '최후의 일전!' : wave === 1 ? '사냥 시작!' : wave === 2 ? '더 많은 생물이 나타났다!' : '마지막 웨이브!';
    const color  = isBoss ? '#ff4400' : wave === 1 ? '#4ecdc4' : wave === 2 ? '#ffd700' : '#ff6b35';

    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;top:42%;left:50%;transform:translate(-50%,-50%) scale(0.7);
      background:rgba(6,10,20,0.92);
      border:2px solid ${color};
      border-radius:16px;
      padding:18px 44px 14px;
      text-align:center;
      z-index:150;pointer-events:none;
      box-shadow:0 0 40px ${color}55, inset 0 0 24px rgba(0,0,0,0.5);
      transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease;
      opacity:0;
    `;
    toast.innerHTML = `
      <div style="font-family:'Rajdhani',sans-serif;font-size:32px;font-weight:900;color:${color};letter-spacing:3px;text-shadow:0 0 20px ${color}99">${msg}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:4px;letter-spacing:1px">${sub}</div>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = 'translate(-50%,-50%) scale(1)';
      toast.style.opacity   = '1';
    });
    setTimeout(() => {
      toast.style.opacity   = '0';
      toast.style.transform = 'translate(-50%,-50%) scale(0.85)';
      setTimeout(() => toast.remove(), 280);
    }, 2000);
  }

  showScorePopup(score) {
    if (!score || score <= 0) return;
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;
      top:${24 + Math.random() * 10}%;
      left:${37 + (Math.random() - 0.5) * 22}%;
      color:#44ffaa;font-size:21px;font-weight:900;
      font-family:'Rajdhani',sans-serif;letter-spacing:1px;
      text-shadow:0 0 14px rgba(68,255,170,0.85),0 2px 6px rgba(0,0,0,0.9);
      z-index:201;pointer-events:none;
      animation:scoreFloat 1.1s ease-out forwards;
    `;
    el.textContent = `+${score.toLocaleString()}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  showDamagePopup(damage) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;
      top:${35 + Math.random() * 10}%;
      left:${45 + (Math.random()-0.5)*20}%;
      color:#ff4444;font-size:28px;font-weight:900;
      text-shadow:0 2px 8px rgba(0,0,0,0.8);
      z-index:200;pointer-events:none;
      animation:dmgFloat 0.9s ease forwards;
    `;
    el.textContent = `-${damage}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}
