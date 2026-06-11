import {
  PROGRESSION_DEFAULT,
  PROGRESSION_EASY,
  type ProgressionSchedule,
} from '../rules/rules';

/**
 * 모드 (AC11). 1차원(easy/normal/hard/blind)은 끝까지 한 줄, 2차원('4x4')은
 * 처음부터 4×4 — 런 중 차원 전환은 없고, 확장 룰(룰6)은 한 변만 +1 한다
 * (1차원 4칸→5칸, 2차원 4×4→5×5).
 *  - easy:   느린 속도(4초)·목숨 5, 룰1로 시작 라운드마다 점진 추가.
 *            진행(7+)은 느슨한 스케줄(PROGRESSION_EASY) — 색 3라운드마다,
 *            속도 10·30…, 확장 20·40…, 반대 30+. 빈 라운드 존재.
 *  - normal: 기본 속도(3초)·목숨 3, 룰1로 시작 라운드마다 점진 추가
 *  - hard:   빠른 속도(2.5초)·목숨 3, 모든 룰(확장 포함 → 5칸)로 시작.
 *            라운드도 그 지점(=룰 수)부터 — 표시·점수(base×round²) 모두 해당 라운드 기준.
 *  - blind:  기본 속도(3초)·목숨 3, 점진 추가하되 룰 패널 숨김(전환 배너로만 공개)
 *  - 4x4:    "2차원" 모드(표시명). 기본 속도(3초)·목숨 5, 처음부터 4×4 그리드
 *            (wasd 상하 추가) + 룰 점진 추가. id '4x4' 는 리더보드 키 호환을 위해 유지.
 *
 * 세트 도착 간격(setIntervalSec)은 벽 이동 속도로 구현된다
 * (속도 = WALL_SPACING / setIntervalSec). 한 런 안에서는 일정(가속 없음, AC5).
 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'blind' | '4x4';

export interface DifficultyConfig {
  /** 활성 룰 수의 하한 — activeCount = min(maxRules, max(round, ruleFloor)). */
  ruleFloor: number;
  /** 우측 룰 패널(T15) 표시 여부. */
  showRulePanel: boolean;
  /** 시작 목숨 수. 충돌 시 세트당 1 감소, 0 이면 게임오버. */
  lives: number;
  /** 세트 도착 간격(초) → 벽 이동 속도로 환산(Spawner). */
  setIntervalSec: number;
  /** 처음부터 4×4 그리드로 시작하는가(4x4 모드 전용). */
  grid4x4: boolean;
  /** 라운드 7+ 동적 룰 스케줄(속도/확장/색·반대) — 쉬움만 느슨한 별도 스케줄. */
  progression: ProgressionSchedule;
}

export function difficultyConfig(difficulty: Difficulty, maxRules: number): DifficultyConfig {
  const p = PROGRESSION_DEFAULT;
  switch (difficulty) {
    case 'easy':
      return {
        ruleFloor: 1,
        showRulePanel: true,
        lives: 5,
        setIntervalSec: 4,
        grid4x4: false,
        progression: PROGRESSION_EASY,
      };
    case 'hard':
      return {
        ruleFloor: maxRules,
        showRulePanel: true,
        lives: 3,
        setIntervalSec: 2.5,
        grid4x4: false,
        progression: p,
      };
    case 'blind':
      return {
        ruleFloor: 1,
        showRulePanel: false,
        lives: 3,
        setIntervalSec: 3,
        grid4x4: false,
        progression: p,
      };
    case '4x4':
      return {
        ruleFloor: 1,
        showRulePanel: true,
        lives: 5,
        setIntervalSec: 3,
        grid4x4: true,
        progression: p,
      };
    case 'normal':
    default:
      return {
        ruleFloor: 1,
        showRulePanel: true,
        lives: 3,
        setIntervalSec: 3,
        grid4x4: false,
        progression: p,
      };
  }
}
