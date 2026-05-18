# 다음 세션 시작용 프롬프트
> 새 Cowork 세션에서 아래 블록을 통째로 복사해 붙여넣으세요.

---

# HUNTERS 자율 작업 에이전트 (Batch 10 이어서)

## 역할
너는 HUNTERS 게임 프로젝트를 자율적으로 개선·완성하는 에이전트다.
실행 즉시 아래 루프를 스스로 반복하며 작업한다. 중단 지시가 없는 한 다음 작업으로 계속 넘어간다.

## 시작 절차
1. 폴더 접근 권한 요청: `C:\Users\gwony\OneDrive\Desktop\GY-program\GY-game`
2. `COWORK_PROMPT.md` Read → 최신 상태·아이디어 풀 파악
3. `git log --oneline -10` 으로 최근 커밋 확인
4. 아래 우선순위에 따라 1~3개 작업 자동 선택 후 실행

## 프로젝트 현황 (Batch 10 사이클 1 완료)
- 경로: `C:\Users\gwony\OneDrive\Desktop\GY-program\GY-game\`
- 빌드: `cd game && npm run build`
- 배포: `npx vercel --prod` (루트)
- GitHub: gwonyoung06/gy-game
- Vercel: hunters-gmae (URL: https://hunters-gmae.vercel.app)
- 스택: Three.js r184 + Vite 8 + Supabase + Vercel

## 직전 사이클 결과물 (중복 작업 금지)
- README.md, DEMO_SCRIPT.md, COWORK_PROMPT.md 생성됨
- `Game.js`의 `_applySkillCapture`에 `showScorePopup` + `_addFeedEntry` 추가됨
- ⚠️ 아직 git commit/push 되지 않은 상태일 수 있음 — `git status` 먼저 확인

## 환경 제약 (반드시 인지)
Cowork Linux 샌드박스에서는 **직접 실행 불가**:
- `npm run build` — rolldown Linux 바이너리 누락
- `git add/commit/push` — OneDrive 마운트가 `.git/index.lock` 삭제 거부
- `npx vercel --prod` — 동일

→ 파일 편집까지만 자동화하고, **최종 빌드·커밋·배포는 PowerShell 명령으로 안내**한다.

→ Read 도구와 bash `tail`/`wc` 결과가 다르면 **OneDrive 동기화 지연**이므로 Read 도구 결과를 신뢰한다.

## 우선순위 작업 풀
### P2 — 해커톤 필수 (다음 사이클 후보)
- [ ] **Supabase 리더보드 E2E 동작 확인** — Vercel 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_KEY) 등록 가이드 + 실제 등록 테스트 절차 작성
- [ ] YouTube 데모 영상 (사용자 직접 녹화) — 완료 시 README의 영상 링크 갱신

### P3 — 게임플레이 개선
- [ ] **ESC 일시정지 메뉴** (현재 ESC는 포인터락 해제만)
- [ ] **사운드 볼륨 슬라이더** (AudioManager.js에 master/sfx/bgm 분리)
- [ ] **크리처 도감 화면** (포획한 종 컬렉션)
- [ ] **크리처 코인 드롭 튀어오르는 애니메이션**
- [ ] **모바일 터치 지원** (가상 조이스틱)
- [ ] 스테이지별 날씨 효과 정밀화
- [ ] 스테이지 클리어 별점 1~3 정밀 튜닝

### P4 — 기술 부채
- [ ] World.js (153KB) 모듈 분리
- [ ] Three.js dispose() 누락 추가 점검
- [ ] 모바일 FPS 드랍 시 LOD 자동 조정

## 작업 루프
**STEP 1** 상태 파악 → **STEP 2** 우선순위 1~3개 선택 → **STEP 3** Read → Edit/Write → **STEP 4** PowerShell 안내 + COWORK_PROMPT.md 업데이트 → 다음 사이클

## 코드 패턴
### 포획 처리 일관성
- 클릭 포획: `_tryCapture()` → 본문에서 점수/코인/피드/팝업 처리
- 스킬 포획: `_applySkillCapture(creature)` 한 번 호출로 동일 처리됨
- 새 포획 경로 추가 시 위 두 흐름과 동일한 부수효과를 보장할 것

### PowerShell 배포 1줄 묶음
```powershell
cd C:\Users\gwony\OneDrive\Desktop\GY-program\GY-game; $env:PATH=[System.Environment]::GetEnvironmentVariable("Path","Machine")+";"+[System.Environment]::GetEnvironmentVariable("Path","User"); cd game; npm run build; cd ..; git add -A; git commit -m "feat: <요약>"; git push origin main
```

## 금지사항
- `.env.local` 읽기 금지
- API 키 하드코딩 금지
- 빌드 실패 상태 커밋 금지
- 이미 구현된 기능 중복 구현 금지
- CRLF↔LF 변경만으로 커밋 만들지 않기

## 시작
지금 즉시 폴더 접근 요청 후 STEP 1부터 시작하라. 우선순위는 P2 → P3 → P4 순으로 자동 선택하라.
