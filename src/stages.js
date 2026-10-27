// ステージ（仕様書「論理回路まなびゲーム 仕様書（第2版）」より）。まず組み合わせ回路編。
// 1つのステージは、予定表（times）の時間ごとに1回ずつ水を流す。時間は朝・昼・夕方・夜のうち1〜4回。
// 予定表は画面に前もって出ていて、どの時間に何が変わるかがわかる。全部の時間でうまくいけばクリア。
//   times[].time は時間（'morning' 朝 / 'noon' 昼 / 'evening' 夕方 / 'night' 夜）。並びは時間の順。
//   times[].faucets はその時間の蛇口の開け閉め（プレイヤーは変えられない）。
//   times[].outputs はその時間に花だん（出口）にいるキャラ。'flower'（花：水が欲しい＝1）か
//     'oyaji'（おやじ：花だんで寝ている。水をかけない＝0）。おやじは時間によって寝に来る花だんが変わる。
//   tray は仕掛け箱に入っている数。仕掛け箱の仕掛けは全部使う（ルール）。
//   intro は、このステージで初めて出てくるキャラ（紹介カードを出す）。
//   hidden が true のステージは「見えない庭」。準備完了を押すまで、水路の水が見えない（蛇口と花だんは見える）。
//   solution は参考解（テストで正解になることを確かめる）。
// どのステージも、仕掛け箱の仕掛けを1つ抜いたり、それまでに出てきた別の仕掛けに替えたりすると
// 解けないように作ってある（tools/solver.js で総当たりして確かめる。test/puzzle.test.js）。

