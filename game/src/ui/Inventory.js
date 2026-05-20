/**
 * Inventory — 인벤토리 화면
 *
 * 레이아웃:
 *   [캐릭터 프리뷰 + 장착 슬롯] | [5×5 아이템 그리드] | [스킬 등록 페이지]
 *
 * 상호작용:
 *   - 아이템 클릭 → 선택(하이라이트) → 빈 슬롯 클릭 → 이동
 *   - 스킬을 스킬 슬롯으로 이동하면 Q/E/R 등록
 *   - 핫바로 이동하면 1~9 사용 등록
 */

import * as THREE from 'three';
import { loadSave, saveSave } from '../utils/storage.js';
import { SHOP_ITEMS, CONSUMABLES } from '../data/shop.js';

// 장착 슬롯 메타데이터
const EQUIP_SLOTS = [
  { id: 'head',   label: '머리',   icon: '⛑️',  gridPos: [1, 0] },
  { id: 'chest',  label: '상의',   icon: '👕',  gridPos: [1, 1] },
  { id: 'weapon', label: '도구',   icon: '🥅',  gridPos: [0, 1] },
  { id: 'legs',   label: '하의',   icon: '👖',  gridPos: [1, 2] },
  { id: 'boots',  label: '신발',   icon: '👟',  gridPos: [1, 3] },
  { id: 'acc1',   label: '장신구1', icon: '💍', gridPos: [2, 1] },
  { id: 'acc2',   label: '장신구2', icon: '📿', gridPos: [2, 2] },
];

// 스킬 슬롯 (Q/E/R + S4/S5)
const SKILL_KEYS = [
  { id: 'Q',  label: 'Q', color: '#ff9944' },
  { id: 'E',  label: 'E', color: '#44aaff' },
  { id: 'R',  label: 'R', color: '#ff4488' },
  { id: 'S4', label: '4', color: '#aaffaa' },
  { id: 'S5', label: '5', color: '#ffaaff' },
];

// 모든 아이템 플랫 목록
function allItems() {
  return [
    ...SHOP_ITEMS.tools,
    ...SHOP_ITEMS.abilities,
    ...SHOP_ITEMS.skills,
    ...SHOP_ITEMS.cosmetic,
    ...SHOP_ITEMS.pets,
    ...CONSUMABLES,
  ];
}

export class Inventory {
  /**
   * @param {HTMLElement} container  — #screen-inventory
   * @param {Function}    onClose
   * @param {object|null} playerMesh — Three.js Group (캐릭터 프리뷰용)
   */
  constructor(container, onClose, playerMesh = null) {
    this.container  = container;
    this.onClose    = onClose;
    this.playerMesh = playerMesh;

    this._selected  = null; // { source, index } 현재 선택된 슬롯
    this._previewRenderer = null;
    this._previewScene    = null;
    this._previewCam      = null;
    this._previewRAF      = null;

    this._build();
  }

  // ── 열기 / 닫기 ────────────────────────────────────────────
  open(playerMesh) {
    if (playerMesh) this.playerMesh = playerMesh;
    this.container.classList.remove('hidden');
    this._selected = null;
    this._refresh();
    this._startPreview();
  }

  close() {
    this.container.classList.add('hidden');
    this._stopPreview();
    if (this.onClose) this.onClose();
  }

  // ── UI 구조 빌드 (최초 1회) ────────────────────────────────
  _build() {
    this.container.innerHTML = `
      <div class="inv-overlay">
        <div class="inv-window">
          <!-- 헤더 -->
          <div class="inv-header">
            <span class="inv-title">🎒 인벤토리</span>
            <button class="inv-close-btn" id="inv-close">✕</button>
          </div>

          <div class="inv-body">
            <!-- ① 왼쪽: 캐릭터 + 장착 슬롯 -->
            <div class="inv-left">
              <div class="inv-section-label">캐릭터</div>
              <div class="inv-char-wrap" id="inv-char-wrap">
                <canvas id="inv-char-canvas" width="160" height="220"></canvas>
                <div class="inv-equip-grid" id="inv-equip-grid"></div>
              </div>
            </div>

            <!-- ② 가운데: 5×5 인벤토리 -->
            <div class="inv-center">
              <div class="inv-section-label">인벤토리 <small>(클릭 선택 → 슬롯 클릭 이동)</small></div>
              <div class="inv-grid5" id="inv-grid5"></div>
            </div>

            <!-- ③ 오른쪽: 스킬 등록 -->
            <div class="inv-right">
              <div class="inv-section-label">스킬 슬롯 등록</div>
              <div class="inv-skill-slots" id="inv-skill-slots"></div>
              <div class="inv-section-label" style="margin-top:12px">보유 스킬</div>
              <div class="inv-skill-pool" id="inv-skill-pool"></div>
            </div>
          </div>

          <!-- 핫바 미리보기 -->
          <div class="inv-hotbar-row">
            <div class="inv-section-label">핫바 (1~9)</div>
            <div class="inv-hotbar-mini" id="inv-hotbar-mini"></div>
          </div>

        </div>
      </div>
    `;

    // 닫기 버튼
    document.getElementById('inv-close')
      .addEventListener('click', () => this.close());

    // 오버레이 클릭 닫기
    this.container.querySelector('.inv-overlay')
      .addEventListener('click', e => {
        if (e.target.classList.contains('inv-overlay')) this.close();
      });
  }

