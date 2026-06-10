/**
 * pattern — 칸 인덱스 유틸.
 *
 * 세트(벽 패턴 + 행동) 생성은 `setgen.ts`(통합 생성기)가 담당한다. 여기에는
 * 셀 인덱스 순환(wrap)만 남는다 — 끝에서 바깥으로 가면 반대쪽 끝(토러스).
 */

/** 칸 인덱스를 wrap(순환)해 [0, cellCount) 로 — 끝에서 바깥으로 가면 반대쪽 끝. */
export function wrapCell(cell: number, cellCount: number): number {
  return ((cell % cellCount) + cellCount) % cellCount;
}
