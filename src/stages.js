// 組み合わせ回路編のステージ（仕様書「論理回路まなびゲーム 仕様書（第2版）」より）。
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

// 順序回路編のステージ。時間がししおどしの「カコン」で1拍ずつ進む。
//   beats は拍の数。faucets は蛇口ごとの、拍ごとの開け閉めの並び（1 が開。ステージで決まっている）。
//   outputs の 'dog' はパクパク君。mouth は拍ごとの口の開け閉め（1 が開＝水が欲しい、0 が閉＝水はダメ）。
//   準備完了を押すと、1拍目から順に水を流して確かめる。全部の拍は最初からタイムラインで見えている。
const SEQUENTIAL = [
  {
    title: 'パクパク君',
    mission: 'パクパク君は、口を開けている拍だけ水が欲しい。蛇口とタイミングを合わせよう',
    lesson: '時間で変わる水（1と0の並び）',
    beats: 8,
    faucets: { A: [1, 0, 1, 1, 0, 0, 1, 0] },
    outputs: { d1: 'dog' },
    mouth: { d1: [1, 0, 1, 1, 0, 0, 1, 0] },
    tray: {},
    intro: ['dog'],
    solution: { gates: [], outputs: { d1: { input: 'A' } } },
  },
  {
    title: 'あまのじゃくなごはん',
    mission: '蛇口とパクパク君の口が、いつも逆。天野君で合わせよう',
    lesson: 'NOT を時間の並びに使う',
    beats: 8,
    faucets: { A: [1, 1, 0, 1, 0, 0, 1, 1] },
    outputs: { d1: 'dog' },
    mouth: { d1: [0, 0, 1, 0, 1, 1, 0, 0] },
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
    beats: 8,
    faucets: { A: [1, 0, 1, 1, 0, 1, 1, 0], B: [0, 0, 1, 1, 1, 1, 0, 1] },
    outputs: { d1: 'dog' },
    mouth: { d1: [0, 0, 1, 1, 0, 1, 0, 0] },
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
    beats: 8,
    faucets: { A: [1, 0, 0, 1, 1, 0, 1, 0] },
    outputs: { d1: 'dog' },
    mouth: { d1: [0, 1, 0, 0, 1, 1, 0, 1] },
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
    beats: 8,
    faucets: { A: [1, 1, 0, 0, 1, 0, 1, 0] },
    outputs: { d1: 'dog' },
    mouth: { d1: [0, 0, 1, 1, 0, 0, 1, 0] },
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
    beats: 8,
    faucets: { A: [0, 0, 0, 0, 0, 0, 0, 0] },
    outputs: { d1: 'dog' },
    mouth: { d1: [1, 0, 1, 0, 1, 0, 1, 0] },
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
    beats: 8,
    faucets: { A: [1, 1, 0, 1, 1, 1, 0, 1] },
    outputs: { d1: 'dog' },
    mouth: { d1: [0, 1, 0, 0, 1, 1, 0, 0] },
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
    beats: 8,
    faucets: { A: [0, 1, 1, 1, 0, 1, 1, 0] },
    outputs: { d1: 'dog' },
    mouth: { d1: [0, 1, 0, 0, 0, 1, 0, 0] },
    tray: { DFF: 1, NOT: 1, AND: 1 },
    intro: [],
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

// no はステージの番号、inputs は蛇口の名前の並び（画面の上から）、outlets は花だん（出口）の名前の並び。どの時間でも同じ。
// kind は 'comb'（組み合わせ回路編）か 'seq'（順序回路編）。
export const COMBINATIONAL_STAGES = STAGES.map((stage, i) => ({
  hidden: false,
  ...stage,
  kind: 'comb',
  no: i + 1,
  inputs: Object.keys(stage.times[0].faucets),
  outlets: Object.keys(stage.times[0].outputs),
}));

// 順序回路編の番号は、組み合わせ回路編から続けて数える。
export const SEQUENTIAL_STAGES = SEQUENTIAL.map((stage, i) => ({
  hidden: false,
  ...stage,
  kind: 'seq',
  no: COMBINATIONAL_STAGES.length + i + 1,
  inputs: Object.keys(stage.faucets),
  outlets: Object.keys(stage.outputs),
}));

export const ALL_STAGES = [...COMBINATIONAL_STAGES, ...SEQUENTIAL_STAGES];
