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
    this.comboEl     = document.getElementById('hud-combo');
    this.comboCount  = document.getElementById('combo-count');
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

  update(state, totalCoins, delta = 0) {
    const t = state.timeRemaining;
    this.timer.textContent = t;
    this.timer.classList.toggle('urgent', t <= 10);

    this.captured.textContent = state.captured;
    this.target.textContent = state.target;
    this.coins.textContent = totalCoins;

    const waveName = state.wave <= 3 ? `웨이브 ${state.wave}` : '⚡ 보스!';
    this.wave.textContent = waveName;

    if (state.combo >= 3) {
      this.comboEl.classList.remove('hidden');
      this.comboCount.textContent = state.combo;
    } else {
      this.comboEl.classList.add('hidden');
    }

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

  showWaveMessage(wave) {
    const msg = wave <= 3 ? `웨이브 ${wave}` : '👑 보스 등장!';
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,0.8);color:#fff;
      padding:16px 32px;border-radius:12px;
      font-size:24px;font-weight:900;z-index:100;
      animation:fadeIn 0.3s ease;pointer-events:none;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
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
