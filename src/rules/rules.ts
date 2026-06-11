import { DIR_NONE, isDir, negDir } from '../core/lane';
import type { BlockBehavior, Rule, RuleBlock } from './RuleEngine';

/**
 * 룰 정의 (데이터). 추가 순서 = 우선순위(뒤가 우선).
 *
 * 룰3/4 의 "특정 색"은 고정이 아니라 COLOR_POOL 에서 매 런 무작위로 뽑힌다
 * (ensureActiveRuleColors). 효과는 고정(정지/통과), 색만 런마다 달라진다.
 * 정적 룰(1~6)이 끝난 라운드 7+ 는 진행(progression) 동적 룰이 매 라운드 추가된다
 * (makeProgressionRule: 속도 +5% / 한 변 +1 / 색 룰 — 15라운드부터 반대 방향 포함).
 */

/**
 * 색 풀 — 흰 배경에 또렷한 30색(CSS hex). 매 런 3색이 룰3/4/5 로 뽑힘.
 * 색상환(hue)을 고르게 한 바퀴 돌도록 배열해 한 런에 뽑히는 3색이 서로
 * 충분히 구분되게 한다. 모두 흰 배경 대비 충분히 진한 톤(연한 색 배제).
 */
export const COLOR_POOL: readonly string[] = [
  '#d11f1f', // red
  '#e0531a', // red-orange
  '#e07b15', // orange
  '#c98f00', // amber
  '#9a8410', // mustard
  '#6f8a14', // olive
  '#4a9a1f', // yellow-green
  '#1f9a3f', // green
  '#0e8a5a', // emerald
  '#0a8a80', // teal
  '#1090b0', // cyan
  '#1f7fd4', // sky blue
  '#2a5fd0', // blue
  '#3247c4', // royal blue
  '#4763b5', // slate blue
  '#5a3bc4', // indigo
  '#7a2fc4', // violet
  '#9b2fd4', // purple
  '#b81fb0', // magenta
  '#c01f8a', // fuchsia
  '#d4286b', // rose
  '#c0143a', // crimson
  '#8a1f2d', // maroon
  '#7a1f5a', // plum
  '#5a3b8a', // deep indigo
  '#2b3a8a', // navy
  '#2a6a64', // deep teal
  '#3a6a2a', // deep green
  '#8a5a2b', // brown
  '#a8431a', // rust
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

/** 색 룰의 행동 종류 — 정지 / 통과 / 반대 방향. */
export type ColorRuleKind = 'stop' | 'pass' | 'opposite';

/** 행동 종류 → 라벨·효과 정의(정본). 정적 룰3/4 와 동적(진행) 색 룰이 공유. */
const COLOR_RULE_DEFS: Record<
  ColorRuleKind,
  { label: string; effect: (behavior: BlockBehavior, block: RuleBlock) => BlockBehavior }
> = {
  stop: {
    label: '이 색은 움직이지 않는다',
    effect: (behavior) => ({ ...behavior, shift: DIR_NONE }),
  },
  pass: {
    label: '이 색은 통과할 수 있다',
    effect: (behavior) => ({ ...behavior, collidable: false }),
  },
  opposite: {
    label: '이 색은 화살표 반대로 이동',
    effect: (behavior, block) => ({ ...behavior, shift: negDir(block.arrow) }),
  },
};

/** 색 룰 팩토리 — targetColor(런마다 랜덤) 인 블록에 kind 의 효과 적용. */
export function makeColorRule(id: number, kind: ColorRuleKind): Rule {
  const def = COLOR_RULE_DEFS[kind];
  let target: string | null = null;
  return {
    id,
    label: def.label,
    behaviorKind: kind,
    get targetColor() {
      return target;
    },
    setColor(color: string | null) {
      target = color;
    },
    appliesTo: (block) => target !== null && block.color === target,
    modify: def.effect,
  };
}

/** 룰3 — 이 색 블록은 화살표가 있어도 움직이지 않는다(정지). */
const rule3 = makeColorRule(3, 'stop');

/** 룰4 — 이 색 블록은 구와 충돌하지 않는다(통과). */
const rule4 = makeColorRule(4, 'pass');

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
 * 확장 마커 룰 팩토리 — 활성 시 그리드 한 변 +1 (블록 행동 불변, HUD 표시용).
 * Game 이 활성 'expand' 태그 수를 집계해 한 변을 키운다(최대 10).
 * 2차원 여부는 모드(grid4x4)가 정한다 — 런 중 1↔2차원 전환은 없다.
 */
export function makeExpandRule(id: number): Rule {
  return {
    id,
    label: '맵이 커진다 (한 변 +1)',
    tag: 'expand',
    appliesTo: () => false,
    modify: (behavior) => behavior,
  };
}

/** 속도 마커 룰 팩토리 — 활성 시 벽 속도 +5% (Game 이 'speed' 태그 수 집계, 누적 ×1.05). */
export function makeSpeedRule(id: number): Rule {
  return {
    id,
    label: '벽이 5% 빨라진다',
    tag: 'speed',
    appliesTo: () => false,
    modify: (behavior) => behavior,
  };
}

/** 룰6 — 확장: 한 변 +1 (1차원 4칸 → 5칸, 2차원 4×4 → 5×5). 라운드6 활성. */
const ruleExpand = makeExpandRule(6);

export const RULES: readonly Rule[] = [rule1, rule2, rule3, rule4, rule5, ruleExpand];

// --- 진행(progression) — 정적 룰(1~6)이 끝난 라운드 7+ 는 매 라운드 동적 룰 추가 ---

/** round % 10 이 이 값이면 속도 +5% (10, 20, 30…). */
const SPEED_MOD = 0;
/** round % 10 이 이 값이면 한 변 +1 (15, 25, 35…). */
const EXPAND_MOD = 5;
/** 이 라운드부터 '반대 방향' 색 룰이 추가 풀에 포함. */
const OPPOSITE_FROM_ROUND = 15;

/**
 * 라운드 → 동적(진행) 룰 생성 (id = 라운드 번호, 라운드당 정확히 1개 → 번호 연속).
 *  - 10, 20, 30… : 속도 +5% 마커
 *  - 15, 25, 35… : 한 변 +1 마커
 *  - 나머지      : 색 룰(정지/통과 랜덤, 15라운드부터 반대 방향도 풀에 포함)
 * 모든 난이도 공통(어려움도 동일 스케줄 — 시작 라운드만 6).
 */
export function makeProgressionRule(round: number): Rule {
  const mod = round % 10;
  if (mod === SPEED_MOD) return makeSpeedRule(round);
  if (mod === EXPAND_MOD) return makeExpandRule(round);
  const kinds: ColorRuleKind[] = ['stop', 'pass'];
  if (round >= OPPOSITE_FROM_ROUND) kinds.push('opposite');
  return makeColorRule(round, kinds[Math.floor(Math.random() * kinds.length)] as ColorRuleKind);
}

/**
 * 비활성화된 룰(기능 보존) — RULES 에서 제외되어 게임에 추가되지 않는다
 * (라운드가 올라도 활성화 안 됨). 재활성화하려면 RULES 배열에 다시 넣고
 * 번호(id)를 재배치하면 된다.
 *  - rule4x4Expand(구 룰6): 런 중 4×1 → 4×4 전환. 2차원은 이제 모드(grid4x4)
 *    전용이라 배열에서 뺐다. 재활성화 시 Game.refreshGridSize 의 rows 계산에
 *    isActive 체크를 되살리면 된다(2D 코어·setgen·카메라는 전부 동작 보존).
 *  - "반대 방향" 색 룰(구 비활성)은 진행(progression) 풀로 부활 — 15라운드부터
 *    makeProgressionRule 이 무작위로 추가할 수 있다(COLOR_RULE_DEFS.opposite).
 */
const rule4x4Expand: Rule = {
  id: 91,
  label: '이제 4×4 크기로 위아래(wasd)도 피한다',
  appliesTo: () => false,
  modify: (behavior) => behavior,
};

export const DISABLED_RULES: readonly Rule[] = [rule4x4Expand];

/** 모든 색 룰의 배정 색을 비운다(재시작 시). */
export function resetRuleColors(): void {
  for (const rule of RULES) rule.setColor?.(null);
}

/**
 * 활성 룰 중 아직 색이 없는 색 룰에 COLOR_POOL 의 미사용 색을 무작위 배정.
 * 라운드 진행으로 색 룰이 새로 활성화되는 시점에 호출 → 그때 색이 정해진다.
 * 사용 중 색은 정적(RULES) + 활성(동적 진행 룰 포함) 모두에서 집계한다.
 * 풀(30색) 소진 시 색이 없는 채로 남는다(appliesTo 불발 — 무해한 no-op 룰).
 */
export function ensureActiveRuleColors(activeRules: readonly Rule[]): void {
  for (const rule of activeRules) {
    if (!rule.setColor || rule.targetColor != null) continue; // 색 룰 아님 / 이미 배정
    const used = new Set(
      [...RULES, ...activeRules]
        .map((r) => r.targetColor)
        .filter((c): c is string => typeof c === 'string'),
    );
    const avail = COLOR_POOL.filter((c) => !used.has(c));
    if (avail.length === 0) continue;
    const color = avail[Math.floor(Math.random() * avail.length)] as string;
    rule.setColor(color);
    // 색→룰 매핑은 RulePanel(T15)이 표시. 블라인드 모드 누설 방지로 콘솔 로그 없음.
  }
}
