import type { Rule } from '../rules/RuleEngine';

/**
 * RoundBanner — 라운드 전환 시 화면 중앙에 잠깐 표시(텀). "ROUND N" +
 * 새로 추가된 룰(번호·색 스와치·라벨). 블라인드 모드는 룰 내용을 가리고
 * 라운드 번호만 보여준다(newRule=null).
 */
export class RoundBanner {
  private readonly root: HTMLDivElement;
  private readonly roundEl: HTMLDivElement;
  private readonly ruleEl: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:18px',
      'pointer-events:none',
      'font-family:system-ui,sans-serif',
      'color:#222',
      'z-index:8',
    ].join(';');

    this.roundEl = document.createElement('div');
    this.roundEl.style.cssText = 'font:800 64px/1 system-ui,sans-serif;letter-spacing:3px;';

    this.ruleEl = document.createElement('div');
    this.ruleEl.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:10px',
      'padding:10px 18px',
      'border:2px solid #222',
      'border-radius:999px',
      'background:#fff',
      'font:600 20px/1 system-ui,sans-serif',
    ].join(';');

    this.root.append(this.roundEl, this.ruleEl);
    document.body.appendChild(this.root);
    this.hide();
  }

  /** newRule=null 이면 라운드 번호만(블라인드 / 새 룰 없는 라운드). */
  show(round: number, newRule: Rule | null): void {
    this.roundEl.textContent = `ROUND ${round}`;

    this.ruleEl.replaceChildren();
    if (newRule) {
      const tag = document.createElement('span');
      tag.textContent = `새 룰 ${newRule.id}`;
      tag.style.cssText = 'font-weight:800;color:#444;';

      this.ruleEl.appendChild(tag);

      if (typeof newRule.targetColor === 'string') {
        const swatch = document.createElement('span');
        swatch.style.cssText =
          'width:18px;height:18px;border-radius:4px;border:1px solid #222;flex:0 0 18px;';
        swatch.style.background = newRule.targetColor;
        this.ruleEl.appendChild(swatch);
      }

      const label = document.createElement('span');
      label.textContent = newRule.label;
      this.ruleEl.appendChild(label);
      this.ruleEl.style.display = 'flex';
    } else {
      this.ruleEl.style.display = 'none';
    }

    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
