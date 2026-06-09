# RuleAdd

WebGL 3D 회피 퍼즐 게임. 흰 배경에서 흰 구(플레이어)를 조종해 다가오는 벽의 빈 칸(gap)으로 이동하는 Hole-in-the-wall 메커니즘 (Chrome 공룡 미니게임의 3D 발전형). 라운드가 진행될수록 룰이 1→5 순서로 누적되고, 나중 룰이 충돌 시 우선한다. 무한 생존 하이스코어. **Computer Graphics 개인 과제** — three.js 기반.

설계 정본: `.omc/specs/deep-interview-ruleadd.md` (deep-interview 9 rounds, ambiguity 12.2%, PASSED).

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

> 참고: git 은 아직 미초기화 (greenfield). T1 스캐폴딩 시점에 `git init` → `main`. 그 전까지 L2 는 첫 커밋 구성 시점부터 적용.

---

## Read these first when starting a session

1. **`.omc/state/current-task.md`** — 세션 간 task 연속성의 single source of truth. 현재 phase / active task / next action + task catalog. **형식 = `.omc/state/current-task-template.md` 정본 — 갱신 시 template 의 invariant (group 별 ### 헤더 / T\<n\> flat numbering / spec AC 와 1:1 align / interview meta 는 task list 외 Last updated 한 줄로) 따름. 안티-예시 (sub-numbering / interview meta 의 task list 박힘 / group 없는 flat list / AC reference 없음) 박지 말 것.**
2. **`.omc/specs/deep-interview-ruleadd.md`** — Deep Interview crystallized spec. Goal / Constraints / Non-Goals / Acceptance Criteria (12개) / Topology (4 컴포넌트) / Ontology / Open Defaults / 전체 transcript. **모든 설계 결정의 정본.**
3. **`.omc/state/current-task-template.md`** — current-task.md 형식 template (직접 갱신 ✗).

---

## Architecture (spec 기반)

- **RuleAdd = three.js 기반 단일 WebGL 게임.** 빌드/번들러 = Vite, 언어 = TypeScript 권장.
- **v1 범위:** 4×1 그리드 (한 줄 4칸) + 룰 1~5. → **Non-Goal (v2):** 4×4 / 4×4×4 확장, 룰 6~10, 사운드, 온라인 랭킹. (spec `## Non-Goals` 정본)
- **핵심 메커니즘:** Hole-in-the-wall — 벽이 일부 칸을 막고 ≥1칸 gap 을 남김. 구가 빈 칸으로 이동해 통과. 막힌 칸에서 겹치면 게임오버(즉사).
- **이동 모델:** 구·벽 모두 연속(continuous) 접근 우선 구현, 조작감 불만 시 구만 칸 스냅으로 전환 (이동 로직 분리해 둘 것).
- **난이도 상승원:** 벽 속도 일정(가속 없음). 난이도는 **오직 룰 누적**에서 나온다 — 공간지각 + 논리 사고가 난이도원.
- **룰 우선순위:** 1→5 순서 누적 + 후순위 우선(later-wins). 룰 3·4·5 의 색은 서로 다른 색 배정으로 애초에 비충돌. 우선순위는 색 겹침이 불가피할 때(v2 룰8 등)의 폴백.
- **점수:** 세트 통과 시 `기본점(100) × 라운드²`. 라운드당 5세트 고정 → 라운드 +1 + 룰 활성화.

```
main.ts (entry)
  └─ GameLoop (requestAnimationFrame)
       ├─ Spawner          # 벽 세트 스폰 + Z축 일정 속도 접근
       ├─ RuleEngine       # data-driven 룰 정의 + 후순위 우선 정렬 (v2 확장 대비)
       ├─ CollisionSystem  # 막힌 칸 충돌 판정 → 게임오버
       ├─ ScoreSystem      # base × round²
       └─ HUD              # 우측 룰 패널(최신 위) + 점수 + 게임오버/재시작
```

> 구현 상세 구조는 미착수 (greenfield). 위는 spec `## Technical Context` 의 제안 — 실제 모듈 경계는 구현 진입 시 사용자 승인(L1) 후 확정.

## Operating rules

- **User-driven sequential execution.** 기본은 사용자가 단계별로 드라이브. autopilot / ralph / team / ultrawork 는 assistant 가 먼저 제안하지 않음. 단, **사용자가 명시적으로 명령하면 사용 가능.**
- 한국어 기본. Technical terms (WebGL, shader, raycast, requestAnimationFrame, AABB 등) 영문 유지.
- **메모리 / 작업 상태 분리.** `.omc/state/current-task.md` 에 없던 작업을 했다면 `.omc/state/prev-task.md` 에 추가. current 는 사용자 명시 전엔 손대지 않음. **갱신 시 `.omc/state/current-task-template.md` 의 형식 invariant 박힘** (group 별 ### / T\<n\> flat numbering / spec AC 1:1 align).
- **설계 결정 기록 위치:** spec(`.omc/specs/deep-interview-ruleadd.md`) 이 정본. spec 에 없는 architectural reasoning 만 별도 보존이 필요하면 `.omc/decisions.md` 신설(사용자 승인 후).

> 협업 절차 규칙 (pre-action approval / commit 단위) 은 본 파일 상단의 **🔒 LOCKED RULES** 가 정본. 중복 정의 금지.

## Project structure (계획 — 미착수)

```
RuleAdd/
├── index.html              # (계획) Vite entry
├── package.json            # (계획) three.js + vite + typescript
├── src/                    # (계획) 게임 소스
│   ├── main.ts             #   entry + GameLoop
│   ├── core/               #   Player / Spawner / Wall / CollisionSystem
│   ├── rules/              #   RuleEngine + 룰1~5 정의 (data-driven)
│   ├── progression/        #   Set/Round 구조 + ScoreSystem + 난이도 모드
│   └── hud/                #   우측 룰 패널 + 점수 + 게임오버 UI
├── .omc/
│   ├── state/current-task.md           # 앞으로 할 일 (active / 다음 action)
│   ├── state/current-task-template.md  # current-task.md 형식 template (정본)
│   └── specs/deep-interview-ruleadd.md # Deep interview crystallized spec (설계 정본)
└── CLAUDE.md               # 이 파일
```

> `src/` 하위 모듈 경계는 제안일 뿐 — T1~T2 스캐폴딩 시점에 사용자 승인(L1) 후 확정.

## Progress & testing (계획)

진행 상황은 `.omc/state/current-task.md` 참조 — **앞으로 할 일**(active / 다음 action)만. 완료 아카이브는 `.omc/state/prev-task.md` (필요 시 신설).

```bash
# (T1 스캐폴딩 후 확정될 명령 — 현재는 계획)
npm run dev                 # Vite dev server (브라우저에서 플레이 확인)
npm run build               # 프로덕션 빌드
npx tsc --noEmit            # 타입체크
```

**코드 변경 후 workflow:** 타입체크 → dev server 에서 실제 플레이 확인(브라우저). 게임 로직은 단위 테스트보다 **실 플레이 1-cycle 검증** (spec acceptance criteria AC1~AC12) 이 1차 게이트.

## Resuming tasks after a new session

1. `.omc/state/current-task.md` 읽기 — **앞으로 할 일** 목록.
2. 아직 안 된 task 만 TaskCreate 로 재생성.
3. 작업 완료 시 처리 규칙:
   - **current-task.md 에 있던 task → "완료" 표시만**. 사용자가 명시할 때까지 prev-task.md 로 이동 금지.
   - **current-task.md 에 없던 task 를 했다면 → prev-task.md 에 추가**. current 에는 적지 않음.
4. 완전 아카이빙(current → prev 이동) 은 사용자가 명시적으로 "prev 로 옮겨라" 했을 때만.
