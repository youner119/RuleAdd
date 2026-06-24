# RuleAdd

WebGL 3D 회피 퍼즐 게임. 흰 배경에서 흰 구(플레이어)를 조종해 다가오는 벽의 빈 칸(gap)으로 이동하는 Hole-in-the-wall 메커니즘 (Chrome 공룡 미니게임의 3D 발전형). 라운드가 진행될수록 룰이 1→6 순서로 누적되고(라운드 7+ 는 동적 진행 룰 — 속도 +5%/그리드 확장/색 룰 계속 추가), 나중 룰이 충돌 시 우선한다. 무한 생존 하이스코어. **Computer Graphics 개인 과제** — three.js 기반.

설계 정본: `.omc/specs/deep-interview-ruleadd.md` (deep-interview 9 rounds, ambiguity 12.2%, PASSED — 단 본문 일부는 2026-06-24 구현 동기화 개정됨, `## Implementation Drift` 참조).

---

## 🔒 LOCKED RULES — VIOLATION = IMMEDIATE STOP

> **이 섹션은 협업 계약. 위반 = 작업 즉시 중단 + 사용자에게 보고.**
> **본 섹션 자체의 수정·삭제·완화·표현 변경은 사용자의 명시적 승인 없이 금지된다.** Assistant 가 자체 판단으로 이 섹션을 갱신하는 어떤 PR/commit/edit 도 불가. 갱신이 필요해 보이면 먼저 옵션 제시 → 승인 → 진행.

### L1. Pre-action approval — 비자명 작업 전에 옵션 제시 + 승인 필수

다음에 해당하는 작업은 **착수 전에** 옵션 (a)/(b)/(c) 형태로 제시하고 사용자 승인을 받은 뒤에만 실행한다:

- 새 파일/모듈 추가
- 다중 파일 리팩터
- **설계 결정** (게임 규칙/물리 파라미터 변경, 룰 정의·우선순위 구조 변경, schema 변경, 정책 신설, 씬/렌더 구조 변경 등)
- 외부 자료 광범위 조사
- Spec / CLAUDE.md / docs 의 의미 변경

**예외 (승인 불필요):** read / grep / typecheck / test / build / dev server 실행 / 단순 명백한 버그 1줄 수정 / 사용자가 직접 명시한 정확한 변경.

**모호한 명령** → 옵션 (a)/(b)/(c) 제시. 추측해서 진행 금지.

**위반 발견 시:** assistant 는 작업 중단, 변경 사항 보고, 사용자 결정 대기. 자체 판단으로 "되돌리기" 시도 금지 (revert/reset 도 destructive 결정).

### L2. Commit 단위 — 한 문제 = 한 commit

사용자가 명시한 한 가지 문제를 해결하는 범위만 한 commit 에 담는다. 작업 중 발견된 별개 concern (즉, 사용자가 명시 요청하지 않은 정정·개선·후속 이슈) 은 **반드시 별개 commit** 으로 분리.

- 별개 concern 발견 시: 사용자에게 보고 → 본 PR 에 포함할지 별도 commit 으로 뺄지 옵션 제시.
- 자체 판단으로 "겸사겸사" 같이 묶기 금지.
- 한 commit 에 여러 concern 이 박혀 사용자가 분리 요청하면, 그건 "되돌리기 결정" 이므로 옵션 제시 후 사용자 승인 받고 처리.

Commit message footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

> 참고: git 초기화 완료 — `main` 브랜치 (origin: `github.com/youner119/RuleAdd`). L2 는 모든 커밋에 적용된다.

---

## Read these first when starting a session

