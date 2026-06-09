import { CELL_COUNT } from './lane';

/**
 * 벽 패턴 생성 — blocked[] (true=막힘, false=gap).
 *
 * 보장: ≥1칸 gap + ≥1칸 막힘 (전부 막힘/전부 뚫림 둘 다 방지).
 * gap 개수는 [minGaps, maxGaps] 무작위. 그리드 크기에 맞춰 조정 가능하게
 * 파라미터화 — v1 4×1 = 1칸 고정, 4×4 확장 시 maxGaps=2 로 호출(예약).
 *
 * 라운드 무관(동일 분포): 스펙상 난이도는 룰 누적에서만 오고 벽 패턴은
 * 라운드가 올라도 더 어려워지지 않는다.
 */

/** v1(4×1) gap 개수 범위 — 1칸 고정. */
const MIN_GAPS = 1;
const MAX_GAPS = 1;

export interface PatternOptions {
  /** 칸 수 (기본 CELL_COUNT=4). 4×4 확장 시 16 등. */
  cellCount?: number;
  /** 최소 gap (기본 1). */
  minGaps?: number;
  /** 최대 gap (기본 2; cellCount-1 로 clamp 되어 ≥1칸 막힘 보장). */
  maxGaps?: number;
}

export function generateWallPattern(opts: PatternOptions = {}): boolean[] {
  const cellCount = opts.cellCount ?? CELL_COUNT;
  const lo = Math.max(1, opts.minGaps ?? MIN_GAPS);
  const hi = Math.min(opts.maxGaps ?? MAX_GAPS, cellCount - 1); // 최소 1칸은 막힘
  const maxGaps = Math.max(lo, hi);
  const gapCount = lo + Math.floor(Math.random() * (maxGaps - lo + 1));

  // 전부 막힘에서 시작 → gapCount 칸을 무작위로 뚫는다.
  const blocked = new Array<boolean>(cellCount).fill(true);
  const idx = [...Array(cellCount).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = idx[i] as number;
    idx[i] = idx[j] as number;
    idx[j] = a;
  }
  for (let i = 0; i < gapCount; i++) blocked[idx[i] as number] = false;
  return blocked;
}

/** 칸 인덱스를 wrap(순환)해 [0, cellCount) 로 — 끝에서 바깥으로 가면 반대쪽 끝. */
export function wrapCell(cell: number, cellCount: number): number {
  return ((cell % cellCount) + cellCount) % cellCount;
}

/**
 * 블록 화살표 구성(룰2) — 각 블록에 방향(-1/0/+1)을 랜덤 부여하되,
 * 이동 후 최종 칸이 모두 distinct(겹침 0)가 되도록 만든다 → 항상 명확한
 * 정답(최종 gap)이 존재. 이동은 wrap: 오른쪽 끝이 오른쪽으로 가면 제일
 * 왼쪽으로, 왼쪽 끝이 왼쪽으로 가면 제일 오른쪽으로 순환한다.
 *
 * cells = 블록들의 현재 칸(같은 순서로 dir 반환). 실패 시 전부 정지(유효).
 */
export function pickArrows(cells: readonly number[], cellCount: number): number[] {
  for (let t = 0; t < 24; t++) {
    const dirs = cells.map(() => Math.floor(Math.random() * 3) - 1); // -1/0/+1
    const finals = cells.map((c, i) => wrapCell(c + (dirs[i] as number), cellCount));
    if (new Set(finals).size === finals.length) return dirs; // 겹침 없음
  }
  return cells.map(() => 0);
}
