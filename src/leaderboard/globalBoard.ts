import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Difficulty } from '../core/difficulty';
import { t } from '../i18n';
import { db, isGlobalEnabled } from './firebase';
import type { GlobalEntry } from './types';

/**
 * globalBoard — 모드별 전체 top10 (Firestore).
 * 컬렉션 경로: leaderboards/{mode}/scores (서브컬렉션 → 단일 필드 정렬, 인덱스 자동).
 * config 없으면 모든 호출이 무해한 폴백(빈 배열 / no-op)으로 동작한다.
 */

export const TOP_N = 10;
export const NAME_MAX = 12;
export const COMMENT_MAX = 100;

export { isGlobalEnabled };

function scoresCol(mode: Difficulty) {
  // isGlobalEnabled 가 true 인 경로에서만 호출 → db non-null 보장.
  return collection(db!, 'leaderboards', mode, 'scores');
}

/** 모드의 글로벌 top10 조회(점수 내림차순). 오프라인이면 빈 배열. 네트워크 실패는 throw. */
export async function fetchGlobalTop(mode: Difficulty): Promise<GlobalEntry[]> {
  if (!isGlobalEnabled || !db) return [];
  const snap = await getDocs(query(scoresCol(mode), orderBy('score', 'desc'), limit(TOP_N)));
  return snap.docs.map((d) => {
    const data = d.data();
    const ts = data.at instanceof Timestamp ? data.at : null;
    return {
      score: typeof data.score === 'number' ? data.score : 0,
      name: typeof data.name === 'string' ? data.name : '',
      comment: typeof data.comment === 'string' ? data.comment : '',
      at: ts ? ts.toMillis() : null,
    };
  });
}

/** 주어진 점수가 현재 보드 기준 top10 진입 자격인지. board 는 fetchGlobalTop 결과. */
export function qualifies(score: number, board: GlobalEntry[]): boolean {
  if (score <= 0) return false;
  if (board.length < TOP_N) return true;
  const last = board[board.length - 1];
  return last ? score > last.score : true;
}

/** 글로벌 제출 — 이름/코멘트는 최대 길이로 자른다. 오프라인이면 no-op. */
export async function submitGlobal(
  mode: Difficulty,
  score: number,
  name: string,
  comment: string,
): Promise<void> {
  if (!isGlobalEnabled || !db) return;
  await addDoc(scoresCol(mode), {
    score,
    name: name.trim().slice(0, NAME_MAX) || t('anon'),
    comment: comment.trim().slice(0, COMMENT_MAX),
    at: serverTimestamp(),
  });
}
