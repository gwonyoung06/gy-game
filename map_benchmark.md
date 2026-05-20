# HUNTERS — Map Benchmark & Object Inventory

> Generated: 2026-05-20  
> World.js 현재 상태 기준 오브젝트 목록 + 레퍼런스 게임 벤치마크

---

## 레퍼런스 게임 벤치마크

| 바이옴 | 참고 게임 | 핵심 시각 요소 | 적용 포인트 |
|---|---|---|---|
| 공원 | Animal Crossing, Stardew Valley | 아기자기한 소품, 경로 타일, 계절감 | 벤치·분수·가로등 클러스터, 꽃밭 |
| 연못/강 | Spiritfarer, Stardew Valley | 수면 반짝임, 수련, 물가 갈대 | 연못 CircleGeometry, 수련·갈대 InstancedMesh |
| 해양/바닷가 | Subnautica, ABZÛ | 산호초, 해조류, 침선, 절벽 | 산호·조개·방파제·조류 InstancedMesh |
| 열대우림 | Monster Hunter World | 거대 나무 캐노피, 덩굴, 폭포, 신전 | 야자+오크 혼합, GiantFerns, VineBridges |
| 사바나 | ARK: Survival Evolved | 아카시아 실루엣, 물웅덩이, 흰개미탑 | HeroAcacia, WaterHole, TermiteMounds |
| 설산 | Firewatch, The Long Dark | 빙하 계곡, 침엽수, 산장, 고드름 | HeroGlacialPeak (**신규**), FrozenLake (**신규**) |
| 밀림/숲 | Monster Hunter World | 고대거목, 이끼바위, 버섯, 트리하우스 | AncientPine, MushroomRings, TreeHouses |
| 화산 | Monster Hunter World (화산지대) | 용암강, 현무암기둥, 화산재, 유황 | **전용 빌더 신규 구현** |
| 공룡섬 | ARK: Survival Evolved | 화산+공룡+선사유적+타르 | DinoFootprints, Fossils, PrehistoricTemple |
| 우주/달 | No Man's Sky | 크레이터, 행성, 우주정거장, 운석 | Craters, Planets, SpaceStation |

---

## 스테이지별 오브젝트 인벤토리

### Stage 1–3: 공원 (Park)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 분수 (영웅 랜드마크) | Group + 절차적 Geometry | 1개 |
| 참나무 (링 + 포아송) | InstancedMesh × 3레이어 | 18+160개 |
| 꽃 12종 | InstancedMesh × 2레이어/종 | 종당 14–30개 |
| 바위 클러스터 | InstancedMesh DodecahedronGeo | 28클러스터 |
| 벤치 | Group 상세 모델 | 20개 |
| 가로등 | Group | 22개 |
| 산책로 | PlaneGeometry 경로 | 1세트 |
| 가제보 | Group | 4개 |
| 공원 게이트 | Group | 1개 |
| 놀이터 | Group | 1개 |
| 피크닉 테이블 | Group | 15개 |
| 쓰레기통 | Group | 20개 |
| 산울타리 | Group | 12개 |
| 꽃밭 | Group | 10개 |
| 밴드스탠드 | Group | 1개 |
| 조각상 | Group | 6개 |
| 카페 노점 | Group | 3개 |
| 표지판 | Group | 14개 |
| 공원 담장 | Group | 8개 |
| 풍선 묶음 | Group | 8개 |
| 아이스크림 카트 | Group | 4개 |
| 시계탑 | Group | 1개 |
| 그네 세트 | Group | 5개 |
| 컬러풀 키오스크 | Group | 6개 |
| 강아지 물그릇 | Group | 10개 |
| 자전거 | Group | 8개 |
| 원경 실루엣 | InstancedMesh | 10개 |
| 꽃가루 파티클 | InstancedMesh (대기) | 280개 |
| 포인트 조명 | PointLight | 8개 |

**총 오브젝트 타입: 29종**

---

