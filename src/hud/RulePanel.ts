import type { Rule } from '../rules/RuleEngine';

/**
 * RulePanel — 우측 룰 패널(AC10). 현재 활성 룰을 번호 포함 리스트로 표시,
 * 최신(=최우선) 룰이 위(역순). 색 룰(3/4/5)은 색 스와치로 이번 런의
 * 색→룰 매핑을 알려준다. 블라인드 모드는 숨김(setVisible(false)).
 */
export class RulePanel {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLDivElement;

  constructor(visible: boolean) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'top:16px',
      'right:16px',
      'min-width:210px',
      'padding:12px 14px',
      'border:2px solid #222',
      'border-radius:10px',
      'background:rgba(255,255,255,0.9)',
      'font-family:system-ui,sans-serif',
      'color:#222',
      'user-select:none',
      'z-index:5',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'RULES';
    title.style.cssText =
      'font:700 13px/1 system-ui,sans-serif;letter-spacing:2px;color:#888;margin-bottom:8px;';

    this.list = document.createElement('div');
    this.list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    this.root.append(title, this.list);
    document.body.appendChild(this.root);
    this.setVisible(visible);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  /** 활성 룰로 갱신 — 최신(=최우선)이 위. */
  render(rules: readonly Rule[]): void {
    this.list.replaceChildren();
    for (let i = rules.length - 1; i >= 0; i--) {
      this.list.appendChild(this.makeRow(rules[i] as Rule));
    }
  }

  private makeRow(rule: Rule): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;font:400 14px/1.3 system-ui,sans-serif;';

    const num = document.createElement('span');
    num.textContent = String(rule.id);
    // 진행(동적) 룰은 id = 라운드(두 자리) — 폭 여유 있게.
    num.style.cssText = 'flex:0 0 20px;text-align:center;font-weight:700;color:#444;';

    const swatch = document.createElement('span');
    swatch.style.cssText =
      'flex:0 0 14px;width:14px;height:14px;border-radius:3px;border:1px solid #222;';
    if (typeof rule.targetColor === 'string') {
      swatch.style.background = rule.targetColor;
    } else {
      swatch.style.visibility = 'hidden'; // 정렬 위해 자리만 차지
    }

    const label = document.createElement('span');
    label.textContent = rule.label;
    label.style.cssText = 'flex:1 1 auto;';

    row.append(num, swatch, label);
    return row;
  }

  dispose(): void {
    this.root.remove();
  }
}