const STAGES = [
  {
    title: 'はじめての水やり',
    mission: '開いている蛇口から、花に水を届けよう',
    lesson: '水がある＝1',
    times: [{ time: 'morning', faucets: { A: true }, outputs: { b1: 'flower' } }],
    tray: {},
    intro: ['faucet', 'flower'],
    solution: {
      gates: [],
      outputs: { b1: { input: 'A' } },
    },
  },
  {
    title: 'おやじの昼寝',
    mission: '花には水を、おやじには水をかけないように、花だんを全部つなごう',
    lesson: '水がない＝0',
    times: [{ time: 'noon', faucets: { A: true, B: false }, outputs: { b1: 'flower', b2: 'oyaji' } }],
    tray: {},
    intro: ['oyaji'],
    solution: {
      gates: [],
      outputs: { b1: { input: 'A' }, b2: { input: 'B' } },
    },
  },
  {
    title: '天野君の水筒',
    mission: '蛇口は閉じたまま。天野君の力を借りて、花に水を届けよう',
    lesson: 'NOT（0を1にする）',
    times: [{ time: 'morning', faucets: { A: false }, outputs: { b1: 'flower' } }],
    tray: { NOT: 1 },
    intro: ['NOT'],
    solution: {
      gates: [{ id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] }],
      outputs: { b1: { gate: 'g1' } },
    },
  },
  {
    title: 'やだね！',
    mission: '開いた蛇口しかない。天野君を使って、おやじを寝かせたまま花にも水を',
    lesson: 'NOT（1を0にする）',
    times: [{ time: 'noon', faucets: { A: true }, outputs: { b1: 'flower', b2: 'oyaji' } }],
    tray: { NOT: 1 },
    intro: [],
    solution: {
      gates: [{ id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] }],
      outputs: { b1: { input: 'A' }, b2: { gate: 'g1' } },
    },
  },
  {
    title: '朝と夜',
    mission: '朝と夜の2回、水を流すよ。予定表を見て、どちらの時間もうまくいくようにつなごう',
    lesson: '時間で変わる（予定表）',
    times: [
      { time: 'morning', faucets: { A: true }, outputs: { b1: 'flower', b2: 'oyaji' } },
      { time: 'night', faucets: { A: false }, outputs: { b1: 'oyaji', b2: 'flower' } },
    ],
    tray: { NOT: 1 },
    intro: ['clock'],
    solution: {
      gates: [{ id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] }],
      outputs: { b1: { input: 'A' }, b2: { gate: 'g1' } },
    },
  },
  {
    title: 'カタブツ',
    mission: 'おやじは朝と昼に寝に来る。夜だけ花に水が届くようにしよう',
    lesson: 'AND（両方1のときだけ1）',
    times: [
      { time: 'morning', faucets: { A: true, B: false }, outputs: { b1: 'oyaji' } },
      { time: 'noon', faucets: { A: false, B: true }, outputs: { b1: 'oyaji' } },
      { time: 'night', faucets: { A: true, B: true }, outputs: { b1: 'flower' } },
    ],
    tray: { AND: 1 },
    intro: ['AND'],
    solution: {
      gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { b1: { gate: 'g1' } },
    },
  },
  {
    title: 'カタブツを動かせ',
    mission: '花に水がいるのは、Aが閉じてBが開いている朝だけ。カタブツと天野君で作ろう',
    lesson: 'NOT で作った水を AND に入れる',
    times: [
      { time: 'morning', faucets: { A: false, B: true }, outputs: { b1: 'flower' } },
      { time: 'noon', faucets: { A: false, B: false }, outputs: { b1: 'oyaji' } },
      { time: 'night', faucets: { A: true, B: true }, outputs: { b1: 'oyaji' } },
    ],
    tray: { AND: 1, NOT: 1 },
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] },
        { id: 'g2', type: 'AND', inputs: [{ gate: 'g1' }, { input: 'B' }] },
      ],
      outputs: { b1: { gate: 'g2' } },
    },
  },
  {
    title: 'イエスマン',
    mission: '朝も昼も花に水を。蛇口が両方閉じる夜は、おやじが寝に来る',
    lesson: 'OR（どちらかが1なら1）',
    times: [
      { time: 'morning', faucets: { A: true, B: false }, outputs: { b1: 'flower' } },
      { time: 'noon', faucets: { A: false, B: true }, outputs: { b1: 'flower' } },
      { time: 'night', faucets: { A: false, B: false }, outputs: { b1: 'oyaji' } },
    ],
    tray: { OR: 1 },
    intro: ['OR'],
    solution: {
      gates: [{ id: 'g1', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { b1: { gate: 'g1' } },
    },
  },
  {
    title: '日照りの庭',
    mission: '夜は蛇口が全部閉じる。それでも夜に花だん2の花に水を届けよう',
    lesson: 'OR の逆を NOT で作る',
    times: [
      { time: 'morning', faucets: { A: false, B: true }, outputs: { b1: 'flower', b2: 'oyaji' } },
      { time: 'noon', faucets: { A: true, B: false }, outputs: { b1: 'flower', b2: 'oyaji' } },
      { time: 'night', faucets: { A: false, B: false }, outputs: { b1: 'oyaji', b2: 'flower' } },
    ],
    tray: { OR: 1, NOT: 1 },
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'NOT', inputs: [{ gate: 'g1' }] },
      ],
      outputs: { b1: { gate: 'g1' }, b2: { gate: 'g2' } },
    },
  },
  {
    title: '多様性好き',
    mission: 'イエスマンと多様性好きはどこがちがう？朝だけ、花だん1におやじが寝に来る',
    lesson: 'XOR（2つがちがうときだけ1）',
    times: [
      { time: 'morning', faucets: { A: true, B: true }, outputs: { b1: 'oyaji', b2: 'flower' } },
      { time: 'noon', faucets: { A: false, B: true }, outputs: { b1: 'flower', b2: 'flower' } },
      { time: 'night', faucets: { A: true, B: false }, outputs: { b1: 'flower', b2: 'flower' } },
    ],
    tray: { OR: 1, XOR: 1 },
    intro: ['XOR'],
    solution: {
      gates: [
        { id: 'g1', type: 'XOR', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] },
      ],
      outputs: { b1: { gate: 'g1' }, b2: { gate: 'g2' } },
    },
  },
  {
    title: 'にぎやかな一日',
    mission: '朝・昼・夕方・夜の4回。花だん1は夜だけ、花だん2は朝と夜だけ花に水を',
    lesson: 'AND・NOT・XOR を使い分ける',
    times: [
      { time: 'morning', faucets: { A: false, B: false }, outputs: { b1: 'oyaji', b2: 'flower' } },
      { time: 'noon', faucets: { A: false, B: true }, outputs: { b1: 'oyaji', b2: 'oyaji' } },
      { time: 'evening', faucets: { A: true, B: false }, outputs: { b1: 'oyaji', b2: 'oyaji' } },
      { time: 'night', faucets: { A: true, B: true }, outputs: { b1: 'flower', b2: 'flower' } },
    ],
    tray: { AND: 1, NOT: 1, XOR: 1 },
    intro: ['fog'],
    hidden: true,
    solution: {
      gates: [
        { id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'XOR', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g3', type: 'NOT', inputs: [{ gate: 'g2' }] },
      ],
      outputs: { b1: { gate: 'g1' }, b2: { gate: 'g3' } },
    },
  },
  {
    title: '天野君ふたり',
    mission: '花だん1は蛇口が全部閉じた朝だけ花に。花だん2は、夜だけおやじが寝に来る',
    lesson: 'NOT を2つ使って AND と OR を動かす',
    times: [
      { time: 'morning', faucets: { A: false, B: false }, outputs: { b1: 'flower', b2: 'flower' } },
      { time: 'noon', faucets: { A: false, B: true }, outputs: { b1: 'oyaji', b2: 'flower' } },
      { time: 'evening', faucets: { A: true, B: false }, outputs: { b1: 'oyaji', b2: 'flower' } },
      { time: 'night', faucets: { A: true, B: true }, outputs: { b1: 'oyaji', b2: 'oyaji' } },
    ],
    tray: { NOT: 2, AND: 1, OR: 1 },
    intro: [],
    hidden: true,
    solution: {
      gates: [
        { id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] },
        { id: 'g2', type: 'NOT', inputs: [{ input: 'B' }] },
        { id: 'g3', type: 'AND', inputs: [{ gate: 'g1' }, { gate: 'g2' }] },
        { id: 'g4', type: 'OR', inputs: [{ gate: 'g1' }, { gate: 'g2' }] },
      ],
      outputs: { b1: { gate: 'g3' }, b2: { gate: 'g4' } },
    },
  },
];

