// 画面に出すイラスト（SVG の文字列）。教育番組のような、太い線のコミカルな絵にしてある。
// 動き（伸び縮み、揺れ）は index.html の CSS で付ける。class 名はそのためのもの。

const INK = '#3a2e2a';
const WATER = '#1e9bff';
const LINE = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;

const svg = (body, viewBox = '0 0 40 40', cls = '') =>
  `<svg viewBox="${viewBox}" aria-hidden="true" class="${cls}" overflow="visible">${body}</svg>`;

// 蛇口。開いているときは水が勢いよく出る。手で回せる蛇口（switchable）は取っ手が黄色。
export function faucetIcon(open, switchable = false) {
  const water = open
    ? `<path class="stream" d="M18 27 Q17 33 15 38 M22 27 Q23 33 25 38" stroke="${WATER}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
       <circle class="drop" cx="20" cy="33" r="3" fill="${WATER}" ${LINE} stroke-width="1.2"/>`
    : '';
  return svg(`
    ${water}
    <g class="handle"><rect x="11" y="2" width="18" height="6" rx="3" fill="${switchable ? '#ffc93c' : '#ff5a5f'}" ${LINE}/>
    <rect x="18" y="7" width="4" height="5" fill="#c7ced6" ${LINE}/></g>
    <path d="M6 12 H28 Q34 12 34 18 V20 H26 V19 H6 Z" fill="#c7ced6" ${LINE}/>
    <rect x="15" y="18" width="10" height="9" rx="2" fill="#c7ced6" ${LINE}/>
    <circle cx="11" cy="15.5" r="1.3" fill="${INK}"/><circle cx="16" cy="15.5" r="1.3" fill="${INK}"/>
  `);
}

// 花。mood: 'bud'（つぼみ） 'bloom'（咲いた） 'sun'（ヒマワリ） 'wilt'（しおれた） 'mummy'（干からびた）
export function flowerIcon(mood) {
  const stem = mood === 'wilt' || mood === 'mummy' ? '#a99b6e' : '#4cbb5a';
  const leaves = `<path d="M20 30 Q11 26 9 31 Q14 35 20 33 Z M20 32 Q29 28 31 33 Q26 37 20 35 Z" fill="${stem}" ${LINE}/>`;
  const happy = `<path d="M16.5 18 Q17.5 16.5 18.5 18 M21.5 18 Q22.5 16.5 23.5 18" ${LINE} fill="none" stroke-width="1.6"/>
                 <path d="M17 20.5 Q20 23.5 23 20.5" ${LINE} fill="#ff6b81" stroke-width="1.4"/>`;
  if (mood === 'bud') {
    return svg(`<path d="M20 38 V24" stroke="${stem}" stroke-width="3.5"/>${leaves}
      <path d="M20 9 Q28 16 25 24 H15 Q12 16 20 9 Z" fill="#ff8fb1" ${LINE}/>
      <path d="M17.5 19 H19 M21 19 H22.5" ${LINE} stroke-width="1.5"/>`, '0 0 40 40', 'flower bud');
  }
  if (mood === 'wilt' || mood === 'mummy') {
    const bandage = mood === 'mummy'
      ? `<path d="M7 24 L19 20 M8 28 L20 24 M10 21 L17 30" stroke="#fff" stroke-width="2.5"/>`
      : '';
    return svg(`<path d="M20 38 V27 Q20 18 12 20" stroke="${stem}" stroke-width="3.5" fill="none" stroke-linecap="round"/>${leaves}
      <circle cx="11" cy="25" r="7" fill="#c9b8a3" ${LINE}/>
      ${bandage}
      <path d="M8 23 L10 25 M10 23 L8 25 M12.5 23 L14.5 25 M14.5 23 L12.5 25" ${LINE} stroke-width="1.3"/>
      <path d="M9 28.5 Q11 27 13 28.5" ${LINE} fill="none" stroke-width="1.3"/>`, '0 0 40 40', `flower ${mood}`);
  }
  if (mood === 'sun') {
    const petals = Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      const x = 20 + Math.cos(a) * 10;
      const y = 18 + Math.sin(a) * 10;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.2" ry="2.4" transform="rotate(${i * 30} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#ffc93c" ${LINE} stroke-width="1.6"/>`;
    }).join('');
    return svg(`<path d="M20 38 V26" stroke="${stem}" stroke-width="4"/>${leaves}${petals}
      <circle cx="20" cy="18" r="7.5" fill="#a0612d" ${LINE}/>${happy}`, '0 0 40 40', 'flower sun');
  }
  const petals = [0, 60, 120, 180, 240, 300]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      return `<circle cx="${(20 + Math.cos(a) * 8).toFixed(1)}" cy="${(18 + Math.sin(a) * 8).toFixed(1)}" r="5.5" fill="#ff8fb1" ${LINE} stroke-width="1.8"/>`;
    })
    .join('');
  return svg(`<path d="M20 38 V26" stroke="${stem}" stroke-width="3.5"/>${leaves}${petals}
    <circle cx="20" cy="18" r="6.5" fill="#ffd23f" ${LINE}/>${happy}`, '0 0 40 40', 'flower bloom');
}