  // ── 전체 새로고침 ──────────────────────────────────────────
  _refresh() {
    this._renderEquipSlots();
    this._renderGrid5();
    this._renderSkillSlots();
    this._renderSkillPool();
    this._renderHotbarMini();
  }

  // ── ① 장착 슬롯 (Minecraft 스타일 그리드) ─────────────────
  _renderEquipSlots() {
    const save   = loadSave();
    const wrap   = document.getElementById('inv-equip-grid');
    wrap.innerHTML = '';

    // 3×4 grid — 슬롯이 없는 칸은 빈 공간
    const grid = Array.from({ length: 12 }, () => null);
    EQUIP_SLOTS.forEach(slot => {
      const [col, row] = slot.gridPos;
      grid[row * 3 + col] = slot;
    });

    grid.forEach((slot, idx) => {
      const cell = document.createElement('div');
      if (!slot) {
        cell.className = 'inv-equip-spacer';
      } else {
        const equippedId = save.equipment?.[slot.id];
        const item       = equippedId ? allItems().find(i => i.id === equippedId) : null;
        cell.className   = `inv-slot inv-equip-slot${this._isSelected('equip', idx) ? ' inv-selected' : ''}`;
        cell.dataset.source = 'equip';
        cell.dataset.idx    = idx;
        cell.dataset.slotId = slot.id;
        cell.title          = slot.label;
        cell.innerHTML = item
          ? `<span class="inv-item-icon">${item.icon}</span><span class="inv-item-label">${item.name}</span>`
          : `<span class="inv-slot-hint">${slot.icon}<br><small>${slot.label}</small></span>`;
        cell.addEventListener('click', () => this._onSlotClick('equip', idx, slot.id));
      }
      wrap.appendChild(cell);
    });
  }

  // ── ② 5×5 인벤토리 그리드 ─────────────────────────────────
  _renderGrid5() {
    const save = loadSave();
    const grid = document.getElementById('inv-grid5');
    grid.innerHTML = '';

    // 보유 아이템을 그리드에 배치 (저장된 위치 우선, 미배치 아이템은 빈 칸에 자동 배치)
    const slots = [...(save.inventoryGrid || Array(25).fill(null))];
    this._autoFillInventory(save, slots);

    for (let i = 0; i < 25; i++) {
      const cell = document.createElement('div');
      cell.className = `inv-slot${this._isSelected('inv', i) ? ' inv-selected' : ''}`;
      cell.dataset.source = 'inv';
      cell.dataset.idx    = i;

      const entry = slots[i];
      if (entry) {
        const item = allItems().find(it => it.id === entry.id);
        if (item) {
          cell.innerHTML = `
            <span class="inv-item-icon">${item.icon}</span>
            <span class="inv-item-label">${item.name.slice(0,5)}</span>
            ${entry.count > 1 ? `<span class="inv-item-count">${entry.count}</span>` : ''}
          `;
          cell.title = `${item.name}\n${item.desc || ''}`;
        }
      }
      cell.addEventListener('click', () => this._onSlotClick('inv', i));
      grid.appendChild(cell);
    }
  }

  /** 보유 아이템 중 그리드에 없는 것을 빈 칸에 자동 채움 */
  _autoFillInventory(save, slots) {
    const placed = new Set(slots.filter(Boolean).map(e => e.id));
    const missing = (save.ownedItems || []).filter(id => !placed.has(id));
    missing.forEach(id => {
      const emptyIdx = slots.findIndex(s => !s);
      if (emptyIdx >= 0) slots[emptyIdx] = { id, count: 1 };
    });
  }

