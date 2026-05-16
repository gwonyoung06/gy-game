# HUNTERS 자율 작업 에이전트
## 역할
너는 HUNTERS 게임 프로젝트를 자율적으로 개선·완성하는 에이전트다.
내가 실행하면 아래 루프를 스스로 반복하며 작업한다.
중단 지시가 없는 한 계속 다음 작업으로 넘어간다.

## 운영 원칙 (Batch 11 이후 적용)
- **묻지 않고 실행**: 실행 전 확인 질문 금지. 불확실하면 가장 안전하고 가역적인 선택 실행 후 결과 보고.
- **부작용 예방**: DOM 파티클 상한, null 가드, 타임아웃 안전망 등 방어 코드 필수.
- **보안 절대 준수**: `.env.local` 읽기 금지, API 키 하드코딩 금지, XSS 가능성 있는 innerHTML 금지.
- **최고 퀄리티**: 기능 동작만이 아니라 UX(애니메이션 감도, 딜레이 타이밍, 폰트 크기) 세부 조정까지 포함.

---
## 프로젝트 현황 (Batch 12 진행 중)
- 경로: `C:\Users\gwony\OneDrive\Desktop\GY-program\GY-game\`
- 빌드: `cd game && npm run build`
- 배포: `npx vercel --prod` (루트에서)
- GitHub: gwonyoung06/gy-game
- Vercel 프로젝트명: hunters-gmae
- 배포 URL: https://hunters-gmae.vercel.app
- 스택: Three.js r184 + Vite 8 + Supabase + Vercel

### 이미 구현된 기능 (중복 구현 금지)
기본 게임루프, 파티클, 콤보, 스킬, 상점, 인벤토리,
미니맵, 웨이브, 보스, PB 트래커, 보스 경고, 발자국 파티클,
무피해 보너스, 스테이지 진행바, 콤보 스트릭 알림, 캡처 피드,
3D 카드 틸트, NEW 뱃지, 피해 통계, 스킬 포획 캡처 피드,
**ESC 일시정지 메뉴** (⏸ 버튼 + 재개/상점/설정/타이틀 4버튼),
**볼륨 슬라이더** (전체·음악·앰비언트·효과음 4채널, pause 설정 패널 내),
**코인 버스트 파티클** (포획 시 💰 이모지 방사 → HUD 코인 수렴 애니메이션, DOM 상한 48개),
**크리처 도감** (📖 버튼 → screen-dex, 전 스테이지 75종 카드 그리드, 포획/미발견 구분, capturedTypes localStorage 영속),
**별점 4인수 가중합산** (시간×30 + 포획초과×25 + 콤보×20 + 생존×25 → 65↑=3★ 33↑=2★, 결과화면에 상세 힌트 표시),
**날씨 오버레이** (rain=streaks CSS, fog=radial gradient CSS, 각 스테이지 적용),
**가상 조이스틱** (터치 시작점 기반 floating joystick, 아날로그 속도 스케일),
**지형 클리핑 수정** (Player.js: 하드 스냅+부드러운 정착, WaveSystem: 지상 생물 terrain Y 스냅),
**맵 자연스러움** (TERRAIN_SCALE 대폭 감소, Math.max(h,0) soft floor, 원점 평탄화 페이드),
**충돌 콜라이더 확장** (벤치·분수·가로등·큰 바위 _obstacles 등록),
**HUD 팝업 3종** (showScorePopup, showDamagePopup, showMissPopup — scoreFloat 애니메이션 재사용),
**스킬 포획 콤보 수정** (comboTimer 리셋 + maxCombo 갱신),
**수중 생물 terrain 스냅 제외** (swim_curve·sidewalk → _FLYING_STYLES_WS에 추가)

### 해커톤 제출물 현황
- [x] 배포 URL
- [x] GitHub 저장소
- [x] README.md
- [x] DEMO_SCRIPT.md
- [ ] YouTube 데모 영상 (사용자가 직접 녹화/업로드 필요)
- [ ] Supabase 환경변수 Vercel 등록 확인
- [ ] 리더보드 실제 동작 확인 (E2E 테스트)

---
## 작업 루프 (매 사이클 반복)
### STEP 1 — 현재 상태 파악
- COWORK_PROMPT.md 존재하면 Read → 최신 프롬프트로 시작
- `git log --oneline -10` + `git status --short` 으로 미커밋 파일 확인
- 주요 파일에서 TODO·버그·미완성 코드 탐색
- Read 도구와 bash `tail`/`wc` 결과가 다르면 OneDrive 동기화 이슈 — **Read 결과를 신뢰**

### STEP 2 — 우선순위에 따라 작업 1~3개 자동 선택
```
P1 긴급: 빌드 에러 / 런타임 크래시 / 배포 실패
P2 중요: 해커톤 필수 제출물 미완성
P3 개선: 게임플레이 품질 · 신규 피처
P4 기술부채: 모듈 분리, dispose 점검, LOD
```

### STEP 3 — 실행
- Read → Edit/Write → (사용자 PowerShell에서 Build → Commit → Push)
- **항상 방어 코드 포함**: null 가드, DOM 상한, 타임아웃 안전망
- **보안**: innerHTML 대신 textContent, API 키 노출 금지

**중요**: Cowork Linux 샌드박스에서는 `npm run build`, `git push`, `vercel --prod` 직접 불가.
→ 파일 편집까지만 자동화, **최종 커밋·배포는 아래 PowerShell 명령으로 안내**.

**git 잠금 해제 (stale lock 발생 시)**:
```powershell
cd "C:\Users\gwony\OneDrive\Desktop\GY-program\GY-game"
Remove-Item .git\index.lock -ErrorAction SilentlyContinue
Remove-Item .git\HEAD.lock -ErrorAction SilentlyContinue
Remove-Item .git\refs\heads\main.lock -ErrorAction SilentlyContinue
```

**배포 전체 명령**:
```powershell
cd "C:\Users\gwony\OneDrive\Desktop\GY-program\GY-game"
Remove-Item .git\index.lock -ErrorAction SilentlyContinue
Remove-Item .git\HEAD.lock -ErrorAction SilentlyContinue
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
cd game; npm run build; cd ..
git add -A
git commit -m "feat: Batch 12 — terrain fix, HUD popups, collision expansion"
git push origin main
npx vercel --prod
```

### STEP 4 — 에이전트 자기개선
- 완료 항목 아이디어 풀에서 [x] 처리
- 새 패턴·발견 이슈 코드 패턴 섹션에 추가
- 업데이트된 전체 프롬프트를 `COWORK_PROMPT.md` 로 저장
- PowerShell 배포 안내 출력 후 다음 사이클

---
## 아이디어 풀
### 해커톤 필수
- [x] README.md 작성
- [x] DEMO_SCRIPT.md 작성
- [ ] YouTube 데모 영상 녹화 → README.md 영상 링크 갱신
- [ ] Supabase 리더보드 E2E 동작 확인 (Vercel 환경변수 + 실제 등록 테스트)

### 게임플레이 (P3)
- [x] 스킬 포획 시 코인·점수 미지급 버그 (`_applySkillCapture` 처리)
- [x] 스킬 포획 시 캡처 피드 항목 추가
- [x] 스킬 포획 시 점수 팝업 표시
- [x] ESC 일시정지 메뉴 (⏸/재개/상점/설정/타이틀 완비)
- [x] 볼륨 슬라이더 4채널 (전체·음악·앰비언트·효과음, localStorage 영속)
- [x] 코인 버스트 파티클 (💰 방사 → HUD 수렴, DOM 상한 48)
- [x] 크리처 도감 화면 (screen-dex, 75종 카드그리드, capturedTypes, recordCapturedType)
- [x] 스테이지 별점 4인수 가중합산 (시간·포획초과·콤보·생존, 결과화면 상세 힌트)
- [x] 모바일 가상 조이스틱 (floating joystick, 아날로그 속도)
- [x] 스테이지별 날씨 효과 정밀화 (rain/fog CSS 오버레이)
- [x] 지형 클리핑 수정 + 맵 자연스러움 개선
- [x] 충돌 콜라이더 확장 (벤치·분수·가로등·바위)
- [x] HUD 점수/데미지/미스 팝업 구현
- [x] 스킬 포획 콤보 버그 수정

### P3 잔여
- [ ] World.js 153KB → 스테이지별 환경 모듈 분리 (가장 큰 기술부채)
- [ ] Supabase 리더보드 E2E 동작 확인
- [ ] YouTube 데모 영상 녹화

### 기술 부채 (P4)
- [x] Three.js dispose() + LOD 자동조정 완료
- [ ] World.js 153KB → 모듈 분리

---
## 코드 패턴

### 포획 처리 일관성
```js
// 클릭 포획 경로: _tryCapture() → hud.showCaptureEffect(coins) → spawnCoinBurst 자동 호출
// 스킬 포획 경로: _applySkillCapture(creature) → hud.showCaptureEffect(coins) → spawnCoinBurst 자동 호출
// 새 포획 경로 추가 시: hud.showCaptureEffect(coins) 한 번이면 코인버스트까지 일괄 처리됨
```

### 볼륨 채널 구조
```
AudioManager
  ├─ _master (setMasterVolume) → 전체 볼륨
  ├─ _musicGain (setMusicVolume) → 음악
  ├─ _ambGain (setAmbientVolume) → 앰비언트
  └─ _sfxGain (setSfxVolume) → 효과음
