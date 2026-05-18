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

  /** 콤보 타이머 바 — 콤보 유지 남은 시간을 가는 바로 표시 */
  _updateComboTimerBar(state) {
    // 바 요소가 없으면 최초 1회 생성
    if (!this._comboTimerBar) {
      const bar = document.createElement('div');
      bar.id = '_comboTimerBar';
      bar.style.cssText = `
        position:absolute;bottom:-3px;left:0;height:3px;border-radius:2px;
        background:linear-gradient(90deg,#4ecdc4,#ffd700);
        transition:width 0.08s linear;pointer-events:none;
        box-shadow:0 0 6px #ffd700aa;
      `;
      const comboEl = document.getElementById('hud-combo');
      if (comboEl) {
        comboEl.style.position = 'relative';
        comboEl.appendChild(bar);
      }
      this._comboTimerBar = bar;
    }

    const ratio = state.comboTimeRatio ?? 0;
    const bar   = this._comboTimerBar;

    if (state.combo >= 3 && ratio > 0) {
      bar.style.width   = `${ratio * 100}%`;
      bar.style.opacity = '1';
      // 30% 이하 → 빨간색으로 경고
      if (ratio < 0.3) {
        bar.style.background = `linear-gradient(90deg,#ff4444,#ff8800)`;
        bar.style.boxShadow  = `0 0 8px #ff4444cc`;
        // 진동 효과 (animation 클래스)
        bar.style.animation  = 'comboUrgentPulse 0.2s ease-in-out infinite alternate';
      } else {
        bar.style.background = `linear-gradient(90deg,#4ecdc4,#ffd700)`;
        bar.style.boxShadow  = `0 0 6px #ffd700aa`;
        bar.style.animation  = '';
      }
    } else {
      bar.style.width   = '0%';
      bar.style.opacity = '0';
      bar.style.animation = '';
    }
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
    // 타이머 긴박감 클래스
    this.timer.classList.toggle('timer-urgent',  t <= 10);
    this.timer.classList.toggle('timer-warning', t > 10 && t <= 30);
    this.timer.classList.toggle('timer-normal',  t > 30);
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
      // 진행바 래퍼에 단계 클래스 적용
      const barWrap = this.captureBar.parentElement;
      if (barWrap) {
        barWrap.classList.toggle('progress-near', pct >= 80);
        barWrap.classList.toggle('progress-mid',  pct >= 50 && pct < 80);
      }
    }

    const waveLabels = ['', '🌿 웨이브 1', '⚡ 웨이브 2', '🔥 웨이브 3', '👑 보스!'];
    const waveName = waveLabels[Math.min(state.wave, 4)] || `웨이브 ${state.wave}`;
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

    // 콤보 타이머 바 업데이트
    this._updateComboTimerBar(state);

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

  showCaptureEffect(coins, creatureName = '') {
    this.captureFxCoins.textContent = `+${coins} 💰`;
    // 생물 이름 서브텍스트
    let nameEl = document.getElementById('_captureName');
    if (!nameEl) {
      nameEl = document.createElement('div');
      nameEl.id = '_captureName';
      nameEl.style.cssText = `font-size:12px;opacity:0.75;margin-top:2px;letter-spacing:1px;`;
      this.captureFx?.appendChild(nameEl);
    }
    nameEl.textContent = creatureName ? `✅ ${creatureName} 포획!` : '';
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
      animation:scoreFloat 0.55s ease-out forwards;
    `;
    el.textContent = 'MISS';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
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
    const waveData = {
      1: { msg: '🌿 웨이브 1',  sub: '생물들이 나타났다! 빠르게 포획하라!',    color: '#4ecdc4' },
      2: { msg: '⚡ 웨이브 2',  sub: '더 많은 생물이! 콤보를 이어가라!',       color: '#ffd700' },
      3: { msg: '🔥 웨이브 3',  sub: '마지막 물결! 전부 잡아라!',              color: '#ff6b35' },
    };
    const wd = isBoss
      ? { msg: '👑 보스 등장!', sub: '전력을 다해라 — 단 하나뿐이다!',          color: '#ff4400' }
      : (waveData[wave] || { msg: `웨이브 ${wave}`, sub: '계속 싸워라!',        color: '#4ecdc4' });
    const { msg, sub, color } = wd;

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

  /** 포획 시 점수 팝업 — 점수 크기에 따라 색·크기·지속시간 차등 */
  showScorePopup(score) {
    if (!score || score <= 0) return;

    // 점수 규모별 스타일 분기
    let color, shadow, fontSize, dur;
    if (score >= 50000) {
      color = '#ff4400'; shadow = 'rgba(255,68,0,0.9)'; fontSize = 38; dur = 1600;
    } else if (score >= 10000) {
      color = '#ffd700'; shadow = 'rgba(255,215,0,0.9)'; fontSize = 32; dur = 1400;
    } else if (score >= 1000) {
      color = '#ff88ff'; shadow = 'rgba(255,140,255,0.8)'; fontSize = 26; dur = 1200;
    } else {
      color = '#44ffaa'; shadow = 'rgba(68,255,170,0.85)'; fontSize = 20; dur = 1000;
    }

    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;
      top:${22 + Math.random() * 12}%;
      left:${36 + (Math.random() - 0.5) * 20}%;
      color:${color};font-size:${fontSize}px;font-weight:900;
      font-family:'Rajdhani',sans-serif;letter-spacing:1px;
      text-shadow:0 0 16px ${shadow},0 2px 6px rgba(0,0,0,0.9);
      z-index:201;pointer-events:none;
      animation:scoreFloat ${dur}ms ease-out forwards;
    `;
    el.textContent = `+${score.toLocaleString()}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), dur);
  }

  /** 피격 데미지 팝업 — 랜덤 위치에서 위로 떠오름 */
  showDamagePopup(damage) {
    if (!damage || damage <= 0) return;
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
  // ── 포획 크리처 이름 팝업 ─────────────────────────────────────
  showCaptureNamePopup(name, icon = '✨') {
    const el = document.getElementById('capture-name-popup');
    if (!el) return;
    if (this._cnpTimer) clearTimeout(this._cnpTimer);
    if (this._cnpExitTimer) clearTimeout(this._cnpExitTimer);
    el.innerHTML = `
      <div class="cnp-caught">CAUGHT!</div>
      <div class="cnp-icon">${icon}</div>
      <div class="cnp-name">${name}</div>
    `;
    el.classList.remove('hidden', 'cnp-exit');
    el.offsetHeight;
    el.classList.add('cnp-enter');
    this._cnpTimer = setTimeout(() => {
      el.classList.remove('cnp-enter');
      el.classList.add('cnp-exit');
      this._cnpExitTimer = setTimeout(() => el.classList.add('hidden'), 360);
    }, 1200);
  }

  // ── 웨이브 업그레이드 카드 ────────────────────────────────────
  showUpgradeCards(options, onSelect) {
    const overlay = document.getElementById('upgrade-card-overlay');
    if (!overlay) { onSelect(0); return; }
    overlay.innerHTML = `
      <div class="upgrade-card-title">⚡ WAVE CLEAR</div>
      <div class="upgrade-card-sub">업그레이드를 선택하세요</div>
      <div class="upgrade-cards-row">
        ${options.map((opt, i) => `
          <div class="upgrade-card" data-idx="${i}">
            <div class="upgrade-card-icon">${opt.icon}</div>
            <div class="upgrade-card-name">${opt.name}</div>
            <div class="upgrade-card-desc">${opt.desc}</div>
            <div class="upgrade-card-pick">선택하기 →</div>
          </div>
        `).join('')}
      </div>
    `;
    overlay.classList.remove('hidden');
    overlay.querySelectorAll('.upgrade-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx, 10);
        overlay.style.animation = 'upgradeFadeIn 0.2s ease reverse forwards';
        setTimeout(() => {
          overlay.classList.add('hidden');
          overlay.style.animation = '';
          onSelect(idx);
        }, 200);
      }, { once: true });
    });
  }
}