### Stage 4–5: 연못 (Pond)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 참나무 (연못 가장자리) | InstancedMesh | ~140개 |
| 꽃 12종 | InstancedMesh | 12종 |
| 바위 클러스터 | InstancedMesh | 30클러스터 |
| 벤치 | Group | 12개 |
| 가로등 | Group | 10개 |
| 분수 | Group | 1개 |
| 산책로 | PlaneGeometry | 1세트 |
| 낚시 오두막 | Group | 6개 |
| 폭포 | Group | 4개 |
| 징검다리 | InstancedMesh | 5세트 |
| 보트 하우스 | Group | 3개 |
| 갈대 밭 | InstancedMesh | 15개 |
| 물레방아 | Group | 1개 |
| 오리 표지판 | Group | 8개 |
| 피크닉 테이블 | Group | 10개 |
| 랜턴 | Group | 16개 |
| 연못 × 4 | CircleGeometry | 4개 |
| 수련 | InstancedMesh | 각 연못별 |
| 갈대 (연못 주변) | InstancedMesh | 각 연못 10개 |
| 나무 다리 | Group | 1개 |

**총 오브젝트 타입: 20종**

---

### Stage 6: 강가 (River)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 강 세그먼트 | PlaneGeometry × 17 | 17개 |
| 강둑 나무 (양쪽) | InstancedMesh | ~160개 |
| 바위 클러스터 | InstancedMesh | 40클러스터 |
| 꽃 12종 | InstancedMesh | 12종 |
| 갈대 밭 | InstancedMesh | 20개 |
| 낚시 오두막 | Group | 8개 |
| 폭포 | Group | 3개 |
| 징검다리 | InstancedMesh | 8세트 |
| 나무 다리 | Group | 1개 |
| 통나무 (표류목) | InstancedMesh | 20개 |
| 랜턴 | Group | 12개 |
| 피크닉 테이블 | Group | 10개 |
| 모래톱 | CircleGeometry | 8개 |
| 대기 파티클 | InstancedMesh | 150개 |

**총 오브젝트 타입: 14종**

---

### Stage 7: 바닷가 (Beach)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 바다 면 | PlaneGeometry | 1개 |
| 파도 선 × 5 | PlaneGeometry | 5개 |
| 등대 (영웅 랜드마크) | Group 상세 | 1개 |
| 바위 클러스터 | InstancedMesh | 50클러스터 |
| 산호 | InstancedMesh | 50개 |
| 조개 | InstancedMesh | 80개 |
| 절벽 | Group | 다수 |
| 해변 오두막 | Group | 10개 |
| 구명 부표 | Group | 14개 |
| 선착장 | Group | 4개 |
| 표류목 | InstancedMesh | 30개 |
| 조수 웅덩이 | CircleGeometry | 12개 |
| 해식 기둥 | Group | 8개 |
| 닻 | Group | 6개 |
| 야자나무 | InstancedMesh | ~80개 |
| 대기 파티클 | InstancedMesh | 120개 |

**총 오브젝트 타입: 16종**

---

### Stage 8: 깊은 바다 (Deep Ocean)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 바다 면 | PlaneGeometry | 1개 |
| 등대 (영웅 랜드마크) | Group | 1개 |
| 바위 클러스터 | InstancedMesh | 80클러스터 |
| 산호 | InstancedMesh | 80개 |
| 조개 | InstancedMesh | 60개 |
| 절벽 | Group | 다수 |
| 침선 × 4 | Group | 4개 |
| 해조류 숲 | InstancedMesh | 40개 |
| 닻 | Group | 8개 |
| 해변 오두막 | Group | 8개 |
| 구명 부표 | Group | 12개 |
| 선착장 | Group | 3개 |
| 표류목 | InstancedMesh | 25개 |
| 조수 웅덩이 | CircleGeometry | 10개 |
| 해식 기둥 | Group | 12개 |

**총 오브젝트 타입: 15종**

---

### Stage 9: 열대우림 (Jungle)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 정글 강 세그먼트 | PlaneGeometry × 13 | 13개 |
| 정글 나무 (오크) | InstancedMesh | ~250개 |
| 야자나무 | InstancedMesh | ~50개 |
| 바위 클러스터 | InstancedMesh | 60클러스터 |
| 버섯 | InstancedMesh | 50개 |
| 쓰러진 통나무 | InstancedMesh | 30개 |
| 이끼 바위 | InstancedMesh | 45개 |
| 꽃 12종 (정글 색상) | InstancedMesh | 12종 |
| 거대 양치식물 | InstancedMesh | 60개 |
| 숲 사당 | Group | 3개 |
| 덩굴 다리 | Group | 4개 |
| 모닥불 | Group | 6개 |
| 매달린 랜턴 | Group | 18개 |
| 갈대 밭 | InstancedMesh | 12개 |
| 갈대 (강변) | InstancedMesh | 15개 |
| 폭포 | Group | 5개 |
| 대기 파티클 (초록 포자) | InstancedMesh | 350개 |

