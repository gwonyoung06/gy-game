/**
 * ModelRegistry — GLB 파일 경로 + 스케일/오프셋 설정 중앙 관리
 *
 * MeshyAI에서 만든 GLB 파일을
 * game/public/models/ 아래에 넣고
 * 아래 테이블에 경로와 스케일을 설정하면
 * World.js / Creature.js 가 자동으로 적용합니다.
 *
 * ─── GLB 파일 배치 위치 ───────────────────────────────────────────
 * game/public/models/
 *   landmarks/
 *     fountain.glb        ← 공원 분수
 *     lighthouse.glb      ← 등대
 *     volcano_hero.glb    ← 중앙 대형 화산
 *     acacia_hero.glb     ← 사바나 영웅 아카시아
 *     ancient_pine.glb    ← 밀림 고대 거목
 *     glacial_peak.glb    ← 설산 빙하봉우리
 *     water_hole.glb      ← 사바나 물웅덩이
 *     space_station.glb   ← 우주정거장
 *   props/
 *     tree_oak.glb        ← 참나무
 *     tree_pine.glb       ← 소나무
 *     tree_palm.glb       ← 야자나무
 *     tree_acacia.glb     ← 아카시아
 *     rock.glb            ← 바위
 *     bench.glb           ← 벤치
 *     lamp_post.glb       ← 가로등
 *     mushroom.glb        ← 버섯
 *     fallen_log.glb      ← 쓰러진 나무
 *     cactus.glb          ← 선인장
 *   creatures/
 *     dragonfly.glb       ← 잠자리
 *     butterfly.glb       ← 나비
 *     frog.glb            ← 개구리
 *     crab.glb            ← 게
 *     shark.glb           ← 상어
 *     zebra.glb           ← 얼룩말
 *     t_rex.glb           ← 티라노사우루스
 *   player/
 *     hunter.glb          ← 플레이어 캐릭터
 */

// ── 랜드마크 ──────────────────────────────────────────────────────
export const LANDMARK_MODELS = {
  fountain:      { url: 'models/landmarks/fountain.glb',     scale: 1.0,  yOffset: 0 },
  lighthouse:    { url: 'models/landmarks/lighthouse.glb',   scale: 1.0,  yOffset: 0 },
  volcano_hero:  { url: 'models/landmarks/volcano_hero.glb', scale: 1.0,  yOffset: 0 },
  acacia_hero:   { url: 'models/landmarks/acacia_hero.glb',  scale: 1.0,  yOffset: 0 },
  ancient_pine:  { url: 'models/landmarks/ancient_pine.glb', scale: 1.0,  yOffset: 0 },
  glacial_peak:  { url: 'models/landmarks/glacial_peak.glb', scale: 1.0,  yOffset: 0 },
  water_hole:    { url: 'models/landmarks/water_hole.glb',   scale: 1.0,  yOffset: 0 },
  space_station: { url: 'models/landmarks/space_station.glb',scale: 1.0,  yOffset: 0 },
};

// ── 맵 소품 ───────────────────────────────────────────────────────
export const PROP_MODELS = {
  tree_oak:    { url: 'models/props/tree_oak.glb',    scale: 1.0, yOffset: 0 },
  tree_pine:   { url: 'models/props/tree_pine.glb',   scale: 1.0, yOffset: 0 },
  tree_palm:   { url: 'models/props/tree_palm.glb',   scale: 1.0, yOffset: 0 },
  tree_acacia: { url: 'models/props/tree_acacia.glb', scale: 1.0, yOffset: 0 },
  rock:        { url: 'models/props/rock.glb',        scale: 1.0, yOffset: 0 },
  bench:       { url: 'models/props/bench.glb',       scale: 1.0, yOffset: 0 },
  lamp_post:   { url: 'models/props/lamp_post.glb',   scale: 1.0, yOffset: 0 },
  mushroom:    { url: 'models/props/mushroom.glb',    scale: 1.0, yOffset: 0 },
  fallen_log:  { url: 'models/props/fallen_log.glb',  scale: 1.0, yOffset: 0 },
};

// ── 생물 ──────────────────────────────────────────────────────────
export const CREATURE_MODELS = {
  dragonfly:  { url: 'models/creatures/dragonfly.glb',  scale: 0.5,  yOffset: 0.3 },
  butterfly:  { url: 'models/creatures/butterfly.glb',  scale: 0.4,  yOffset: 0.3 },
  frog:       { url: 'models/creatures/frog.glb',       scale: 0.6,  yOffset: 0   },
  crab:       { url: 'models/creatures/crab.glb',       scale: 0.7,  yOffset: 0   },
  shark:      { url: 'models/creatures/shark.glb',      scale: 2.0,  yOffset: 0.5 },
  zebra:      { url: 'models/creatures/zebra.glb',      scale: 1.2,  yOffset: 0   },
  t_rex:      { url: 'models/creatures/t_rex.glb',      scale: 3.0,  yOffset: 0   },
  raptor:     { url: 'models/creatures/raptor.glb',     scale: 1.5,  yOffset: 0   },
};

// ── 플레이어 ──────────────────────────────────────────────────────
export const PLAYER_MODEL = {
  url: 'models/player/hunter.glb',
  scale: 1.0,
  yOffset: 0,
};
