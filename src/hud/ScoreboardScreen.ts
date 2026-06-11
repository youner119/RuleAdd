import type { Difficulty } from '../core/difficulty';
import { fetchGlobalTop, isGlobalEnabled } from '../leaderboard/globalBoard';
import { MODE_LABELS } from '../leaderboard/types';
import type { GlobalEntry } from '../leaderboard/types';

/**
 * ScoreboardScreen — 메인화면에서 진입하는 전체 점수판(전체 TOP 10, 글로벌).
 * 가로 모드 탭(쉬움/보통/어려움/블라인드/4×4)을 클릭하면 해당 모드의
 * 전체 top10 표로 갈아끼운다. StartScreen 위에 뜨는 오버레이이며 뒤로 가면 닫힌다.
 * config 없으면(오프라인) 안내만 표시한다.
 */

const MODES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'blind', '4x4'];

export class ScoreboardScreen {
  private readonly root: HTMLDivElement;
  private readonly tabsRow: HTMLDivElement;
  private readonly tableWrap: HTMLDivElement;
  private readonly tabButtons = new Map<Difficulty, HTMLButtonElement>();
  private current: Difficulty = 'normal';
  /** 탭 빠르게 전환 시 늦게 온 응답이 덮어쓰지 않도록 하는 토큰. */
  private loadToken = 0;

  constructor(mount: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'gap:20px',
      'padding:48px 24px',
      'box-sizing:border-box',
      'background:rgba(255,255,255,0.96)',
      'font-family:system-ui,sans-serif',
      'color:#222',
      'user-select:none',
      'z-index:15',
    ].join(';');

    // 헤더: 뒤로 버튼 + 제목.
    const header = document.createElement('div');
    header.style.cssText =
      'position:relative;width:100%;max-width:640px;display:flex;align-items:center;justify-content:center;';
    const back = document.createElement('button');
    back.textContent = '← 뒤로';
    back.style.cssText = [
      'position:absolute',
      'left:0',
      'padding:8px 16px',
      'border:2px solid #222',
      'border-radius:8px',
      'background:#fff',
      'font:700 14px/1 system-ui,sans-serif',
      'color:#222',
      'cursor:pointer',
    ].join(';');
    back.addEventListener('click', () => this.hide());
    const title = document.createElement('div');
    title.textContent = '점수판';
    title.style.cssText = 'font:800 30px/1 system-ui,sans-serif;letter-spacing:2px;';
    header.append(back, title);

    // 모드 탭.
    this.tabsRow = document.createElement('div');
    this.tabsRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;';
    for (const mode of MODES) {
      const btn = document.createElement('button');
      btn.textContent = MODE_LABELS[mode];
      btn.style.cssText = this.tabCss(false);
      btn.addEventListener('click', () => this.selectMode(mode));
      this.tabButtons.set(mode, btn);
      this.tabsRow.appendChild(btn);
    }

    // 표 영역.
    this.tableWrap = document.createElement('div');
    this.tableWrap.style.cssText = [
      'width:100%',
      'max-width:640px',
      'min-height:300px',
      'padding:18px 22px',
      'box-sizing:border-box',
      'border:2px solid #222',
      'border-radius:16px',
      'background:#fff',
      'box-shadow:0 8px 40px rgba(0,0,0,0.10)',
    ].join(';');

    this.root.append(header, this.tabsRow, this.tableWrap);
    mount.appendChild(this.root);
  }

  /** 점수판을 연다(기본 모드 표 로드). */
  open(): void {
    this.root.style.display = 'flex';
    this.selectMode(this.current);
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.loadToken++; // 진행 중 응답 무효화.
    this.root.remove();
  }

  /** 탭 선택 → active 갱신 + 해당 모드 top10 비동기 로드. */
  private selectMode(mode: Difficulty): void {
    this.current = mode;
    for (const [m, btn] of this.tabButtons) {
      btn.style.cssText = this.tabCss(m === mode);
    }

    if (!isGlobalEnabled) {
      this.renderNote('오프라인 — 전체 랭킹이 비활성화되어 있습니다.');
      return;
    }

    this.renderNote('불러오는 중…');
    const token = ++this.loadToken;
    fetchGlobalTop(mode)
      .then((entries) => {
        if (token === this.loadToken) this.renderTable(entries);
      })
      .catch(() => {
        if (token === this.loadToken) this.renderNote('불러오기 실패 — 잠시 후 다시 시도하세요.');
      });
  }

  /** 전체 top10 표 렌더. */
  private renderTable(entries: GlobalEntry[]): void {
    if (entries.length === 0) {
      this.renderNote('아직 기록 없음 — 1등이 되세요!');
      return;
    }

    const table = document.createElement('div');
    table.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    table.appendChild(this.headerRow());
    entries.forEach((e, i) => table.appendChild(this.dataRow(i + 1, e)));
    this.tableWrap.replaceChildren(table);
  }

  private headerRow(): HTMLDivElement {
    const row = this.gridRow();
    row.style.cssText += ';border-bottom:2px solid #222;padding-bottom:6px;margin-bottom:4px;';
    const cells = ['#', '이름', '점수', '코멘트'];
    const aligns = ['right', 'left', 'right', 'left'];
    cells.forEach((text, i) => {
      const c = document.createElement('span');
      c.textContent = text;
      c.style.cssText = `font:700 12px/1.3 system-ui,sans-serif;color:#888;text-align:${aligns[i]};`;
      row.appendChild(c);
    });
    return row;
  }

  private dataRow(rank: number, e: GlobalEntry): HTMLDivElement {
    const row = this.gridRow();
    row.style.cssText += ';padding:7px 0;border-bottom:1px solid #eee;';

    const rankEl = document.createElement('span');
    rankEl.textContent = String(rank);
    rankEl.style.cssText = `font:700 14px/1.3 system-ui,sans-serif;color:${rank <= 3 ? '#222' : '#aaa'};text-align:right;`;

    const nameEl = document.createElement('span');
    nameEl.textContent = e.name;
    nameEl.style.cssText =
      'font:600 14px/1.3 system-ui,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const scoreEl = document.createElement('span');
    scoreEl.textContent = e.score.toLocaleString();
    scoreEl.style.cssText = 'font:800 14px/1.3 system-ui,sans-serif;text-align:right;';

    const commentEl = document.createElement('span');
    commentEl.textContent = e.comment;
    commentEl.style.cssText =
      'font:400 13px/1.3 system-ui,sans-serif;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    row.append(rankEl, nameEl, scoreEl, commentEl);
    return row;
  }

  private gridRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText =
      'display:grid;grid-template-columns:36px minmax(80px,1fr) auto minmax(0,1.6fr);align-items:baseline;gap:14px;';
    return row;
  }

  private renderNote(text: string): void {
    const note = document.createElement('div');
    note.textContent = text;
    note.style.cssText =
      'display:flex;align-items:center;justify-content:center;min-height:260px;font:400 15px/1.4 system-ui,sans-serif;color:#aaa;text-align:center;';
    this.tableWrap.replaceChildren(note);
  }

  private tabCss(active: boolean): string {
    return [
      'padding:9px 18px',
      'border:2px solid #222',
      'border-radius:8px',
      active ? 'background:#222' : 'background:#fff',
      active ? 'color:#fff' : 'color:#222',
      'font:700 14px/1 system-ui,sans-serif',
      'cursor:pointer',
      'transition:background 0.12s',
    ].join(';');
  }
}
