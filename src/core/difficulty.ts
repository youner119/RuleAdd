/**
 * 난이도 모드 (AC11).
 *  - normal: 룰1로 시작, 라운드마다 점진 추가
 *  - hard:   룰1~5 전부로 시작 (점수 라운드는 1부터 — 뻥튀기 방지)
 *  - blind:  보통과 동일 진행이되 룰 패널을 표시하지 않음
 */
export type Difficulty = 'normal' | 'hard' | 'blind';

export interface DifficultyConfig {
  /** 활성 룰 수의 하한 — activeCount = min(maxRules, max(round, ruleFloor)). */
  ruleFloor: number;
  /** 우측 룰 패널(T15) 표시 여부. */
  showRulePanel: boolean;
}

export function difficultyConfig(difficulty: Difficulty, maxRules: number): DifficultyConfig {
  switch (difficulty) {
    case 'hard':
      return { ruleFloor: maxRules, showRulePanel: true };
    case 'blind':
      return { ruleFloor: 1, showRulePanel: false };
    case 'normal':
    default:
      return { ruleFloor: 1, showRulePanel: true };
  }
}