// 頑固おやじ。mood:
//   'sleep'（昼寝） 'angry'（怒る） 'steam'（湯気） 'giant'（紫になって激怒）
//   'enka'（演歌） 'daibutsu'（大仏） 'happy'（ちょっと喜ぶ） 'seiza'（説教） 'clap'（拍手）
export function oyajiIcon(mood) {
  const faces = {
    sleep: '#ffd9b0', clap: '#ffd9b0', happy: '#ffd9b0', enka: '#ffc4a8',
    angry: '#ff7b6b', steam: '#f0506e', giant: '#a565c9', seiza: '#ff9a8a', daibutsu: '#e8b93a',
  };
  const face = faces[mood] ?? faces.sleep;
  const calm = ['sleep', 'clap', 'enka', 'daibutsu'].includes(mood);
  const eyes = calm
    ? `<path d="M12 20 Q14.5 22.5 17 20 M23 20 Q25.5 22.5 28 20" ${LINE} fill="none"/>`
    : mood === 'happy'
      ? `<circle cx="14.5" cy="20" r="1.6" fill="${INK}"/><circle cx="25.5" cy="20" r="1.6" fill="${INK}"/>
         <ellipse cx="11" cy="25" rx="2.5" ry="1.5" fill="#ff8fb1" opacity="0.8"/><ellipse cx="29" cy="25" rx="2.5" ry="1.5" fill="#ff8fb1" opacity="0.8"/>`
      : `<circle cx="14.5" cy="20.5" r="3" fill="#fff" ${LINE} stroke-width="1.4"/><circle cx="25.5" cy="20.5" r="3" fill="#fff" ${LINE} stroke-width="1.4"/>
         <circle cx="14.5" cy="20.5" r="1.1" fill="${INK}"/><circle cx="25.5" cy="20.5" r="1.1" fill="${INK}"/>`;
  const brows = calm || mood === 'happy'
    ? `<path d="M11 16 H17 M23 16 H29" ${LINE} stroke-width="2.6"/>`
    : `<path d="M10 14 L18 17.5 M30 14 L22 17.5" ${LINE} stroke-width="3"/>`;
  const mouths = {
    sleep: `<ellipse cx="20" cy="31" rx="2" ry="1.3" fill="#a33"/>`,
    clap: `<path d="M16 30 Q20 34 24 30" ${LINE} fill="#a33"/>`,
    happy: `<path d="M17.5 31 Q20 32.5 22.5 31" ${LINE} fill="none"/>`,
    enka: `<ellipse cx="20" cy="31" rx="2.6" ry="3" fill="#a33" ${LINE} stroke-width="1.4"/>`,
    daibutsu: `<path d="M17 31 H23" ${LINE}/>`,
    seiza: `<path d="M15.5 31 H24.5" ${LINE} stroke-width="2.6"/>`,
  };
  const mouth = mouths[mood] ?? `<path d="M13.5 29 Q20 26 26.5 29 Q24 36 20 36 Q16 36 13.5 29 Z" fill="#a33" ${LINE}/>
    <path d="M15.5 29.5 H24.5" stroke="#fff" stroke-width="1.6"/>`;
  const mustache = `<path d="M11.5 28 Q15.5 23.2 20 25.6 Q24.5 23.2 28.5 28 Q24.5 30 20 28.2 Q15.5 30 11.5 28 Z" fill="#fafafa" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
  const hair = mood === 'daibutsu'
    ? Array.from({ length: 9 }, (_, i) => `<circle cx="${9 + i * 2.75}" cy="${9.5 + Math.abs(i - 4) * 0.9}" r="1.8" fill="#4a4fa3" ${LINE} stroke-width="0.9"/>`).join('') +
      `<circle cx="20" cy="15" r="1" fill="#ff5a5f"/>`
    : `<path d="M7 21 Q5 14 9 12 M33 21 Q35 14 31 12" stroke="#ddd" stroke-width="4" stroke-linecap="round" fill="none"/>
       <path d="M18 7 Q19 4 21 6" ${LINE} fill="none" stroke-width="1.6"/>`;
  const extras = {
    sleep: `<circle class="snot" cx="23.5" cy="27" r="2.6" fill="#bfe6ff" stroke="${WATER}" stroke-width="1"/>
            <text class="zzz" x="31" y="9" font-size="8" font-weight="900" fill="${INK}">z</text>`,
    angry: `<path class="vein" d="M27 7 L31 9 M29 5 L29.5 10 M33 6 L30 11" stroke="#d61f2c" stroke-width="2" stroke-linecap="round"/>`,
    steam: `<g class="steam"><circle cx="9" cy="5" r="3.5" fill="#fff" ${LINE} stroke-width="1.2"/><circle cx="20" cy="1" r="4" fill="#fff" ${LINE} stroke-width="1.2"/><circle cx="31" cy="5" r="3.5" fill="#fff" ${LINE} stroke-width="1.2"/></g>`,
    giant: `<g class="steam"><circle cx="7" cy="5" r="4" fill="#fff" ${LINE} stroke-width="1.2"/><circle cx="20" cy="0" r="5" fill="#fff" ${LINE} stroke-width="1.2"/><circle cx="33" cy="5" r="4" fill="#fff" ${LINE} stroke-width="1.2"/></g>
            <path class="vein" d="M27 8 L31 10 M29 6 L29.5 11 M10 8 L13 11" stroke="#ff2" stroke-width="2" stroke-linecap="round"/>`,
    enka: `<rect x="28" y="28" width="3" height="10" rx="1.5" fill="#555" ${LINE} stroke-width="1"/><circle cx="29.5" cy="27" r="3" fill="#888" ${LINE} stroke-width="1.2"/>
           <text class="note" x="1" y="10" font-size="9" fill="${INK}">♪</text><text class="note" x="33" y="17" font-size="8" fill="${INK}">♫</text>`,
    daibutsu: `<circle class="halo" cx="20" cy="22" r="19" fill="none" stroke="#ffe27a" stroke-width="2.5" opacity="0.9"/>`,
    happy: `<path class="drip" d="M33 14 Q35 18 33 19 Q31 18 33 14 Z" fill="${WATER}"/>`,
    seiza: `<rect x="10.5" y="17.5" width="8" height="6" rx="2" fill="none" ${LINE} stroke-width="1.4"/><rect x="21.5" y="17.5" width="8" height="6" rx="2" fill="none" ${LINE} stroke-width="1.4"/><path d="M18.5 20 H21.5" ${LINE} stroke-width="1.4"/>`,
    clap: `<g class="hands"><ellipse cx="6" cy="33" rx="3.5" ry="4.5" fill="${face}" ${LINE} stroke-width="1.4"/><ellipse cx="34" cy="33" rx="3.5" ry="4.5" fill="${face}" ${LINE} stroke-width="1.4"/></g>`,
  };
  return svg(`
    <ellipse cx="20" cy="22" rx="14" ry="15" fill="${face}" ${LINE}/>
    ${hair}${brows}${eyes}
    <ellipse cx="20" cy="24.5" rx="2.6" ry="2.2" fill="${face}" ${LINE} stroke-width="1.6"/>
    ${mustache}${mouth}${extras[mood] ?? ''}
  `, '0 0 40 40', `oyaji ${mood}`);
}

// お星さま（打ち上げられたおやじのなれの果て）。
export function starIcon() {
  return svg(`<path d="M20 2 L25 14 L38 15 L28 24 L31 37 L20 30 L9 37 L12 24 L2 15 L15 14 Z" fill="#ffd23f" ${LINE}/>
    <path d="M15 20 Q17 22 19 20 M21 20 Q23 22 25 20" ${LINE} fill="none" stroke-width="1.5"/>
    <path d="M17 25 Q20 23 23 25" ${LINE} fill="none" stroke-width="1.5"/>`, '0 0 40 40', 'star');
}

// 仕掛け（論理ゲート）。形は標準の記号のまま、色と目を付けてキャラにしてある。
const GATE_COLORS = { NOT: '#ffb347', AND: '#7fc8ff', OR: '#8ee08e', XOR: '#ff9aa8' };

export function gateIcon(type) {
  if (type === 'DFF') return shishiodoshiIcon();
  const fill = GATE_COLORS[type] ?? '#fff';
  const shapes = {
    NOT: `<path d="M6 7 L27 20 L6 33 Z" fill="${fill}" ${LINE}/><circle cx="31" cy="20" r="3.5" fill="${fill}" ${LINE}/>`,
    AND: `<path d="M6 7 H19 A13 13 0 0 1 19 33 H6 Z" fill="${fill}" ${LINE}/>`,
    OR: `<path d="M6 7 Q17 20 6 33 Q25 33 35 20 Q25 7 6 7 Z" fill="${fill}" ${LINE}/>`,
    XOR: `<path d="M3 7 Q13 20 3 33" ${LINE} fill="none"/>
          <path d="M8 7 Q18 20 8 33 Q26 33 36 20 Q26 7 8 7 Z" fill="${fill}" ${LINE}/>`,
  };
  // NOT は「天野君」なので、すねた顔にする
  const face = type === 'NOT'
    ? `<path d="M10 17 L14 18.5 M16 17 L12.5 18.5" ${LINE} stroke-width="1.4"/><circle cx="11.5" cy="20.5" r="1.2" fill="${INK}"/><circle cx="15" cy="20.5" r="1.2" fill="${INK}"/>
       <path d="M11 25 Q13.5 23.5 16 25.5" ${LINE} fill="none" stroke-width="1.4"/>`
    : `<circle cx="14" cy="18" r="1.5" fill="${INK}"/><circle cx="20" cy="18" r="1.5" fill="${INK}"/>
       <path d="M14.5 23 Q17 25 19.5 23" ${LINE} fill="none" stroke-width="1.4"/>`;
  return svg(`${shapes[type] ?? ''}${face}`, '0 0 40 40', `gate ${type}`);
}

// 司会役のじょうろ。名前はまだ決めていない（仕様書「これから決めること」）。
export function hostIcon() {
  return svg(`
    <path d="M30 17 L39 9 L40 13 L32 22 Z" fill="#58c4b5" ${LINE}/>
    <path d="M8 13 Q2 13 2 21 Q2 27 8 27" fill="none" ${LINE} stroke-width="3"/>
    <rect x="7" y="12" width="25" height="22" rx="7" fill="#58c4b5" ${LINE}/>
    <circle cx="15" cy="21" r="2.2" fill="#fff" ${LINE} stroke-width="1"/><circle cx="24" cy="21" r="2.2" fill="#fff" ${LINE} stroke-width="1"/>
    <circle cx="15.4" cy="21.4" r="1" fill="${INK}"/><circle cx="24.4" cy="21.4" r="1" fill="${INK}"/>
    <path d="M16 27 Q19.5 30 23 27" ${LINE} fill="#ff6b81" stroke-width="1.5"/>
    <circle class="drop" cx="38" cy="16" r="1.6" fill="${WATER}"/>
  `, '0 0 40 40', 'host');
}

// ---------- 順序回路編 ----------

// ししおどし（DFF）。竹の筒に水をため、カコンと傾いて流す。
// full が true のときは、筒に水がたまっている。
export function shishiodoshiIcon(full = false) {
  return svg(`
    <path d="M6 36 Q20 30 34 36" fill="#b9c2cc" ${LINE}/>
    <rect x="17" y="18" width="4" height="16" rx="1.5" fill="#c79a5b" ${LINE}/>
    <g class="tube">
      <rect x="5" y="11" width="30" height="8" rx="4" transform="rotate(-18 20 15)" fill="#8fd16a" ${LINE}/>
      ${full ? `<rect x="8" y="13.2" width="24" height="3.6" rx="1.8" transform="rotate(-18 20 15)" fill="${WATER}"/>` : ''}
      <path d="M14 10.5 L15.5 18 M26 7 L27.5 14.5" stroke="${INK}" stroke-width="1.4" transform="rotate(-2 20 15)"/>
      <ellipse cx="34.5" cy="9.6" rx="1.8" ry="3.6" transform="rotate(-18 34.5 9.6)" fill="${full ? WATER : '#3d6b2a'}" ${LINE} stroke-width="1.2"/>
    </g>
    <circle cx="10.5" cy="16" r="1.2" fill="${INK}"/><circle cx="14.5" cy="14.8" r="1.2" fill="${INK}"/>
  `, '0 0 40 40', 'gate DFF');
}

// パクパク君（犬）。form は見た目（失敗するたびに変わる）、mood は様子。
//   mood: 'wait'（口を閉じて待つ） 'open'（口を開けて待つ） 'drink'（水を飲む）
//         'sad'（悲しそうにこっちを見る） 'bite'（かみついて吠える）
const DOG_FUR = {
  puppy: '#f5c27a', fangs: '#e9a85c', macho: '#c9834a', cerberus: '#6b5876',
  kaiju: '#6cc46c', dragon: '#e0504a', robot: '#aab4bf',
};

function dogHead(form, mood) {
  const fur = DOG_FUR[form] ?? DOG_FUR.puppy;
  const tough = form !== 'puppy';
  const ears = {
    kaiju: `<path d="M11 11 L13 3 L16 10 L19 2 L22 10 L25 3 L28 11" fill="#3f9a4a" ${LINE}/>`,
    dragon: `<path d="M12 12 Q8 4 13 1 Q12 6 16 10 Z M28 12 Q32 4 27 1 Q28 6 24 10 Z" fill="#ffd23f" ${LINE}/>`,
    robot: `<path d="M20 9 V3" ${LINE}/><circle cx="20" cy="2.5" r="1.8" fill="#ff5a5f" ${LINE} stroke-width="1"/>
            <rect x="6" y="14" width="4" height="8" rx="1" fill="#8b96a3" ${LINE}/><rect x="30" y="14" width="4" height="8" rx="1" fill="#8b96a3" ${LINE}/>`,
  }[form] ?? `<ellipse cx="9.5" cy="17" rx="3.6" ry="7" transform="rotate(18 9.5 17)" fill="#a8693a" ${LINE}/>
              <ellipse cx="30.5" cy="17" rx="3.6" ry="7" transform="rotate(-18 30.5 17)" fill="#a8693a" ${LINE}/>`;
  const face = form === 'robot'
    ? `<rect x="9" y="9" width="22" height="22" rx="6" fill="${fur}" ${LINE}/>`
    : `<circle cx="20" cy="20" r="11.5" fill="${fur}" ${LINE}/>`;
  const muzzle = `<ellipse cx="20" cy="25.5" rx="7" ry="5" fill="${form === 'robot' ? '#d8dee5' : '#fff3e0'}" ${LINE} stroke-width="1.6"/>
                  <ellipse cx="20" cy="22.6" rx="2.3" ry="1.7" fill="${INK}"/>`;
  let eyes;
  if (form === 'robot' && mood !== 'sad') {
    eyes = `<rect x="13" y="15" width="5" height="3" fill="${mood === 'bite' ? '#ff2b2b' : '#3fe0ff'}" ${LINE} stroke-width="1"/>
            <rect x="22" y="15" width="5" height="3" fill="${mood === 'bite' ? '#ff2b2b' : '#3fe0ff'}" ${LINE} stroke-width="1"/>`;
  } else if (mood === 'sad') {
    eyes = `<circle cx="15.5" cy="17" r="3.4" fill="#fff" ${LINE} stroke-width="1.4"/><circle cx="24.5" cy="17" r="3.4" fill="#fff" ${LINE} stroke-width="1.4"/>
            <circle cx="15.8" cy="17.6" r="2.2" fill="${INK}"/><circle cx="24.8" cy="17.6" r="2.2" fill="${INK}"/>
            <circle cx="16.6" cy="16.6" r="0.8" fill="#fff"/><circle cx="25.6" cy="16.6" r="0.8" fill="#fff"/>
            <path d="M12 12.5 L17.5 11 M28 12.5 L22.5 11" ${LINE} stroke-width="1.8"/>
            <path class="tear" d="M13.5 21 Q12.5 24 13.5 25 Q14.5 24 13.5 21 Z M26.5 21 Q25.5 24 26.5 25 Q27.5 24 26.5 21 Z" fill="${WATER}"/>`;
  } else if (mood === 'bite') {
    eyes = `<path d="M11.5 12 L18.5 15.5 M28.5 12 L21.5 15.5" ${LINE} stroke-width="3"/>
            <circle cx="15.5" cy="17.5" r="1.4" fill="#d61f2c"/><circle cx="24.5" cy="17.5" r="1.4" fill="#d61f2c"/>`;
  } else if (mood === 'drink') {
    eyes = `<path d="M13 17.5 Q15.5 15 18 17.5 M22 17.5 Q24.5 15 27 17.5" ${LINE} fill="none"/>`;
  } else {
    // 子犬は目を大きく、ほっぺを付けてかわいくする
    const r = tough ? 1.8 : 2.5;
    eyes = `<circle cx="15.5" cy="17" r="${r}" fill="${INK}"/><circle cx="24.5" cy="17" r="${r}" fill="${INK}"/>
            <circle cx="16.3" cy="16.2" r="${r / 3}" fill="#fff"/><circle cx="25.3" cy="16.2" r="${r / 3}" fill="#fff"/>`;
  }
  if (!tough && mood !== 'bite') {
    eyes += `<ellipse cx="11.5" cy="23" rx="2.2" ry="1.4" fill="#ff8fb1" opacity="0.8"/><ellipse cx="28.5" cy="23" rx="2.2" ry="1.4" fill="#ff8fb1" opacity="0.8"/>`;
  }
  const brows = tough && mood !== 'sad' && mood !== 'bite' ? `<path d="M12 13 H18 M22 13 H28" ${LINE} stroke-width="2.6"/>` : '';
  let mouth;
  if (mood === 'bite') {
    mouth = `<path d="M12.5 26 Q20 37 27.5 26 Z" fill="#7a1f2b" ${LINE}/>
             <path d="M13.5 26.5 L15 29 L16.5 26.8 L18 29.5 L19.5 27 L21 29.5 L22.5 27 L24 29 L26 26.5" fill="#fff" stroke="${INK}" stroke-width="0.8"/>`;
  } else if (mood === 'wait') {
    mouth = `<path d="M16.5 27.5 Q18.2 29.2 20 27.5 Q21.8 29.2 23.5 27.5" ${LINE} fill="none" stroke-width="1.6"/>`;
  } else {
    mouth = `<ellipse cx="20" cy="29" rx="4.2" ry="${mood === 'sad' ? 2.6 : 3.4}" fill="#7a1f2b" ${LINE} stroke-width="1.6"/>
             <ellipse cx="20" cy="30.6" rx="2.6" ry="1.5" fill="#ff8fa3"/>`;
  }
  const fangs = tough && form !== 'robot' && mood !== 'wait'
    ? `<path d="M16.6 26.6 L17.6 30 L18.6 26.9 Z M23.4 26.6 L22.4 30 L21.4 26.9 Z" fill="#fff" stroke="${INK}" stroke-width="0.9"/>`
    : '';
  const drop = mood === 'drink' ? `<path class="gulp" d="M20 33.5 Q18 36.5 20 38 Q22 36.5 20 33.5 Z" fill="${WATER}" ${LINE} stroke-width="1"/>` : '';
  return `${ears}${face}${brows}${eyes}${muzzle}${mouth}${fangs}${drop}`;
}

export function dogIcon(form = 'puppy', mood = 'wait') {
  const fur = DOG_FUR[form] ?? DOG_FUR.puppy;
  const bark = mood === 'bite'
    ? `<path class="bark" d="M1 12 L5 14 M0 19 L5 19 M1 26 L5 24 M39 12 L35 14 M40 19 L35 19 M39 26 L35 24" stroke="#d61f2c" stroke-width="2" stroke-linecap="round"/>`
    : '';
  let body = `<ellipse cx="20" cy="36" rx="10" ry="5.5" fill="${fur}" ${LINE}/>`;
  if (form === 'macho') {
    body = `<path d="M4 40 Q4 30 13 31 L27 31 Q36 30 36 40 Z" fill="${fur}" ${LINE}/>
            <circle cx="6.5" cy="33" r="4" fill="${fur}" ${LINE}/><circle cx="33.5" cy="33" r="4" fill="${fur}" ${LINE}/>
            <path d="M15 35 Q20 37 25 35" ${LINE} fill="none" stroke-width="1.2"/>`;
  }
  if (form === 'kaiju' || form === 'dragon') {
    const wing = form === 'dragon'
      ? `<path d="M8 30 L-2 20 L1 30 L-3 33 Z M32 30 L42 20 L39 30 L43 33 Z" fill="#b8323a" ${LINE}/>`
      : `<path d="M30 33 L34 28 L35 34 L39 31 L37 38" fill="#3f9a4a" ${LINE}/>`;
    body = `${wing}<ellipse cx="20" cy="37" rx="11" ry="5" fill="${fur}" ${LINE}/>`;
  }
  if (form === 'robot') body = `<rect x="11" y="32" width="18" height="8" rx="2" fill="#8b96a3" ${LINE}/><circle cx="20" cy="36" r="1.6" fill="#ffd23f"/>`;
  if (form === 'cerberus') {
    // 頭が3つ。左右の頭は少し小さく、後ろに置く
    const side = (x) => `<g transform="translate(${x} 7) scale(0.6)">${dogHead(form, mood)}</g>`;
    return svg(`${bark}<path d="M1 40 Q1 30 11 30 L29 30 Q39 30 39 40 Z" fill="${fur}" ${LINE}/>
      ${side(-7)}${side(23)}<g transform="translate(6 0) scale(0.7)">${dogHead(form, mood)}</g>`, '0 0 40 40', `dog ${form} ${mood}`);
  }
  return svg(`${bark}${body}<g transform="translate(2 2) scale(0.9)">${dogHead(form, mood)}</g>`, '0 0 40 40', `dog ${form} ${mood}`);
}