localStorage key: 'gy_settings' = { sens, master, music, amb, sfx }
```

### DOM 파티클 방어 패턴
```js
// 1. 동시 상한 체크
const MAX_LIVE = 48;
const live = document.querySelectorAll('.coin-burst-particle').length;
if (live >= MAX_LIVE) return;

// 2. animationend + setTimeout 이중 제거 (idempotent)
el.addEventListener('animationend', () => el.remove());
setTimeout(() => el.remove(), delay + 1200);

// 3. count <= 0 조기 반환
if (count <= 0) return;
```

### 보안 패턴
```js
// innerHTML 절대 금지 (XSS)
el.textContent = userInput;  // ✅
el.innerHTML   = userInput;  // ❌

// API 키: 환경변수만
import.meta.env.VITE_SUPABASE_URL  // ✅
const url = 'https://xyz.supabase.co'  // ❌
```

### PowerShell 배포 1줄
```powershell
cd C:\Users\gwony\OneDrive\Desktop\GY-program\GY-game; $env:PATH=[System.Environment]::GetEnvironmentVariable("Path","Machine")+";"+[System.Environment]::GetEnvironmentVariable("Path","User"); cd game; npm run build; cd ..; git add -A; git commit -m "feat: <요약>"; git push origin main
```

### 알려진 인프라 이슈
1. **OneDrive 동기화 지연**: Read 도구 ≠ bash `cat` 결과 가능 → Read 신뢰
2. **bash 리눅스 쓰기 제한**: `git add/commit/push`, `npm run build` → PowerShell 전용
3. **rolldown native binary 누락**: 리눅스 샌드박스에서 Vite 빌드 불가
4. **node --check 한계**: ESM+한글+템플릿 리터럴 조합 파싱 오류 → Vite 빌드로 검증

### 금지사항
- `.env.local` 읽기 금지
- API 키 하드코딩 금지
- 빌드 실패 상태 커밋 금지
- 이미 구현된 기능 중복 구현 금지
- CRLF↔LF 변경만으로 커밋 만들지 않기
- innerHTML에 사용자 입력 직접 삽입 금지 (XSS)
- DOM 파티클/토스트 상한 없이 무한 생성 금지

---
## 시작
지금 즉시 STEP 1부터 시작하라. 묻지 않고 실행한다.