  // ── ③ 스킬 슬롯 (Q/E/R/S4/S5) ────────────────────────────
  _renderSkillSlots() {
    const save = loadSave();
    const wrap = document.getElementById('inv-skill-slots');
    wrap.innerHTML = '';

    SKILL_KEYS.forEach(sk => {
      const assignedId = save.skillSlots?.[sk.id];
      const item       = assignedId ? allItems().find(i => i.id === assignedId) : null;
      const cell = document.createElement('div');
      cell.className   = `inv-slot inv-skill-reg-slot${this._isSelected('skill', sk.id) ? ' inv-selected' : ''}`;
      cell.dataset.source  = 'skill';
      cell.dataset.slotKey = sk.id;
      cell.style.borderColor = sk.color;
      cell.innerHTML = `
        <div class="inv-skill-key" style="background:${sk.color}">${sk.label}</div>
        ${item
          ? `<span class="inv-item-icon">${item.icon}</span>
             <span class="inv-item-label">${item.name.slice(0,6)}</span>`
          : `<span class="inv-slot-hint" style="color:${sk.color}">비어있음</span>`}
      `;
      cell.addEventListener('click', () => this._onSlotClick('skill', sk.id));
      wrap.appendChild(cell);
    });
  }

  // ── 보유 스킬 목록 ─────────────────────────────────────────
  _renderSkillPool() {
    const save  = loadSave();
    const wrap  = document.getElementById('inv-skill-pool');
    wrap.innerHTML = '';

    const skillItems = SHOP_ITEMS.skills.filter(s => save.ownedItems.includes(s.id));
    if (skillItems.length === 0) {
      wrap.innerHTML = '<div class="inv-empty-hint">상점에서 스킬을 구매하세요</div>';
      return;
    }

    skillItems.forEach(item => {
      const cell = document.createElement('div');
      cell.className = `inv-slot inv-skill-pool-slot${
        this._isSelected('pool', item.id) ? ' inv-selected' : ''}`;
      cell.innerHTML = `<span class="inv-item-icon">${item.icon}</span>
                        <span class="inv-item-label">${item.name.slice(0,5)}</span>`;
      cell.title = `${item.name}: ${item.desc}`;
      cell.addEventListener('click', () => this._onSlotClick('pool', item.id));
      wrap.appendChild(cell);
    });
  }

