export const SHOP_ITEMS = {
  tools: [
    { id: 'net_plus',    name: '채망 확장 Lv1', icon: '🥅', desc: '포획 범위 +20%',          price: 200,   effect: { captureRange: 1.2 }, maxLevel: 3, levelPrices: [200, 500, 1200] },
    { id: 'swing_speed', name: '스윙 속도 Lv1', icon: '💨', desc: '휘두르기 속도 +15%',       price: 300,   effect: { swingSpeed: 1.15 }, maxLevel: 3, levelPrices: [300, 700, 1500] },
    { id: 'trap',        name: '통발',          icon: '🪤', desc: '자동 포획 트랩 설치 가능', price: 800,   effect: { trapUnlock: true }, unlockStage: 4 },
    { id: 'rod',         name: '낚싯대 강화',   icon: '🎣', desc: '수중 생물 포획 범위 2배',  price: 1500,  effect: { waterRange: 2.0 }, unlockStage: 6 },
    { id: 'tranq_dart',  name: '마취 다트 x5',  icon: '💉', desc: '빠른 생물 순간 정지',      price: 2000,  effect: { tranqCharges: 5 }, unlockStage: 9, consumable: true },
    { id: 'dino_lasso',  name: '공룡 올가미',   icon: '🪢', desc: '대형 생물 포획 가능',      price: 8000,  effect: { dinoCapture: true }, unlockStage: 12 },
    { id: 'em_catcher',  name: '전자기 포획기', icon: '⚡', desc: 'UFO 포획 전용 장비',       price: 25000, effect: { ufoCapture: true }, unlockStage: 14 },
  ],
  abilities: [
    { id: 'move_speed',   name: '이동속도',   icon: '🏃', desc: '이동 속도 +10%',       price: 300,  maxLevel: 5, levelPrices: [300, 600, 1200, 2400, 4800], effect: { moveSpeed: 1.1 } },
    { id: 'jump_power',   name: '점프력',     icon: '⬆️', desc: '점프 높이 +15%',       price: 400,  maxLevel: 5, levelPrices: [400, 800, 1600, 3200, 6400], effect: { jumpPower: 1.15 } },
    { id: 'view_range',   name: '시야 범위',  icon: '👁️', desc: '시야 범위 +20%',       price: 500,  maxLevel: 5, levelPrices: [500, 1000, 2000, 4000, 8000], effect: { viewRange: 1.2 } },
    { id: 'noise_reduce', name: '소음 감소',  icon: '🔇', desc: '생물 도주율 -10%',     price: 600,  maxLevel: 5, levelPrices: [600, 1200, 2400, 4800, 9600], effect: { noiseReduce: 0.9 } },
  ],
  cosmetic: [
    { id: 'outfit_explorer',  name: '탐험가복',    icon: '🧥', desc: '고전 탐험가 스타일', price: 1000,  type: 'outfit', color: 0xcc8833 },
    { id: 'outfit_diver',     name: '잠수복',      icon: '🤿', desc: '바다 탐험가',        price: 2000,  type: 'outfit', color: 0x2255cc, unlockStage: 7 },
    { id: 'outfit_space',     name: '우주복',      icon: '👨‍🚀', desc: '우주 탐험가',        price: 5000,  type: 'outfit', color: 0xffffff, unlockStage: 14 },
    { id: 'hat_straw',        name: '밀짚모자',    icon: '👒', desc: '여름 감성',          price: 500,   type: 'hat' },
    { id: 'hat_helmet',       name: '헬멧',        icon: '⛑️', desc: '안전 제일',          price: 1500,  type: 'hat', unlockStage: 10 },
    { id: 'hat_dino',         name: '공룡 모자',   icon: '🦕', desc: '공룡 팬',            price: 3000,  type: 'hat', unlockStage: 13 },
    { id: 'hat_space',        name: '우주 헬멧',   icon: '🪐', desc: '우주인',             price: 8000,  type: 'hat', unlockStage: 14 },
    { id: 'skin_golden_net',  name: '황금 채망',   icon: '✨', desc: '반짝이는 황금빛',    price: 2000,  type: 'tool_skin' },
    { id: 'skin_rainbow_net', name: '무지개 그물', icon: '🌈', desc: '화려한 무지개',      price: 5000,  type: 'tool_skin', unlockStage: 7 },
    { id: 'skin_laser',       name: '레이저 포획기',icon: '🔫', desc: '미래 기술',         price: 8000,  type: 'tool_skin', unlockStage: 12 },
  ],
  pets: [
    { id: 'pet_dog',    name: '강아지', icon: '🐕', desc: '생물 위치 레이더 표시',   price: 2000,  effect: { radar: true } },
    { id: 'pet_eagle',  name: '매',     icon: '🦅', desc: '하늘 생물 자동 포획',     price: 3000,  effect: { autoAir: true }, unlockStage: 6 },
    { id: 'pet_cat',    name: '고양이', icon: '🐱', desc: '소형 생물 자동 포획',     price: 2500,  effect: { autoSmall: true } },
    { id: 'pet_dino',   name: '아기 공룡', icon: '🦕', desc: '공룡 탐지 & 도주율 감소', price: 10000, effect: { dinoDetect: true }, unlockStage: 12 },
    { id: 'pet_ufo',    name: '미니 UFO', icon: '🛸', desc: '보스 약점 표시',        price: 20000, effect: { bossWeakspot: true }, unlockStage: 14 },
  ],
  skills: [
    { id: 'skill_slow',   name: '슬로우 타임', icon: '⏱️', desc: '5초간 모든 생물 50% 느려짐', price: 1500, cooldown: 30, effect: { slowAll: { duration: 5, factor: 0.5 } } },
    { id: 'skill_magnet', name: '자석',        icon: '🧲', desc: '반경 10m 생물 즉시 포획',     price: 2000, cooldown: 45, effect: { magnetCapture: { radius: 10 } }, unlockStage: 4 },
    { id: 'skill_multi',  name: '분신 채망',   icon: '👐', desc: '채망 3개 동시 사용 5초',       price: 2500, cooldown: 40, effect: { multiNet: { count: 3, duration: 5 } }, unlockStage: 6 },
    { id: 'skill_vortex', name: '회오리',      icon: '🌀', desc: '전방 범위 내 모든 생물 포획',  price: 5000, cooldown: 60, effect: { vortex: { range: 15 } }, unlockStage: 10 },
  ],
};

export const CONSUMABLES = [
  { id: 'time_extend', name: '시간 연장 +30초', icon: '⏰', desc: '스테이지당 1회',            price: 500,  consumable: true },
  { id: 'bait',        name: '미끼',            icon: '🍖', desc: '생물이 5초간 플레이어로 유인', price: 300,  consumable: true },
  { id: 'radar_use',   name: '레이더',          icon: '📡', desc: '생물 위치 15초 표시',        price: 400,  consumable: true },
  { id: 'super_bait',  name: '슈퍼 미끼',       icon: '💫', desc: '모든 생물 8초간 강제 유인',  price: 1000, consumable: true },
];
