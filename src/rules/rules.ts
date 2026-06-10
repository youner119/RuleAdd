import { DIR_NONE, isDir, negDir } from '../core/lane';
import type { BlockBehavior, Rule, RuleBlock } from './RuleEngine';

/**
 * 룰 정의 (데이터). 추가 순서 = 우선순위(뒤가 우선).
 *
 * 룰3/4 의 "특정 색"은 고정이 아니라 COLOR_POOL 에서 매 런 무작위로 뽑힌다
 * (ensureActiveRuleColors). 효과는 고정(정지/통과), 색만 런마다 달라진다.
 * "화살표 반대로 이동"(구 룰3)은 비활성 — DISABLED_RULES 참조(기능 보존).
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
  appliesTo: (block) => isDir(block.arrow),
  modify: (behavior, block) => ({ ...behavior, shift: block.arrow }),
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

/** 룰3 — 이 색 블록은 화살표가 있어도 움직이지 않는다(정지). */
const rule3 = makeColorRule(3, '이 색은 움직이지 않는다', (behavior) => ({
  ...behavior,
  shift: DIR_NONE,
}));

/** 룰4 — 이 색 블록은 구와 충돌하지 않는다(통과). */
const rule4 = makeColorRule(4, '이 색은 통과할 수 있다', (behavior) => ({
  ...behavior,
  collidable: false,
}));

/**
 * 룰5 — 확장: ⓧ 마커(동그라미+X, 확장 방향 분면 검정) 벽이 쉬프트 타이밍에
 * 그 방향 인접 칸으로 자라난다(스폰 땐 빈 칸처럼 보이는 함정).
 * 행동(이동/충돌)은 바꾸지 않는다 — 확장 구성은 생성기(setgen)가 담당하고,
 * 이 룰은 활성화(라운드5)·HUD 표시용.
 */
const rule5: Rule = {
  id: 5,
  label: 'ⓧ 표시 벽은 칠해진 방향으로 늘어난다',
  appliesTo: () => false,
  modify: (behavior) => behavior,
};

/**
 * 룰6 — 확장: 평면이 4×1 → 4×4 로 커진다. 이후 위/아래(wasd)로도 피해야 한다.
 * 블록 행동은 바꾸지 않는다(2D 일반화는 setgen/Spawner 가 담당) — 이 룰은
 * 활성화(라운드6)·HUD 표시용 마커. Game 이 isActive(6) 으로 그리드를 4 줄로 전환.
 * 4×4 모드는 이 룰과 무관하게 시작부터 4×4(Game 의 grid4x4 플래그).
 */
const rule6: Rule = {
  id: 6,
  label: '이제 4×4 크기로 위아래(wasd)도 피한다',
  appliesTo: () => false,
  modify: (behavior) => behavior,
};

export const RULES: readonly Rule[] = [rule1, rule2, rule3, rule4, rule5, rule6];

/**
 * 비활성화된 룰(기능 보존) — "이 색은 화살표 반대로 이동"(구 룰3).
 * RULES 에서 제외되어 게임에 추가되지 않는다(라운드가 올라도 활성화 안 됨).
 * 효과·생성기(setgen 의 effShift/displayReps num2 경로)·Spawner 매핑 코드는 그대로
 * 남아 있어, 재활성화하려면 이 룰을 RULES 배열에 다시 넣고 번호(id)를 재배치하면 된다.
 */
const ruleOpposite = makeColorRule(6, '이 색은 화살표 반대로 이동', (behavior, block) => ({
  ...behavior,
  shift: negDir(block.arrow),
}));

export const DISABLED_RULES: readonly Rule[] = [ruleOpposite];

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
