import type { Difficulty } from '../core/difficulty';
import type { LocalEntry } from './types';

/**
 * localBoard — 모드별 개인 top5 (브라우저 localStorage).
 * 이름/코멘트 없이 점수와 시각만 기록한다(설계: 로컬은 "내 최고 기록과 그 시간").
 * 글로벌(Firestore)과 독립 — config 없이도 항상 동작한다.
 */

const TOP_N = 5;
const KEY_PREFIX = 'ruleadd.local.';

function key(mode: Difficulty): string {
  return KEY_PREFIX + mode;
}

/** 모드의 개인 top5(점수 내림차순). 저장 없거나 파싱 실패 시 빈 배열. */
export function getLocalTop(mode: Difficulty): LocalEntry[] {
  try {
    const raw = localStorage.getItem(key(mode));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e): e is LocalEntry => typeof e?.score === 'number' && typeof e?.at === 'number')
      .slice(0, TOP_N);
  } catch {
    return [];
  }
}

/**
 * 점수 1건 제출 → 갱신된 top5 반환. 동점이면 기존 기록이 위(새 기록이 아래).
 * 반환된 배열에서 `at === justAt` 인 항목이 이번에 새로 들어온 기록이다.
 */
export function submitLocal(mode: Difficulty, score: number, at: number): LocalEntry[] {
  const list = getLocalTop(mode);
  list.push({ score, at });
  // 안정 정렬: 동점은 push 순서 유지 → 기존 기록이 새 기록보다 앞.
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, TOP_N);
  try {
    localStorage.setItem(key(mode), JSON.stringify(top));
  } catch {
    // quota 초과 / 사생활 모드 — 저장 실패해도 메모리 결과는 반환.
  }
  return top;
}
