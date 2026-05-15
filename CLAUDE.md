# HUNTERS — 프로젝트 컨텍스트

## 프로젝트 개요
- Three.js 기반 3D 생물 포획 게임 "HUNTERS"
- 해커톤 제출 프로젝트 (마감: 2026-06-08 10AM)
- 제출 필요: 배포 URL + GitHub 저장소 + YouTube 데모 영상

## 기술 스택
- **빌드**: Vite (game/ 하위 디렉토리)
- **렌더링**: Three.js (절차적 지오메트리, WebGL)
- **오디오**: Web Audio API (외부 파일 없음, 절차적 합성)
- **백엔드**: Supabase (글로벌 리더보드)
- **배포**: Vercel (루트 `vercel.json` 사용, `cd game &&` prefix)
- **저장소**: GitHub — gwonyoung06/gy-game

## 디렉토리 구조
```
GY-game/
├── vercel.json          ← Vercel 배포 설정 (루트에 이것만 사용)
├── .gitignore
├── CLAUDE.md
└── game/
    ├── index.html
    ├── style.css        ← 전체 UI 스타일 (Google Fonts, glassmorphism)
    ├── package.json
    ├── .env.local       ← 실제 키 (gitignore됨, 절대 읽지 말 것)
    ├── .env.example     ← 플레이스홀더만
    └── src/
        ├── main.js
        ├── Game.js      ← 메인 게임 컨트롤러
        ├── data/
        │   ├── stages.js
        │   └── shop.js
        ├── entities/
        │   ├── Player.js
        │   └── Creature.js
        ├── systems/
        │   ├── World.js
        │   ├── WaveSystem.js
        │   ├── CameraController.js
        │   └── AudioManager.js
        ├── ui/
        │   ├── HUD.js
        │   ├── Shop.js
        │   ├── Inventory.js
        │   └── Minimap.js
        └── utils/
            ├── storage.js   ← localStorage 래퍼
            └── supabase.js  ← Supabase 클라이언트 (env vars로만)
```

## 화면 흐름
title → stage-select → pregame → game → result → (shop/leaderboard)

## 주요 규칙
- **민감 정보 금지**: `.env.local`, API 키, 개인정보는 절대 읽거나 코드에 직접 쓰지 않음. 환경변수(`import.meta.env.VITE_*`)로만 처리
- **Supabase**: env vars 없어도 null guard로 게임은 정상 동작, 리더보드만 비활성화
- **빌드 확인**: 코드 변경 후 항상 `cd game && npm run build`로 검증 후 push
- **커밋**: 변경 후 즉시 `git add → git commit → git push origin main`

## Vercel 환경변수 (설정 필요)
- `VITE_SUPABASE_URL` = `https://[ref].supabase.co` (대시보드 URL 아님)
- `VITE_SUPABASE_KEY` = anon/public key

## 알려진 이슈 / 미해결
- 스킬(회오리·자석)로 포획 시 코인·점수 미지급 버그 (게임플레이 의도일 수 있음)
- YouTube 데모 영상 미제작 (해커톤 필수 제출물)

## 작업 시 주의사항
- `npm` 실행 전 PowerShell PATH 갱신 필요:
  `$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`
- 빌드 경고 "chunks larger than 500kB"는 무시해도 됨 (Three.js 번들 크기)
- `game/vercel.json` 삭제됨 — 루트 `vercel.json`만 사용
