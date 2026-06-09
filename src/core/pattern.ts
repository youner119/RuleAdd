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
