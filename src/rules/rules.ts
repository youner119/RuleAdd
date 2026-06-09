import type { Rule } from './RuleEngine';

/**
 * 룰 정의 (데이터). 추가 순서 = 우선순위(뒤가 우선).
 * 룰2~5 는 T10/T11 에서 여기 추가된다.
 */

/** 룰1 — 벽에 닿으면 죽는다 · a/d 이동. base(모든 벽 충돌 가능, 쉬프트 없음). */
const rule1: Rule = {
  id: 1,
  label: '벽에 닿으면 죽는다 · a/d 이동',
  appliesTo: () => true,
  modify: (behavior) => behavior, // base 그대로
};

export const RULES: readonly Rule[] = [rule1];
