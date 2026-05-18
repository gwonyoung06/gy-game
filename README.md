# 🎯 HUNTERS

3D 생물 포획 액션 게임. **Three.js + Vite + Supabase** 스택으로 구축된 해커톤 제출작입니다.

> 여름 공원의 잠자리부터 우주 외계 생물까지 — 15개 스테이지를 가로지르며 생물을 포획하고, 코인을 모아 도구·스킬을 업그레이드하세요.

---

## 🌐 배포 / 링크

| 항목 | URL |
|------|-----|
| 🎮 플레이 | https://hunters-gmae.vercel.app |
| 💻 저장소 | https://github.com/gwonyoung06/gy-game |
| 📺 데모 영상 | _(YouTube 링크 — 영상 업로드 후 추가)_ |

---

## 📸 스크린샷

| 타이틀 | 스테이지 선택 | 게임플레이 | 클리어 |
|-------|--------------|-----------|--------|
| ![title](title-screen.png) | ![stage](stage-select.png) | ![game](gameplay.png) | ![clear](after-clear.png) |

---

## ✨ 주요 기능

### 🎮 게임플레이
- **15개 스테이지** — 여름 공원 → 꽃밭 → 연못 → 바닷가 → 사바나 → 화산지대 → 공룡 섬 → 우주
- **70+ 종 생물** — 곤충, 어류, 양서류, 포유류, 공룡, 외계 생물까지
- **웨이브 시스템** — 스테이지별 정해진 시간 안에 목표 마리수 포획
- **콤보 시스템** — 연속 포획 시 점수 배율 (3x / 5x / 10x 콤보)
- **미니보스** — 특정 스테이지에 등장하는 거대 생물 (👑)

### 🛒 상점 & 성장
- **도구**: 채망 확장, 스윙 속도, 통발, 낚싯대, 마취 다트, 올가미, 전자기 포획기
- **능력**: 이동속도, 점프력, 시야, 소음 감소 (각 5레벨)
- **스킬 슬롯 (Q/E/R)**: 슬로우 타임, 자석, 분신 채망, 회오리
- **펫**: 강아지(레이더), 매(공중 자동 포획), 고양이(소형 자동), 아기 공룡, UFO
- **코스튬**: 탐험가복·잠수복·우주복 / 모자 / 채망 스킨

### 🎨 비주얼·UX
- 절차적 Three.js 지오메트리 (모델 파일 없음)
- 동적 환경(낮/밤/비/안개), 바이옴 파티클, 발자국·캡처 파티클
- 콤보 버스트, 슬로우모션, FOV 킥, HP 비네팅, 별점 컨페티
- 미니맵·나침반, 위험 화살표, 스마트 크로스헤어, 포획 범위 링
- 보스 경고, PB 트래커, 스트릭 어나운서, 스테이지 진행바
- 3D 카드 틸트, NEW 뱃지, 캡처 피드

### 🔊 사운드
- **Web Audio API 절차적 합성** — 외부 파일 0개, 완전한 sfx/bgm을 코드로 생성

### 🌐 백엔드
- **Supabase** 글로벌 리더보드 (상위 50명, 닉네임/점수/스테이지)
- 환경변수 미설정 시 null 가드 — 게임은 정상 동작, 리더보드만 비활성화

---

## 🕹️ 조작법

| 키 | 동작 |
|----|------|
| `W A S D` | 이동 |
| `Space` | 점프 |
| `Shift` | 달리기 |
| `마우스 이동` | 시점 조작 |
| `좌클릭` | 채망 휘두르기 (포획) |
| `Q / E / R` | 스킬 슬롯 1/2/3 |
| `1 ~ 9` | 소비 아이템 핫바 |
| `ESC` | 포인터락 해제 / 메뉴 |

---

## 🚀 로컬 실행

```bash
# 1. 클론
git clone https://github.com/gwonyoung06/gy-game.git
cd gy-game/game

# 2. 의존성 설치
npm install

# 3. (선택) 리더보드 사용 — game/.env.local 생성
# VITE_SUPABASE_URL=https://[ref].supabase.co
# VITE_SUPABASE_KEY=eyJ...anon-key

# 4. 개발 서버
npm run dev

# 5. 프로덕션 빌드
npm run build
```

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| 렌더링 | Three.js r184 (WebGL, 절차적 지오메트리) |
| 빌드 | Vite 8 (game/ 서브디렉토리) |
| 오디오 | Web Audio API (완전 절차적) |
| 백엔드 | Supabase (PostgreSQL + REST) |
| 호스팅 | Vercel (자동 배포) |
| 영속화 | localStorage (세이브 데이터), Supabase (리더보드) |

---

## 📂 프로젝트 구조

```
GY-game/
├── vercel.json           # Vercel 빌드 설정
├── README.md             # ← 현재 파일
├── DEMO_SCRIPT.md        # YouTube 데모 샷 스크립트
├── CLAUDE.md             # 작업 컨텍스트
├── docs/
│   └── 기획서.md
└── game/
    ├── index.html
    ├── style.css
    ├── package.json
    └── src/
        ├── Game.js               # 메인 게임 컨트롤러
        ├── main.js
        ├── data/                 # stages.js, shop.js
        ├── entities/             # Player.js, Creature.js
        ├── systems/              # World, WaveSystem, Camera, AudioManager
        ├── ui/                   # HUD, Shop, Inventory, Minimap
        └── utils/                # storage(localStorage), supabase
```

---

## 🏆 해커톤 정보

- 마감: **2026-06-08 10AM**
- 제출물: 배포 URL ✅ / GitHub ✅ / YouTube 데모 _(준비 중)_

---

## 📄 라이선스

해커톤 출품용. 외부 에셋 미사용 — 모든 시각·청각 콘텐츠는 코드 절차 생성.