  // ── 핫바 미니 뷰 ──────────────────────────────────────────
  _renderHotbarMini() {
    const save = loadSave();
    const wrap = document.getElementById('inv-hotbar-mini');
    wrap.innerHTML = '';

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = `inv-slot inv-hotbar-slot${this._isSelected('hotbar', i) ? ' inv-selected' : ''}`;
      cell.dataset.source = 'hotbar';
      cell.dataset.idx    = i;
      const entry = save.hotbar?.[i];
      const item  = entry ? allItems().find(it => it.id === entry.id) : null;
      cell.innerHTML = item
        ? `<span class="inv-item-icon">${item.icon}</span>
           <span class="inv-slot-key">${i + 1}</span>`
        : `<span class="inv-slot-key">${i + 1}</span>`;
      cell.title = item ? item.name : `슬롯 ${i + 1}`;
      cell.addEventListener('click', () => this._onSlotClick('hotbar', i));
      wrap.appendChild(cell);
    }
  }

  // ── 슬롯 클릭 핸들러 ───────────────────────────────────────
  _onSlotClick(source, idx, slotId) {
    const sel = this._selected;

    if (!sel) {
      // 첫 번째 클릭: 아이템이 있는 슬롯 선택
      if (this._hasItem(source, idx, slotId)) {
        this._selected = { source, idx, slotId };
        this._refresh();
      }
      return;
    }

    // 같은 슬롯 재클릭 → 선택 해제
    if (sel.source === source && sel.idx === idx) {
      this._selected = null;
      this._refresh();
      return;
    }

    // 두 번째 클릭: 이동 수행
    this._moveItem(sel, { source, idx, slotId });
    this._selected = null;
    this._refresh();
  }

  _hasItem(source, idx, slotId) {
    const save = loadSave();
    if (source === 'inv')    return !!(save.inventoryGrid?.[idx]);
    if (source === 'hotbar') return !!(save.hotbar?.[idx]);
    if (source === 'equip')  {
      // slotId ('head'/'chest'/…) 직접 사용 — 그리드 idx로 EQUIP_SLOTS 조회 시 잘못된 슬롯 참조 방지
      return slotId ? !!(save.equipment?.[slotId]) : false;
    }
    if (source === 'skill')  return !!(save.skillSlots?.[idx]);
    if (source === 'pool')   return true; // 풀 아이템은 항상 있음
    return false;
  }

  _isSelected(source, idx) {
    return this._selected?.source === source && this._selected?.idx === idx;
  }

  // ── 아이템 이동 로직 ──────────────────────────────────────
  _moveItem(from, to) {
    const save = loadSave();

    // 출처에서 아이템 꺼내기
    const entry = this._getEntry(save, from);
    if (!entry) return;

    // 대상에 배치 가능한지 체크
    if (!this._canPlace(entry, to)) return;

    // 출처 비우기
    this._clearEntry(save, from);

    // 대상에 놓기
    this._setEntry(save, to, entry);

    saveSave(save);
  }

  _getEntry(save, loc) {
    const { source, idx, slotId } = loc;
    if (source === 'inv')    return save.inventoryGrid?.[idx] ?? null;
    if (source === 'hotbar') return save.hotbar?.[idx] ?? null;
    if (source === 'equip')  {
      // slotId 직접 사용 — 그리드 idx로 EQUIP_SLOTS 조회 시 잘못된 슬롯 참조 방지
      return slotId ? { id: save.equipment?.[slotId] } : null;
    }
    if (source === 'skill')  return { id: save.skillSlots?.[idx] };
    if (source === 'pool')   return { id: idx }; // pool: idx = itemId
    return null;
  }

  _clearEntry(save, loc) {
    const { source, idx, slotId } = loc;
    if (source === 'inv')    { if (save.inventoryGrid) save.inventoryGrid[idx] = null; }
    if (source === 'hotbar') { if (save.hotbar) save.hotbar[idx] = null; }
    if (source === 'equip')  {
      // slotId 직접 사용 — 그리드 idx로 EQUIP_SLOTS 조회 시 잘못된 슬롯 참조 방지
      if (slotId && save.equipment) save.equipment[slotId] = null;
    }
    if (source === 'skill')  { if (save.skillSlots) save.skillSlots[idx] = null; }
    // pool: 원본 유지 (보유 목록에서 제거하지 않음)
  }

  _setEntry(save, loc, entry) {
    const { source, idx, slotId } = loc;
    const id = entry?.id;
    if (!id) return;

    if (source === 'inv') {
      if (!save.inventoryGrid) save.inventoryGrid = Array(25).fill(null);
      save.inventoryGrid[idx] = { id, count: entry.count ?? 1 };
    }
    if (source === 'hotbar') {
      if (!save.hotbar) save.hotbar = Array(9).fill(null);
      save.hotbar[idx] = { id, count: entry.count ?? 1 };
    }
    if (source === 'equip') {
      // slotId 직접 사용 — 그리드 idx로 EQUIP_SLOTS 조회 시 잘못된 슬롯 참조 방지
      if (slotId && save.equipment) save.equipment[slotId] = id;
    }
    if (source === 'skill') {
      if (!save.skillSlots) save.skillSlots = {};
      save.skillSlots[idx] = id; // idx = 'Q'|'E'|'R'|'S4'|'S5'
    }
  }

  _canPlace(entry, to) {
    const item = allItems().find(i => i.id === entry?.id);
    if (!item) return false;

    // 스킬 슬롯: 스킬 아이템만 허용
    if (to.source === 'skill') {
      return SHOP_ITEMS.skills.some(s => s.id === entry.id);
    }
    // 장착 슬롯: cosmetic/tool 계열만
    if (to.source === 'equip') {
      return item.type != null; // outfit, hat, tool_skin
    }
    // 핫바·인벤토리: 모든 아이템 허용
    return true;
  }

  // ── 캐릭터 프리뷰 (Three.js mini renderer) ─────────────────
  _startPreview() {
    const canvas = document.getElementById('inv-char-canvas');
    if (!canvas) return;

    // 이미 렌더러가 있으면 재사용
    if (!this._previewRenderer) {
      this._previewRenderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
      });
      this._previewRenderer.setPixelRatio(1);
      this._previewRenderer.setSize(canvas.width, canvas.height);
      this._previewRenderer.setClearColor(0x000000, 0);

      this._previewScene = new THREE.Scene();

      // 조명
      this._previewScene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
      sun.position.set(3, 5, 4);
      this._previewScene.add(sun);

      // 카메라 — 3/4 뷰
      this._previewCam = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 50);
      this._previewCam.position.set(2.2, 2.5, 3.5);
      this._previewCam.lookAt(0, 1.2, 0);
    }

    // 플레이어 메시 복제 (게임 씬과 분리)
    if (this.playerMesh && !this._charClone) {
      this._charClone = this.playerMesh.clone();
      this._charClone.position.set(0, 0, 0);
      this._previewScene.add(this._charClone);
    }

    this._previewRunning = true;
    const loop = () => {
      if (!this._previewRunning) return;
      this._previewRAF = requestAnimationFrame(loop);
      // 천천히 회전
      if (this._charClone) this._charClone.rotation.y += 0.008;
      this._previewRenderer.render(this._previewScene, this._previewCam);
    };
    loop();
  }

  _stopPreview() {
    this._previewRunning = false;
    if (this._previewRAF) {
      cancelAnimationFrame(this._previewRAF);
      this._previewRAF = null;
    }
    // 복제본만 씬에서 제거 (게임 원본은 유지)
    if (this._charClone && this._previewScene) {
      this._previewScene.remove(this._charClone);
      this._charClone = null;
    }
  }

  dispose() {
    this._stopPreview();
    this._previewRenderer?.dispose();
  }
}