**총 오브젝트 타입: 17종**

---

### Stage 10: 사바나 (Savanna)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 사바나 지면 패치 | PlaneGeometry | 1개 |
| 아카시아 (영웅, 고정) | Group | 1개 |
| 물웅덩이 | Group | 1개 |
| 아카시아 나무 | InstancedMesh × 2 | ~100개 |
| 바위 클러스터 | InstancedMesh | 60클러스터 |
| 흰개미 탑 | InstancedMesh | 25개 |
| 건초 (마른 풀) | InstancedMesh | 500개 |
| 아프리카 오두막 | Group | 8개 |
| 바오밥 나무 | Group | 12개 |
| 동물 두개골 | InstancedMesh | 20개 |
| 사파리 지프 잔해 | Group | 3개 |
| 암각화 바위 | Group | 10개 |
| 크랄 펜스 | Group | 4개 |
| 먼지 회오리 | InstancedMesh | 6개 |
| 사바나 풀 | InstancedMesh | 200개 |

**총 오브젝트 타입: 15종**

---

### Stage 11: 설산 (Snow Mountain) — 강화됨 ✨
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| **빙하 봉우리 (영웅 랜드마크)** ✨ | Group | 1개 |
| 빙하 계곡 세그먼트 | PlaneGeometry × 9 | 9개 |
| **빙판 호수** ✨ | CircleGeometry + 균열 | 1개 |
| 침엽수 (저지대 필터) | InstancedMesh × 4레이어 | ~90개 |
| 바위 클러스터 | InstancedMesh | 70클러스터 |
| 이끼 바위 | InstancedMesh | 40개 |
| 쓰러진 통나무 | InstancedMesh | 25개 |
| 눈 덮인 바위 | InstancedMesh × 2레이어 | 50개 |
| **얼어붙은 폭포** ✨ | Group | 5개 |
| **고드름 클러스터** ✨ | InstancedMesh | 35×5개 |
| **눈더미** ✨ | InstancedMesh | 60개 |
| **산장** ✨ | Group | 3개 |
| **빙하 침식 구조물** ✨ | InstancedMesh × 3색 | 28개 |
| **작은 얼음 웅덩이** ✨ | CircleGeometry | 6개 |
| 아이스 크리스탈 | InstancedMesh ConeGeo | 30개 |
| 눈 파티클 | InstancedMesh | 동적 |
| 대기 파티클 (눈가루) | InstancedMesh | 200개 |

**총 오브젝트 타입: 17종 (기존 6종 → 3배 확대)**

---

### Stage 12: 밀림 (Dense Forest)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 고대 거목 (영웅 랜드마크) | Group | 1개 |
| 소나무 클러스터 | InstancedMesh × 4레이어 | ~256개 |
| 바위 클러스터 | InstancedMesh | 80클러스터 |
| 버섯 | InstancedMesh | 65개 |
| 쓰러진 통나무 | InstancedMesh | 35개 |
| 이끼 바위 | InstancedMesh | 50개 |
| 꽃 12종 (어두운 색상) | InstancedMesh | 12종 |
| 통나무 오두막 | Group | 1개 |
| 숲 사당 | Group | 3개 |
| 나무 위 집 | Group | 4개 |
| 덩굴 다리 | Group | 3개 |
| 폐우물 | Group | 4개 |
| 모닥불 | Group | 8개 |
| 버섯 링 | Group | 6개 |
| 나무 구멍 | Group | 12개 |
| 숲 표지판 | Group | 10개 |
| 매달린 랜턴 | Group | 20개 |
| 대기 파티클 (반딧불/포자) | InstancedMesh | 300개 |

**총 오브젝트 타입: 18종**

---

### Stage 13: 화산 (Volcano) — 신규 전용 빌더 ✨
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| **대형 화산 (영웅 랜드마크)** ✨ | Group (3단 콘+용암) | 1개 |
| **소형 화산구** ✨ | Group | 5개 |
| **용암 강줄기** ✨ | PlaneGeometry × 39 | 3강×13세그 |
| 용암 웅덩이 | CircleGeometry | 14개 |
| 타르 웅덩이 | CircleGeometry | 8개 |
| 동굴 입구 | Group | 6개 |
| 스톤 서클 | Group | 4개 |
| **화산암 (3색)** ✨ | InstancedMesh × 3 | 120개 |
| **화산재 패치** ✨ | CircleGeometry | 30개 |
| **탄화 나무** ✨ | InstancedMesh | 40개 |
| **현무암 기둥** ✨ | InstancedMesh | 10×5개 |
| **화산 가스 분출구** ✨ | Torus + Cone | 12개 |
| **유황 크리스탈** ✨ | InstancedMesh | 25×4개 |
| **지면 균열** ✨ | PlaneGeometry | 16개 |
| 화산 붉은 포인트 조명 | PointLight | 1개 |
| 대기 파티클 (불씨) | InstancedMesh | 320개 |
| 대기 파티클 (연기) | InstancedMesh | 180개 |

