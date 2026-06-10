/**
 * 모드 (AC11).
 *  - easy:   느린 속도(4초)·목숨 5, 룰1로 시작 라운드마다 점진 추가
 *  - normal: 기본 속도(3초)·목숨 3, 룰1로 시작 라운드마다 점진 추가
 *  - hard:   빠른 속도(2.5초)·목숨 3, 룰1~5 전부로 시작 (점수 라운드는 1부터)
 *  - blind:  기본 속도(3초)·목숨 3, 점진 추가하되 룰 패널 숨김(전환 배너로만 공개)
 *  - 4x4:    기본 속도(3초)·목숨 3, 처음부터 4×4 그리드(wasd 상하 추가) + 룰 점진 추가
 *
 * 세트 도착 간격(setIntervalSec)은 벽 이동 속도로 구현된다
 * (속도 = WALL_SPACING / setIntervalSec). 한 런 안에서는 일정(가속 없음, AC5).
 * 4×1 모드(easy/normal/hard/blind)도 라운드6에서 룰6 활성 시 4×4 로 확장된다.
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
}

export function difficultyConfig(difficulty: Difficulty, maxRules: number): DifficultyConfig {
  switch (difficulty) {
    case 'easy':
      return { ruleFloor: 1, showRulePanel: true, lives: 5, setIntervalSec: 4, grid4x4: false };
    case 'hard':
      return { ruleFloor: maxRules, showRulePanel: true, lives: 3, setIntervalSec: 2.5, grid4x4: false };
    case 'blind':
      return { ruleFloor: 1, showRulePanel: false, lives: 3, setIntervalSec: 3, grid4x4: false };
    case '4x4':
      return { ruleFloor: 1, showRulePanel: true, lives: 5, setIntervalSec: 3, grid4x4: true };
    case 'normal':
    default:
      return { ruleFloor: 1, showRulePanel: true, lives: 3, setIntervalSec: 3, grid4x4: false };
  }
}
