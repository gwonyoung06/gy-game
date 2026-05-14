import { SHOP_ITEMS, CONSUMABLES } from '../data/shop.js';
import { loadSave, buyItem, spendCoins } from '../utils/storage.js';

export class Shop {
  constructor(onClose) {
    this.onClose = onClose;
    this.screen = document.getElementById('screen-shop');
    this.coinsEl = document.getElementById('shop-coins');
    this.content = document.getElementById('shop-content');
    this.activeTab = 'tools';

    document.getElementById('btn-back-from-shop').addEventListener('click', () => this.close());

    document.querySelectorAll('#screen-shop .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#screen-shop .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderTab();
      });
    });
  }

  open(currentStageId = 1) {
    this.currentStageId = currentStageId;
    this.screen.classList.remove('hidden');
    this.activeTab = 'tools';
    document.querySelectorAll('#screen-shop .tab-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    this.renderTab();
  }

  close() {
    this.screen.classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  renderTab() {
    const save = loadSave();
    this.coinsEl.textContent = save.coins;
    const items = SHOP_ITEMS[this.activeTab] || [];
    this.content.innerHTML = '';

    // 소모품도 도구 탭에 추가
    const allItems = this.activeTab === 'tools'
      ? [...items, ...CONSUMABLES]
      : items;

    allItems.forEach(item => {
      const unlocked = !item.unlockStage || (this.currentStageId >= item.unlockStage);
      if (!unlocked) return;

      const owned = save.ownedItems.includes(item.id);
      const level = save.itemLevels[item.id] || 0;
      const maxLevel = item.maxLevel || 1;
      const atMax = owned && level >= maxLevel;
      const price = item.levelPrices ? (item.levelPrices[level] || item.price) : item.price;
      const canAfford = save.coins >= price;

      const card = document.createElement('div');
      card.className = `shop-item${atMax ? ' owned' : ''}${!canAfford && !atMax ? ' cant-afford' : ''}`;

      const levelStr = item.maxLevel > 1
        ? `<div class="shop-item-level">레벨 ${level} / ${maxLevel}</div>`
        : '';

      const btnLabel = atMax ? '✅ 보유 중' : owned && item.maxLevel > 1
        ? `업그레이드 💰${price.toLocaleString()}`
        : `구매 💰${price.toLocaleString()}`;

      card.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
        ${levelStr}
        <div class="shop-item-price">${atMax ? '완료' : '💰 ' + price.toLocaleString()}</div>
        <button class="shop-buy-btn${atMax ? ' owned-btn' : ''}" ${atMax ? 'disabled' : ''} ${!canAfford && !atMax ? 'disabled' : ''}>
          ${btnLabel}
        </button>
      `;

      if (!atMax) {
        card.querySelector('.shop-buy-btn').addEventListener('click', () => {
          this._purchase(item, price, level + 1);
        });
      }

      this.content.appendChild(card);
    });

    if (this.content.children.length === 0) {
      this.content.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.4)">이 탭의 아이템을 모두 구매했습니다! 🎉</div>';
    }
  }

  _purchase(item, price, newLevel) {
    const success = buyItem(item.id, price, newLevel);
    if (success) {
      this._showToast(`✅ ${item.icon} ${item.name} 구매!`);
      this.renderTab();
    } else {
      this._showToast('💰 코인이 부족합니다!');
    }
  }

  _showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.9);color:#fff;padding:10px 24px;
      border-radius:20px;font-size:14px;font-weight:700;z-index:200;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }
}