**총 오브젝트 타입: 17종 (기존: DinoIsland 공유 → 완전 독립)**

---

### Stage 14: 공룡섬 (Dino Island)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 야자나무 | InstancedMesh | ~65개 |
| 화산 × 3 (랜드마크) | Group | 3개 |
| 바위 클러스터 | InstancedMesh | 100클러스터 |
| 공룡 발자국 | InstancedMesh | 60개 |
| 화석 | Group | 25개 |
| 거대 양치식물 | InstancedMesh | 55개 |
| 공룡 뼈 | Group | 30개 |
| 공룡 알 둥지 | Group | 15개 |
| 선사 신전 | Group | 1개 |
| 용암 웅덩이 | CircleGeometry | 8개 |
| 동굴 입구 | Group | 5개 |
| 타르 웅덩이 | CircleGeometry | 6개 |
| 스톤 서클 | Group | 4개 |
| 선사 나무 | Group | 30개 |
| 공룡 뼈대 | Group | 5개 |
| 용암 글로우 조명 | PointLight | 1개 |
| 대기 파티클 (불씨) | InstancedMesh | 240개 |

**총 오브젝트 타입: 17종**

---

### Stage 15: 우주 (Space)
| 오브젝트 | 구현 방식 | 개수 |
|---|---|---|
| 배경 (검정) | scene.background | 1개 |
| 별 필드 (3레이어) | Points | 3×1580개 |
| 행성 | Group | 다수 |
| 크레이터 | CylinderGeometry 패임 | 35개 |
| 외계 구조물 | Group | 14개 |
| 우주 잔해물 | InstancedMesh | 40개 |
| 우주 정거장 | Group | 1개 |
| 추락한 우주선 | Group | 3개 |
| 달 로버 | Group | 2개 |
| 위성 안테나 | Group | 8개 |
| 외계 미스터리 서클 | CircleGeometry | 6개 |
| 우주 크레이트 | InstancedMesh | 20개 |
| 통신 탑 | Group | 4개 |
| 운석 군집 | InstancedMesh | 15개 |
| 성운 구름 | InstancedMesh | 8개 |
| 포인트 조명 | PointLight | 1개 |

**총 오브젝트 타입: 16종**

---

## 기술 구현 요약

### 배치 알고리즘
| 알고리즘 | 함수 | 사용 바이옴 |
|---|---|---|
| 포아송 디스크 | `poissonSpawn()` | 공원 외곽, 설산 나무 |
| 클러스터 | `clusterSpawn()` | 정글, 사바나, 밀림 |
| 링 배치 | `ringSpawn()` | 공원 분수 주변 나무 |
| 고정 좌표 | 직접 지정 | 영웅 랜드마크들 |

### 지형 생성
- **매크로**: 스테이지별 sin/cos 합성 (각 바이옴 특유 지형 형태)
- **디테일**: `fbm2D()` (3옥타브 fractal Brownian motion) — 2026-05-20 추가
- **스폰 중심 평탄**: `fade` 계수 (반경 18m 완전 평탄, 34m까지 보간)

### 성능 최적화
- 나무, 꽃, 바위, 화산암, 눈더미 등 반복 오브젝트 → `InstancedMesh`
- 소품류 (벤치, 오두막, 랜드마크) → `Group` 상세 모델
- `TERRAIN_SCALE[]` 배열로 스테이지별 지형 강도 독립 제어

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-05-20 | `fbm2D()` 지형 노이즈 추가 (3옥타브 fBm) |
| 2026-05-20 | Stage 13 전용 `_buildVolcano()` 빌더 분리 (기존 DinoIsland 공유 해소) |
| 2026-05-20 | `_buildSnowMtn()` 강화: 빙하봉우리·빙판호수·고드름·눈더미·산장·얼음구조물·얼음웅덩이 추가 |