// 順序回路編のステージ。予定表の時間は「拍」で、ししおどしが「カコン」と鳴るたびに次の拍へ進む。
// 出口にいるのはパクパク君。拍ごとに口を開ける（'open'＝水が欲しい＝1）か閉じる（'shut'＝水はダメ＝0）。
// 予定表は beats() で、蛇口と口の開け閉めを '1'（開）と '0'（閉）の並びで書く。
//   accepted は、検証で見つかっても認める別解（仕掛け箱に入っていない仕掛けを使う別解で、遊ぶ人は使えないもの）。
function beats(faucets, mouths) {
  const length = Object.values(faucets)[0].length;
  return Array.from({ length }, (_, i) => ({
    time: 'beat',
    faucets: Object.fromEntries(Object.entries(faucets).map(([name, row]) => [name, row[i] === '1'])),
    outputs: Object.fromEntries(Object.entries(mouths).map(([name, row]) => [name, row[i] === '1' ? 'open' : 'shut'])),
  }));
}

const SEQUENTIAL = [
  {
    title: 'パクパク君',
    mission: 'パクパク君は、口を開けている拍だけ水が欲しい。蛇口とタイミングを合わせよう',
    lesson: '時間で変わる水（1と0の並び）',
    times: beats({ A: '10110010' }, { d1: '10110010' }),
    tray: {},
    intro: ['dog'],
    solution: { gates: [], outputs: { d1: { input: 'A' } } },
  },
  {
    title: 'あまのじゃくなごはん',
    mission: '蛇口とパクパク君の口が、いつも逆。天野君で合わせよう',
    lesson: 'NOT を時間の並びに使う',
    times: beats({ A: '11010011' }, { d1: '00101100' }),
    tray: { NOT: 1 },
    intro: [],
    solution: {
      gates: [{ id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] }],
      outputs: { d1: { gate: 'g1' } },
    },
  },
  {
    title: 'カタブツの時間',
    mission: '蛇口が2つ。両方開いている拍だけ、パクパク君が口を開ける',
    lesson: 'AND を時間の並びに使う',
    times: beats({ A: '10110110', B: '00111101' }, { d1: '00110100' }),
    tray: { AND: 1 },
    intro: [],
    solution: {
      gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { d1: { gate: 'g1' } },
    },
  },
  {
    title: 'ししおどし',
    mission: 'パクパク君の口は、蛇口より1拍おそい。ししおどしで水を1拍おくらせよう',
    lesson: 'ししおどし（フリップフロップ）＝1拍前の水をおぼえる',
    times: beats({ A: '10011010' }, { d1: '01001101' }),
    tray: { DFF: 1 },
    intro: ['DFF'],
    solution: {
      gates: [{ id: 'g1', type: 'DFF', inputs: [{ input: 'A' }] }],
      outputs: { d1: { gate: 'g1' } },
    },
  },
  {
    title: '2拍おくれ',
    mission: '今度は2拍おそい。ししおどしを2つ使おう',
    lesson: 'ししおどしをつなげる（シフトレジスタ）',
    times: beats({ A: '11001010' }, { d1: '00110010' }),
    tray: { DFF: 2 },
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'DFF', inputs: [{ input: 'A' }] },
        { id: 'g2', type: 'DFF', inputs: [{ gate: 'g1' }] },
      ],
      outputs: { d1: { gate: 'g2' } },
    },
  },
  {
    title: '1拍おき',
    mission: '蛇口は閉じたまま。パクパク君は1拍おきに口を開ける。ししおどしと天野君で作ろう',
    lesson: '自分の出口を入口に戻す（1拍おきに 1 と 0）',
    times: beats({ A: '00000000' }, { d1: '10101010' }),
    tray: { DFF: 1, NOT: 1 },
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'DFF', inputs: [{ gate: 'g2' }] },
        { id: 'g2', type: 'NOT', inputs: [{ gate: 'g1' }] },
      ],
      outputs: { d1: { gate: 'g2' } },
    },
  },
  {
    title: '2拍つづけて',
    mission: '蛇口が2拍つづけて開いたときだけ、パクパク君が口を開ける',
    lesson: '今の水と1拍前の水を、カタブツでくらべる',
    times: beats({ A: '11011101' }, { d1: '01001100' }),
    tray: { DFF: 1, AND: 1 },
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'DFF', inputs: [{ input: 'A' }] },
        { id: 'g2', type: 'AND', inputs: [{ input: 'A' }, { gate: 'g1' }] },
      ],
      outputs: { d1: { gate: 'g2' } },
    },
  },
  {
    title: '開けた瞬間だけ',
    mission: '蛇口を開けた最初の拍だけ、パクパク君が口を開ける。開けっぱなしの間は閉じている',
    lesson: '今は開いていて、1拍前は閉じていた（立ち上がりを見つける）',
    // 「閉・閉」と続く拍を入れておく。ないと、天野君を通した水をししおどしで1拍おくらせるだけで解けてしまう
    times: beats({ A: '00010111' }, { d1: '00010100' }),
    tray: { DFF: 1, NOT: 1, AND: 1 },
    intro: [],
    // A かつ「1拍前でない」は、A と「A かつ1拍前」の多様性好き（XOR）でも作れる。どんな並びでも成り立つ別解だが、
    // 仕掛け箱に多様性好きは入っていないので、遊ぶ人はこの別解を使えない
    accepted: [{ type: 'NOT', change: 'XORに替える' }],
    solution: {
      gates: [
        { id: 'g1', type: 'DFF', inputs: [{ input: 'A' }] },
        { id: 'g2', type: 'NOT', inputs: [{ gate: 'g1' }] },
        { id: 'g3', type: 'AND', inputs: [{ input: 'A' }, { gate: 'g2' }] },
      ],
      outputs: { d1: { gate: 'g3' } },
    },
  },
];

// no はステージの番号（組み合わせ回路編から続けて数える）、inputs は蛇口の名前の並び（画面の上から）、
// outlets は出口の名前の並び。どの時間でも同じ。kind は 'comb'（組み合わせ回路編）か 'seq'（順序回路編）。
const withDefaults = (kind, offset) => (stage, i) => ({
  hidden: false,
  accepted: [],
  ...stage,
  kind,
  no: offset + i + 1,
  inputs: Object.keys(stage.times[0].faucets),
  outlets: Object.keys(stage.times[0].outputs),
});

export const COMBINATIONAL_STAGES = STAGES.map(withDefaults('comb', 0));
export const SEQUENTIAL_STAGES = SEQUENTIAL.map(withDefaults('seq', COMBINATIONAL_STAGES.length));
export const ALL_STAGES = [...COMBINATIONAL_STAGES, ...SEQUENTIAL_STAGES];
