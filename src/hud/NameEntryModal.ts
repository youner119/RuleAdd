import { t } from '../i18n';
import { COMMENT_MAX, NAME_MAX } from '../leaderboard/globalBoard';

const LAST_NAME_KEY = 'ruleadd.lastName';

/**
 * NameEntryModal — 전체 TOP 10 진입 시 이름+코멘트 입력 모달.
 * 게임오버 위(z-index 30)에 뜬다. 마지막에 쓴 이름을 기억해 다음 기본값으로 채운다.
 * 제출하면 onSubmit(name, comment), 건너뛰면 onSkip. 제출/건너뛰기 후 자동으로 닫힌다.
 */
export class NameEntryModal {
  private readonly root: HTMLDivElement;
  private readonly rankLabel: HTMLDivElement;
  private readonly nameInput: HTMLInputElement;
  private readonly commentInput: HTMLTextAreaElement;
  private onSubmit: (name: string, comment: string) => void = () => {};
  private onSkip: () => void = () => {};

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'background:rgba(255,255,255,0.6)',
      'font-family:system-ui,sans-serif',
      'color:#222',
      'z-index:30',
    ].join(';');

    const win = document.createElement('div');
    win.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'gap:12px',
      'width:320px',
      'padding:28px 30px',
      'border:2px solid #222',
      'border-radius:16px',
      'background:#fff',
      'box-shadow:0 8px 40px rgba(0,0,0,0.16)',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = t('nameEntryTitle');
    title.style.cssText = 'font:800 22px/1.1 system-ui,sans-serif;';

    this.rankLabel = document.createElement('div');
    this.rankLabel.style.cssText = 'font:600 14px/1.3 system-ui,sans-serif;color:#888;';

    this.nameInput = document.createElement('input');
    this.nameInput.maxLength = NAME_MAX;
    this.nameInput.placeholder = t('namePlaceholder', { max: NAME_MAX });
    this.nameInput.style.cssText = this.fieldCss();

    this.commentInput = document.createElement('textarea');
    this.commentInput.maxLength = COMMENT_MAX;
    this.commentInput.rows = 2;
    this.commentInput.placeholder = t('commentPlaceholder', { max: COMMENT_MAX });
    this.commentInput.style.cssText = this.fieldCss() + ';resize:none;';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:10px;margin-top:4px;';
    buttons.append(
      this.button(t('submit'), true, () => this.submit()),
      this.button(t('skip'), false, () => this.skip()),
    );

    win.append(title, this.rankLabel, this.nameInput, this.commentInput, buttons);
    this.root.appendChild(win);
    document.body.appendChild(this.root);

    // Enter(이름 칸) = 등록. Esc = 건너뛰기.
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.skip();
    });
  }

  /** 모달을 띄운다. rank 는 1-based 진입 순위. */
  show(
    rank: number,
    onSubmit: (name: string, comment: string) => void,
    onSkip: () => void,
  ): void {
    this.onSubmit = onSubmit;
    this.onSkip = onSkip;
    this.rankLabel.textContent = t('nameEntryRank', { rank });
    this.nameInput.value = readLastName();
    this.commentInput.value = '';
    this.root.style.display = 'flex';
    this.nameInput.focus();
    this.nameInput.select();
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  private submit(): void {
    const name = this.nameInput.value.trim() || t('anon');
    const comment = this.commentInput.value.trim();
    writeLastName(name);
    this.hide();
    this.onSubmit(name, comment);
  }

  private skip(): void {
    this.hide();
    this.onSkip();
  }

  private fieldCss(): string {
    return [
      'padding:10px 12px',
      'border:1.5px solid #ccc',
      'border-radius:8px',
      'font:400 15px/1.3 system-ui,sans-serif',
      'color:#222',
      'outline:none',
    ].join(';');
  }

  private button(text: string, primary: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = [
      'flex:1',
      'padding:10px 0',
      'border:2px solid #222',
      'border-radius:8px',
      primary ? 'background:#222' : 'background:#fff',
      primary ? 'color:#fff' : 'color:#222',
      'font:700 15px/1 system-ui,sans-serif',
      'cursor:pointer',
    ].join(';');
    btn.addEventListener('click', onClick);
    return btn;
  }

  dispose(): void {
    this.root.remove();
  }
}

function readLastName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLastName(name: string): void {
  try {
    localStorage.setItem(LAST_NAME_KEY, name);
  } catch {
    // 저장 실패 무시.
  }
}
