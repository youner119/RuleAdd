import type { Difficulty } from '../core/difficulty';
import { modeLabel, t } from '../i18n';
import type { GlobalEntry, LocalEntry } from '../leaderboard/types';

/**
 * ScoreboardPanel — 게임오버 시 중앙 창 옆에 세우는 기록판.
 * 위: 전체 TOP 10(글로벌/Firestore), 아래: 내 기록 TOP 5(개인/localStorage).
 * GameOverScreen 의 옆 슬롯에 마운트되며(position 없는 일반 블록),
 * 글로벌은 비동기 로드라 로딩/오프라인/목록 3상태를 가진다.
 */
export class ScoreboardPanel {
  private readonly root: HTMLDivElement;
  private readonly heading: HTMLDivElement;
  private readonly globalBody: HTMLDivElement;
  private readonly localBody: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'gap:14px',
      'width:300px',
      'max-height:80vh',
      'overflow-y:auto',
      'padding:20px 22px',
      'border:2px solid #222',
      'border-radius:16px',
      'background:#fff',
      'box-shadow:0 8px 40px rgba(0,0,0,0.12)',
      'font-family:system-ui,sans-serif',
      'color:#222',
    ].join(';');

    this.heading = document.createElement('div');
    this.heading.style.cssText = 'font:800 18px/1 system-ui,sans-serif;letter-spacing:1px;';

    this.globalBody = document.createElement('div');
    this.localBody = document.createElement('div');

    this.root.append(
      this.heading,
      this.section(t('globalTop10'), this.globalBody),
      this.section(t('myTop5'), this.localBody),
    );
  }

  /** GameOverScreen 옆 슬롯에 붙일 DOM. */
  get element(): HTMLDivElement {
    return this.root;
  }

  /** 모드 라벨로 헤더 갱신 + 양쪽 본문 비우기(새 게임오버 진입 시). */
  setMode(mode: Difficulty): void {
    this.heading.textContent = t('modeRecords', { mode: modeLabel(mode) });
    this.globalBody.replaceChildren();
    this.localBody.replaceChildren();
  }

  /** 글로벌: 로딩 중. */
  setGlobalLoading(): void {
    this.globalBody.replaceChildren(this.note(t('loading')));
  }

  /** 글로벌: config 없음(오프라인). */
  setGlobalOffline(): void {
    this.globalBody.replaceChildren(this.note(t('offline')));
  }

  /** 글로벌: 조회 실패. */
  setGlobalError(): void {
    this.globalBody.replaceChildren(this.note(t('loadFailed')));
  }

  /** 글로벌 top10 렌더. highlightIndex 행은 이번에 새로 올린 기록(강조). */
  showGlobal(entries: GlobalEntry[], highlightIndex = -1): void {
    if (entries.length === 0) {
      this.globalBody.replaceChildren(this.note(t('noRecordsGlobal')));
      return;
    }
    const rows = entries.map((e, i) =>
      this.row(i + 1, e.name, e.score, e.comment, i === highlightIndex),
    );
    this.globalBody.replaceChildren(...rows);
  }

  /** 개인 top5 렌더. highlightAt 과 at 이 같은 행을 강조(이번 기록). */
  showLocal(entries: LocalEntry[], highlightAt = -1): void {
    if (entries.length === 0) {
      this.localBody.replaceChildren(this.note(t('noRecords')));
      return;
    }
    const rows = entries.map((e, i) =>
      this.row(i + 1, fmtDate(e.at), e.score, '', e.at === highlightAt),
    );
    this.localBody.replaceChildren(...rows);
  }

  // --- 내부 빌더 ---

  private section(title: string, body: HTMLDivElement): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    const cap = document.createElement('div');
    cap.textContent = title;
    cap.style.cssText =
      'font:700 12px/1 system-ui,sans-serif;letter-spacing:1px;color:#888;margin-bottom:2px;';
    body.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    wrap.append(cap, body);
    return wrap;
  }

  /** 한 줄: [순위] [이름/날짜] [점수] (+코멘트). highlight 면 옅은 강조 배경. */
  private row(
    rank: number,
    label: string,
    score: number,
    comment: string,
    highlight: boolean,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:grid',
      'grid-template-columns:20px 1fr auto',
      'align-items:baseline',
      'gap:8px',
      'padding:4px 6px',
      'border-radius:6px',
      highlight ? 'background:#fff4c2' : 'background:transparent',
    ].join(';');

    const rankEl = document.createElement('span');
    rankEl.textContent = String(rank);
    rankEl.style.cssText = 'font:700 12px/1.3 system-ui,sans-serif;color:#aaa;text-align:right;';

    const nameEl = document.createElement('span');
    nameEl.textContent = label;
    nameEl.style.cssText =
      'font:600 13px/1.3 system-ui,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const scoreEl = document.createElement('span');
    scoreEl.textContent = score.toLocaleString();
    scoreEl.style.cssText = 'font:800 13px/1.3 system-ui,sans-serif;text-align:right;';

    row.append(rankEl, nameEl, scoreEl);

    if (comment) {
      const c = document.createElement('div');
      c.textContent = comment;
      c.style.cssText =
        'grid-column:2 / 4;font:400 11px/1.3 system-ui,sans-serif;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      row.appendChild(c);
    }
    return row;
  }

  private note(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'font:400 12px/1.4 system-ui,sans-serif;color:#aaa;padding:4px 6px;';
    return el;
  }
}

/** epoch ms → "M/D" 짧은 날짜(개인 기록 라벨용). */
function fmtDate(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