1. **`.omc/state/current-task.md`** — 세션 간 task 연속성의 single source of truth. 현재 phase / active task / next action + task catalog. **형식 = `.omc/state/current-task-template.md` 정본 — 갱신 시 template 의 invariant (group 별 ### 헤더 / T\<n\> flat numbering / spec AC 와 1:1 align / interview meta 는 task list 외 Last updated 한 줄로) 따름. 안티-예시 (sub-numbering / interview meta 의 task list 박힘 / group 없는 flat list / AC reference 없음) 박지 말 것.**
2. **`.omc/specs/deep-interview-ruleadd.md`** — Deep Interview crystallized spec. Goal / Constraints / Non-Goals / Acceptance Criteria / Topology (4 컴포넌트) / Ontology / Open Defaults / 전체 transcript + **`## Implementation Drift`(2026-06-24 구현 동기화 개정점)**. **모든 설계 결정의 정본** — 단 본문 일부는 구현에 맞게 개정됨(transcript 는 역사 원본).
3. **`.omc/state/current-task-template.md`** — current-task.md 형식 template (직접 갱신 ✗).

---

## Architecture (구현 반영)

- **RuleAdd = three.js 기반 단일 WebGL 게임.** 빌드/번들러 = Vite, 언어 = TypeScript. Firebase(글로벌 랭킹) 의존.
- **구현 범위:** v1(4×1 + 룰1~5)을 넘어 진행 중 — **룰6(그리드 한 변 +1 확장)**, **2차원 모드(4×4→5×5)**, **라운드 7+ 무한 동적 진행 룰**(속도 +5%/확장/색 룰), **i18n(한/EN)**, **점수 기록**(로컬 top5 + Firebase 글로벌 top10), **타이틀 플라이바이** 까지 구현됨. ⚠️ 이들은 원 spec `## Non-Goals`(v2) 영역 — spec 은 `## Implementation Drift` 로 동기화됨. **여전히 미구현(v2):** 룰7~10, 4×4×4 3D, 사운드/음악, warp 룰(훅만 준비·기본 비활성).
- **핵심 메커니즘:** Hole-in-the-wall — 벽이 일부 칸을 막고 ≥1칸 gap 을 남김. 구가 빈 칸으로 이동해 통과. 막힌 칸에서 겹치면 충돌(목숨 −1, 0 이면 게임오버).
- **이동 모델:** 구·벽 모두 연속(continuous) 접근. 슬라이드 스냅 보조(이동 로직 분리됨).
- **난이도 상승원:** 한 런 안에서 벽 속도는 일정(AC5). 단 라운드 7+ 진행 룰 `speed`(라운드 10·20·30…마다 ×1.05 누적)로 장기적으로 가속된다. 1차 난이도원은 여전히 **룰 누적**(공간지각 + 논리).
- **룰 우선순위:** 추가 순서대로 fold + 후순위 우선(later-wins, RuleEngine). 룰 3·4·5 의 색은 서로 다른 색 배정으로 애초에 비충돌. 우선순위는 색 겹침이 불가피할 때의 폴백.
- **점수:** 세트 통과 시 `기본점(100) × 라운드²`. **라운드당 10세트**(`SETS_PER_ROUND=10`) → 라운드 +1 + 룰 활성화.

```
main.ts (entry + 카메라/루프 배선)
  └─ GameLoop (requestAnimationFrame) → Game (상태 머신)
       ├─ Spawner          # 벽 세트 스폰 + Z축 접근 (setgen 으로 세트 생성, 속도 배율)
       ├─ RuleEngine       # data-driven 룰 fold + 후순위 우선. rules.ts(룰1~6 + 진행 룰 + 30색 풀)
       ├─ CollisionSystem  # 막힌 칸 충돌 판정 → 목숨/게임오버
       ├─ ScoreSystem      # base × round²
       ├─ leaderboard/     # localBoard(top5) + globalBoard(Firebase top10)
       ├─ i18n             # 한/EN 메시지
       └─ hud/             # 룰 패널 + 점수 + 게임오버 리플레이 + 시작/점수판/이름 모달
```

> 위는 실제 모듈 구조(2026-06 기준). 모듈 경계 변경은 L1 승인 후.

## Operating rules

- **User-driven sequential execution.** 기본은 사용자가 단계별로 드라이브. autopilot / ralph / team / ultrawork 는 assistant 가 먼저 제안하지 않음. 단, **사용자가 명시적으로 명령하면 사용 가능.**
- 한국어 기본. Technical terms (WebGL, shader, raycast, requestAnimationFrame, AABB 등) 영문 유지.
- **메모리 / 작업 상태 분리.** `.omc/state/current-task.md` 에 없던 작업을 했다면 `.omc/state/prev-task.md` 에 추가. current 는 사용자 명시 전엔 손대지 않음. **갱신 시 `.omc/state/current-task-template.md` 의 형식 invariant 박힘** (group 별 ### / T\<n\> flat numbering / spec AC 1:1 align).
- **설계 결정 기록 위치:** spec(`.omc/specs/deep-interview-ruleadd.md`) 이 정본. spec 에 없는 architectural reasoning 만 별도 보존이 필요하면 `.omc/decisions.md` 신설(사용자 승인 후).

> 협업 절차 규칙 (pre-action approval / commit 단위) 은 본 파일 상단의 **🔒 LOCKED RULES** 가 정본. 중복 정의 금지.

## Project structure (구현)

```
RuleAdd/
├── index.html              # Vite entry
├── package.json            # three.js + firebase + vite + typescript
├── netlify.toml            # 배포 설정 (Netlify 자동 배포)
├── firestore.rules         # Firebase 글로벌 랭킹 보안 규칙
├── .env / .env.example     # Firebase 설정 (gitignore)
├── src/
│   ├── main.ts             #   entry + 카메라/루프 배선
│   ├── i18n.ts             #   한/EN 메시지
│   ├── core/               #   Game / GameLoop / Player / Spawner / Wall / CollisionSystem
│   │                       #   / ScoreSystem / InputController / lane / setgen / pattern
│   │                       #   / difficulty / TitleFlyby
│   ├── rules/              #   RuleEngine + rules(룰1~6 + 진행 룰 + 30색 풀)
│   ├── hud/                #   RulePanel / ScoreHud / GameOverScreen / StartScreen
│   │                       #   / ScoreboardScreen / ScoreboardPanel / NameEntryModal
│   │                       #   / RoundBanner / ControlsHud
│   └── leaderboard/        #   firebase / globalBoard / localBoard / types
├── scratch/                # 실험·진단 스크립트 (빌드 제외)
├── .omc/
│   ├── state/current-task.md           # 앞으로 할 일 (active / 다음 action)
│   ├── state/current-task-template.md  # current-task.md 형식 template (정본)
│   └── specs/deep-interview-ruleadd.md # Deep interview spec (설계 정본 + Implementation Drift)
└── CLAUDE.md               # 이 파일
```

## Progress & testing

진행 상황은 `.omc/state/current-task.md` 참조 — **앞으로 할 일**(active / 다음 action)만. 완료 아카이브는 `.omc/state/prev-task.md`.

```bash
npm run dev                 # Vite dev server (브라우저에서 플레이 확인)
npm run build               # tsc --noEmit + vite build (프로덕션)
npm run typecheck           # tsc --noEmit (타입체크)
npm run preview             # 빌드 결과 미리보기
```

**코드 변경 후 workflow:** 타입체크 → dev server 에서 실제 플레이 확인(브라우저). 게임 로직은 단위 테스트보다 **실 플레이 1-cycle 검증** (spec acceptance criteria AC1~AC12) 이 1차 게이트.

## Resuming tasks after a new session

1. `.omc/state/current-task.md` 읽기 — **앞으로 할 일** 목록.
2. 아직 안 된 task 만 TaskCreate 로 재생성.
3. 작업 완료 시 처리 규칙:
   - **current-task.md 에 있던 task → "완료" 표시만**. 사용자가 명시할 때까지 prev-task.md 로 이동 금지.
   - **current-task.md 에 없던 task 를 했다면 → prev-task.md 에 추가**. current 에는 적지 않음.
4. 완전 아카이빙(current → prev 이동) 은 사용자가 명시적으로 "prev 로 옮겨라" 했을 때만.
