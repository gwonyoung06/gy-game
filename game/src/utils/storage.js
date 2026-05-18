const KEY = 'hunters_save';

const defaultSave = {
  coins: 0,
  clearedStages: [],
  highScores: {},
  stageStars: {},   // { [stageId]: 1|2|3 }
  ownedItems: [],
  equippedPet: null,
  equippedOutfit: null,
  equippedHat: null,
  equippedSkin: null,
  activeSkills: [],
  itemLevels: {},
  stats: { totalCaptured: 0, totalCoinsEarned: 0, bestCombo: 0 },
  // ── 인벤토리 / 핫바 / 스킬 슬롯 ─────────────────────────────
  inventoryGrid: Array(25).fill(null),   // 5×5 인벤토리
  hotbar:        Array(9).fill(null),    // 3×3 핫바 (1~9)
  skillSlots: { Q: null, E: null, R: null, S4: null, S5: null },
  equipment:  { head: null, chest: null, legs: null,
                boots: null, weapon: null, acc1: null, acc2: null },
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultSave };
    return { ...defaultSave, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSave };
  }
}

export function saveSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function updateSave(partial) {
  const current = loadSave();
  const updated = { ...current, ...partial };
  saveSave(updated);
  return updated;
}

export function addCoins(amount) {
  const save = loadSave();
  save.coins = (save.coins || 0) + amount;
  save.stats.totalCoinsEarned = (save.stats.totalCoinsEarned || 0) + amount;
  saveSave(save);
  return save.coins;
}

export function spendCoins(amount) {
  const save = loadSave();
  if (save.coins < amount) return false;
  save.coins -= amount;
  saveSave(save);
  return true;
}

export function markStageCleared(stageId, score, stars = 1) {
  const save = loadSave();
  if (!save.clearedStages.includes(stageId)) {
    save.clearedStages.push(stageId);
  }
  const prev = save.highScores[stageId] || 0;
  if (score > prev) save.highScores[stageId] = score;
  // 별 점수 최고 기록만 저장
  if (!save.stageStars) save.stageStars = {};
  const prevStars = save.stageStars[stageId] || 0;
  if (stars > prevStars) save.stageStars[stageId] = stars;
  saveSave(save);
}

export function buyItem(itemId, price, level = 1) {
  const save = loadSave();
  if (save.coins < price) return false;
  save.coins -= price;
  if (!save.ownedItems.includes(itemId)) save.ownedItems.push(itemId);
  save.itemLevels[itemId] = level;
  saveSave(save);
  return true;
}

export function getPersonalRecords() {
  const save = loadSave();
  return Object.entries(save.highScores)
    .map(([stage, score]) => ({ stage: parseInt(stage), score }))
    .sort((a, b) => b.score - a.score);
}
