import type { BlockBehavior, Rule, RuleBlock } from './RuleEngine';

/**
 * 룰 정의 (데이터). 추가 순서 = 우선순위(뒤가 우선).
 *
 * 룰3/4/5 의 "특정 색"은 고정이 아니라 COLOR_POOL 에서 매 런 무작위로 뽑힌다
 * (randomizeRuleColors). 효과는 고정(반대/정지/통과), 색만 런마다 달라진다.
 */

/** 색 풀 — 흰 배경에 또렷한 12색(CSS hex). 매 런 3색이 룰3/4/5 로 뽑힘. */
export const COLOR_POOL: readonly string[] = [
  '#e23b3b', // red
  '#3b6fe2', // blue
  '#2ca24c', // green
  '#f2941f', // orange
  '#9b3bd4', // purple
  '#10a89e', // teal
  '#e23b9e', // pink
  '#8a5a2b', // brown
  '#2b3a8a', // navy
  '#b59000', // gold
  '#d45a13', // burnt orange
  '#5a3b8a', // indigo
];

/** 룰1 — 벽에 닿으면 죽는다 · a/d 이동. base. */
const rule1: Rule = {
  id: 1,
  label: '벽에 닿으면 죽는다 · a/d 이동',
  appliesTo: () => true,
  modify: (behavior) => behavior,
};

/** 룰2 — 화살표 있는 블록은 근접 시 화살표 방향으로 1칸 쉬프트. */
const rule2: Rule = {
  id: 2,
  label: '화살표 방향으로 벽이 움직인다',
  appliesTo: (block) => block.arrowDir !== 0,
  modify: (behavior, block) => ({ ...behavior, shiftDir: block.arrowDir }),
};

/** 색 룰 팩토리 — targetColor(런마다 랜덤) 인 블록에 effect 적용. */
function makeColorRule(
  id: number,
  label: string,
  effect: (behavior: BlockBehavior, block: RuleBlock) => BlockBehavior,
): Rule {
  let target: string | null = null;
  return {
    id,
    label,
    get targetColor() {
      return target;
    },
    setColor(color: string | null) {
      target = color;
    },
    appliesTo: (block) => target !== null && block.color === target,
    modify: effect,
  };
}

/** 룰3 — 이 색 블록은 화살표 반대 방향으로 이동. */
const rule3 = makeColorRule(3, '이 색은 화살표 반대로 이동', (behavior, block) => ({
  ...behavior,
  shiftDir: -block.arrowDir,
}));

/** 룰4 — 이 색 블록은 화살표가 있어도 움직이지 않는다. */
const rule4 = makeColorRule(4, '이 색은 움직이지 않는다', (behavior) => ({
  ...behavior,
  shiftDir: 0,
}));

/** 룰5 — 이 색 블록은 구와 충돌하지 않는다(통과). */
const rule5 = makeColorRule(5, '이 색은 통과할 수 있다', (behavior) => ({
  ...behavior,
  collidable: false,
}));

export const RULES: readonly Rule[] = [rule1, rule2, rule3, rule4, rule5];

/** 모든 색 룰의 배정 색을 비운다(재시작 시). */
export function resetRuleColors(): void {
  for (const rule of RULES) rule.setColor?.(null);
}

/**
 * 활성 룰 중 아직 색이 없는 색 룰에 COLOR_POOL 의 미사용 색을 무작위 배정.
 * 라운드 진행으로 색 룰이 새로 활성화되는 시점에 호출 → 그때 색이 정해진다.
 */
export function ensureActiveRuleColors(activeRules: readonly Rule[]): void {
  for (const rule of activeRules) {
    if (!rule.setColor || rule.targetColor != null) continue; // 색 룰 아님 / 이미 배정
    const used = new Set(
      RULES.map((r) => r.targetColor).filter((c): c is string => typeof c === 'string'),
    );
    const avail = COLOR_POOL.filter((c) => !used.has(c));
    if (avail.length === 0) continue;
    const color = avail[Math.floor(Math.random() * avail.length)] as string;
    rule.setColor(color);
    // 색→룰 매핑은 RulePanel(T15)이 표시. 블라인드 모드 누설 방지로 콘솔 로그 없음.
  }
}
