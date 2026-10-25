// 画面に出すイラスト（SVG の文字列）。線の少ない、簡単な絵にしてある。

const WATER = '#2a7fd4';
const IRON = '#8a98a6';
const INK = '#334';

// 蛇口。開いているときは水が出る。
export function faucetIcon(open) {
  const drops = open
    ? `<path d="M20 25 V31" stroke="${WATER}" stroke-width="3" stroke-linecap="round"/>
       <path class="drop" d="M20 31 Q17 35 20 37 Q23 35 20 31 Z" fill="${WATER}"/>`
    : '';
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <rect x="16" y="3" width="8" height="10" rx="2" fill="${IRON}"/>
    <rect x="8" y="12" width="24" height="7" rx="3.5" fill="${IRON}"/>
    <path d="M20 19 V25" stroke="${open ? WATER : IRON}" stroke-width="4"/>
    ${drops}
  </svg>`;
}

// 花。水が届くと咲き、届かないとしおれる。
export function flowerIcon(bloom) {
  const petal = bloom ? '#ff8fb1' : '#c8c2b8';
  const petals = [
    [20, 10], [29, 16], [26, 27], [14, 27], [11, 16],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${petal}"/>`)
    .join('');
  const stem = bloom ? '#5ba55b' : '#9b9488';
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M20 26 V38" stroke="${stem}" stroke-width="3"/>
    ${bloom ? petals : `<path d="M20 26 Q12 22 10 30" stroke="${stem}" stroke-width="3" fill="none"/>`}
    <circle cx="20" cy="19" r="${bloom ? 4.5 : 3.5}" fill="${bloom ? '#ffd23f' : '#a39c90'}"/>
  </svg>`;
}

// 頑固おやじ。水がかかると怒り、かからなければ昼寝する。
export function oyajiIcon(angry) {
  const face = angry ? '#ff9a8a' : '#ffd9b0';
  const eyes = angry
    ? `<path d="M13 15 L18 17 M27 15 L22 17" stroke="${INK}" stroke-width="2"/>
       <circle cx="15.5" cy="20" r="1.6" fill="${INK}"/><circle cx="24.5" cy="20" r="1.6" fill="${INK}"/>`
    : `<path d="M13 20 Q15.5 22 18 20 M22 20 Q24.5 22 27 20" stroke="${INK}" stroke-width="2" fill="none"/>`;
  const mouth = angry
    ? `<path d="M15 30 Q20 26 25 30" stroke="${INK}" stroke-width="2" fill="none"/>`
    : `<path d="M16 28 Q20 32 24 28" stroke="${INK}" stroke-width="2" fill="none"/>`;
  const mark = angry ? `<text x="30" y="10" font-size="9" fill="#d64545">!</text>` : `<text x="29" y="10" font-size="8" fill="${INK}">z</text>`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M9 16 Q20 2 31 16 Z" fill="#ddd"/>
    <circle cx="20" cy="22" r="12" fill="${face}" stroke="${INK}" stroke-width="1.5"/>
    ${eyes}
    ${mouth}
    ${mark}
  </svg>`;
}

// 仕掛け（論理ゲート）。標準の記号に近い形にしてある。
export function gateIcon(type) {
  const shapes = {
    NOT: `<path d="M7 8 L27 20 L7 32 Z" fill="#fff"/><circle cx="31" cy="20" r="3.5" fill="#fff"/>`,
    AND: `<path d="M7 8 H20 A12 12 0 0 1 20 32 H7 Z" fill="#fff"/>`,
    OR: `<path d="M7 8 Q18 20 7 32 Q25 32 34 20 Q25 8 7 8 Z" fill="#fff"/>`,
    XOR: `<path d="M4 8 Q14 20 4 32" stroke="${INK}" stroke-width="2" fill="none"/>
          <path d="M8 8 Q18 20 8 32 Q26 32 35 20 Q26 8 8 8 Z" fill="#fff"/>`,
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true" class="gate">
    <g stroke="${INK}" stroke-width="2" stroke-linejoin="round">${shapes[type] ?? ''}</g>
  </svg>`;
}
