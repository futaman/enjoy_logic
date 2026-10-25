// 演出の中身（何が起きるか）。画面からは独立しているので、テストで直接確かめられる。
// 仕様書（第2版）「リアクション演出」「失敗の演出」より。

// おやじの怒り方。同じステージで水をかけた回数で段階が上がる。
// 1〜4回目は順に激しくなり、5回目からはレア演出がランダムに出る。
export const ANGER_LEVELS = [
  { id: 'kora', title: '飛び起きおやじ', shout: 'こらーっ！', mood: 'angry' },
  { id: 'steam', title: 'やかんおやじ', shout: 'ピーーーッ！！', mood: 'steam' },
  { id: 'giant', title: '巨大おやじ', shout: 'ゴゴゴゴゴ…', mood: 'giant' },
  { id: 'rocket', title: 'お星さまおやじ', shout: 'ドッカーーン！！', mood: 'giant' },
];

export const RARE_ANGERS = [
  { id: 'enka', title: '演歌おやじ', shout: '♪こ〜ら〜 ああ こ〜ら〜', mood: 'enka' },
  { id: 'daibutsu', title: '大仏おやじ', shout: '…喝ッ！！', mood: 'daibutsu' },
  { id: 'happy', title: 'ちょっと喜ぶおやじ', shout: '…まあ、涼しいのう', mood: 'happy' },
  { id: 'clone', title: '分身おやじ', shout: 'こらこらこらこらこら！', mood: 'angry' },
  { id: 'seiza', title: '説教おやじ', shout: 'そこに座りなさい。', mood: 'seiza' },
];

// おやじ図鑑に並べる順。
export const ALL_ANGERS = [...ANGER_LEVELS, ...RARE_ANGERS];

export function angerFor(count, random = Math.random) {
  if (count <= ANGER_LEVELS.length) return ANGER_LEVELS[Math.max(count, 1) - 1];
  return RARE_ANGERS[Math.floor(random() * RARE_ANGERS.length) % RARE_ANGERS.length];
}

// 花の育ち方。水やりが成功すると、花は段階を追って大きくなり、最後はひまわりの森になる。
export const GROWTH = [
  { level: 1, name: '花', scale: 1.3 },
  { level: 2, name: '大きな花', scale: 1.8 },
  { level: 3, name: 'ヒマワリ', scale: 2.3 },
  { level: 4, name: 'ひまわりの森', scale: 2.8 },
];

export function growthFor(level) {
  if (level <= 0) return null;
  return GROWTH[Math.min(level, GROWTH.length) - 1];
}

// 花に水が来なかった回数ごとの、しおれ方。
export function wiltFor(count) {
  if (count <= 1) return { level: 1, shout: '水…', text: 'しおしお…' };
  if (count === 2) return { level: 2, shout: 'ばたっ', text: '花が倒れちゃった' };
  return { level: 3, shout: 'ひゅるる〜', text: '干からびて、風で飛んでいった' };
}

// 仕掛けが水を受けたときの一言。言うことがないときは null。
export function gateLine(type, inputs) {
  const count = inputs.filter(Boolean).length;
  switch (type) {
    case 'NOT':
      return inputs[0] ? 'やだね！' : 'じゃあ出す！';
    case 'AND':
      if (count === 2) return 'よし、通れ！';
      return count === 1 ? '規則ですので' : null;
    case 'OR':
      return count > 0 ? 'はいはい！' : null;
    case 'XOR':
      if (count === 1) return 'ちがうっていいね！';
      return count === 2 ? 'おんなじは、つまらん' : null;
    default:
      return null;
  }
}

// 判定で失敗したとき、どちらの演出を見せるか。
// おやじに水がかかった出口があれば 'oyaji'、花だけなら 'flower'、水路がぐるぐるなら 'loop'。
export function failureKind(expected, actual) {
  if (!actual) return 'loop';
  const names = Object.keys(expected).filter((name) => expected[name] !== actual[name]);
  return names.some((name) => !expected[name]) ? 'oyaji' : 'flower';
}

// 失敗したあとの司会の一言（笑いのあとに、必ず「なぜ」を添える）。責める言い方はしない。
export function hostLine(kind, count) {
  if (kind === 'loop') return '水路がぐるぐる回って、水が迷子になっちゃった！';
  if (kind === 'oyaji') {
    if (count <= 1) return 'あーあ、おやじに水かけちゃった！';
    if (count <= 3) return 'またやっちゃったね！おやじ、どんどん怒ってるよ';
    return 'もはや、おやじが楽しみになってない？';
  }
  return count <= 1 ? 'あれれ、花に水が届かなかった！' : '花がかわいそう…もう一回！';
}
