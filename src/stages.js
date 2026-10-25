// 組み合わせ回路編のステージ（仕様書「論理回路まなびゲーム 仕様書（第2版）」より）。
// 1つのステージは、画面に見えている1つの状況だけを扱う（見えない開け方では判定しない）。
//   faucets は蛇口の開け閉めの始めの状態。基本はステージで決まっていて、プレイヤーは変えられない。
//   switchable は、プレイヤーがタップで開け閉めできる蛇口（手で回せる蛇口）。判定は回したあとの状態で行う。
//   outputs は出口ごとにいるキャラ。'flower'（花：水が欲しい＝1）か 'oyaji'（おやじ：水をかけない＝0）。
//   tray は仕掛け箱に入っている数。仕掛け箱の仕掛けは全部使う（ルール）。
//   intro は、このステージで初めて出てくるキャラ（紹介カードを出す）。
//   hidden が true のステージは「見えない庭」。準備完了を押すまで、水路の水が見えない。
//   solution は参考解（テストで正解になることを確かめる）。solution.faucets は、手で回せる蛇口の正しい開け方。

const STAGES = [
  {
    title: 'はじめての水やり',
    mission: '開いている蛇口から、花に水を届けよう',
    lesson: '水がある＝1',
    faucets: { A: true },
    outputs: { f1: 'flower' },
    tray: {},
    intro: ['faucet', 'flower'],
    solution: {
      gates: [],
      outputs: { f1: { input: 'A' } },
    },
  },
  {
    title: 'おやじの昼寝',
    mission: '花には水を、おやじには水をかけないように、出口を全部つなごう',
    lesson: '水がない＝0',
    faucets: { A: true, B: false },
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: {},
    intro: ['oyaji'],
    solution: {
      gates: [],
      outputs: { f1: { input: 'A' }, o1: { input: 'B' } },
    },
  },
  {
    title: '天野君の水筒',
    mission: '蛇口は閉じたまま。天野君の力を借りて、花に水を届けよう',
    lesson: 'NOT（0を1にする）',
    faucets: { A: false },
    outputs: { f1: 'flower' },
    tray: { NOT: 1 },
    intro: ['NOT'],
    solution: {
      gates: [{ id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] }],
      outputs: { f1: { gate: 'g1' } },
    },
  },
  {
    title: 'やだね！',
    mission: '開いた蛇口しかない。天野君を使って、おやじを寝かせたまま花にも水を',
    lesson: 'NOT（1を0にする）',
    faucets: { A: true },
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: { NOT: 1 },
    intro: [],
    solution: {
      gates: [{ id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] }],
      outputs: { f1: { input: 'A' }, o1: { gate: 'g1' } },
    },
  },
  {
    title: 'カタブツ',
    mission: 'カタブツを通して、花に水を届けよう',
    lesson: 'AND（両方1のときだけ1）',
    faucets: { A: true, B: true },
    outputs: { f1: 'flower' },
    tray: { AND: 1 },
    intro: ['AND'],
    solution: {
      gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { f1: { gate: 'g1' } },
    },
  },
  {
    title: 'カタブツは動かない',
    mission: 'カタブツを使って、おやじを寝かせよう。花にも水を',
    lesson: 'AND（片方だけなら0）',
    faucets: { A: true, B: false },
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: { AND: 1 },
    intro: [],
    solution: {
      gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { f1: { input: 'A' }, o1: { gate: 'g1' } },
    },
  },
  {
    title: 'カタブツを説得',
    mission: '蛇口Bは手で回せる。カタブツを通して花に水を届け、おやじは寝かせて',
    lesson: 'AND（両方を1にすると1）',
    faucets: { A: true, B: false },
    switchable: ['B'],
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: { AND: 1, NOT: 1 },
    intro: ['switch'],
    solution: {
      faucets: { B: true },
      gates: [
        { id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'NOT', inputs: [{ input: 'B' }] },
      ],
      outputs: { f1: { gate: 'g1' }, o1: { gate: 'g2' } },
    },
  },
  {
    title: 'イエスマン',
    mission: 'イエスマンを通して、花に水を届けよう',
    lesson: 'OR（どちらかが1なら1）',
    faucets: { A: false, B: true },
    outputs: { f1: 'flower' },
    tray: { OR: 1 },
    intro: ['OR'],
    solution: {
      gates: [{ id: 'g1', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { f1: { gate: 'g1' } },
    },
  },
  {
    title: '多様性好き',
    mission: 'イエスマンと多様性好きを使って、花には水を、おやじは寝かせて',
    lesson: 'XOR（2つがちがうときだけ1）',
    faucets: { A: true, B: true },
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: { OR: 1, XOR: 1 },
    intro: ['XOR'],
    solution: {
      gates: [
        { id: 'g1', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'XOR', inputs: [{ input: 'A' }, { input: 'B' }] },
      ],
      outputs: { f1: { gate: 'g1' }, o1: { gate: 'g2' } },
    },
  },
  {
    title: '多様性好きを喜ばせろ',
    mission: '蛇口Bは手で回せる。多様性好きを通して花に水を届け、カタブツの先のおやじは寝かせて',
    lesson: 'XOR（ちがう水にすると1）',
    faucets: { A: true, B: true },
    switchable: ['B'],
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: { XOR: 1, AND: 1 },
    intro: [],
    solution: {
      faucets: { B: false },
      gates: [
        { id: 'g1', type: 'XOR', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] },
      ],
      outputs: { f1: { gate: 'g1' }, o1: { gate: 'g2' } },
    },
  },
  {
    title: '日照りの庭',
    mission: '蛇口が全部閉じている。おやじを寝かせたまま、花に水を届けよう',
    lesson: 'NOT と OR を組み合わせる',
    faucets: { A: false, B: false },
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: { NOT: 1, OR: 1 },
    hidden: true,
    intro: ['fog'],
    solution: {
      gates: [
        { id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] },
        { id: 'g2', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] },
      ],
      outputs: { f1: { gate: 'g1' }, o1: { gate: 'g2' } },
    },
  },
  {
    title: 'カタブツを動かせ',
    mission: '閉じた蛇口があっても、カタブツを通して花に水を届けよう',
    lesson: 'NOT で作った水を AND に入れる',
    faucets: { A: true, B: false },
    outputs: { f1: 'flower' },
    tray: { AND: 1, NOT: 1 },
    hidden: true,
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'NOT', inputs: [{ input: 'B' }] },
        { id: 'g2', type: 'AND', inputs: [{ input: 'A' }, { gate: 'g1' }] },
      ],
      outputs: { f1: { gate: 'g2' } },
    },
  },
  {
    title: 'にぎやかな庭',
    mission: '花2つとおやじ1人。仕掛けを全部使って、みんなの言うとおりにしよう',
    lesson: '3つの仕掛けを使い分ける',
    faucets: { A: false, B: true, C: true },
    outputs: { f1: 'flower', o1: 'oyaji', f2: 'flower' },
    tray: { AND: 1, NOT: 1, XOR: 1 },
    hidden: true,
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'AND', inputs: [{ input: 'B' }, { input: 'C' }] },
        { id: 'g2', type: 'XOR', inputs: [{ input: 'B' }, { input: 'C' }] },
        { id: 'g3', type: 'NOT', inputs: [{ input: 'A' }] },
      ],
      outputs: { f1: { gate: 'g1' }, o1: { gate: 'g2' }, f2: { gate: 'g3' } },
    },
  },
  {
    title: '天野君ふたり',
    mission: '開いた蛇口は1つだけ。仕掛けを全部使って、花に水を、おやじは寝かせて',
    lesson: 'NOT を2つ使って AND と OR を動かす',
    faucets: { A: true, B: false, C: false },
    outputs: { f1: 'flower', o1: 'oyaji' },
    tray: { NOT: 2, AND: 1, OR: 1 },
    hidden: true,
    intro: [],
    solution: {
      gates: [
        { id: 'g1', type: 'NOT', inputs: [{ input: 'B' }] },
        { id: 'g2', type: 'NOT', inputs: [{ input: 'C' }] },
        { id: 'g3', type: 'AND', inputs: [{ gate: 'g1' }, { gate: 'g2' }] },
        { id: 'g4', type: 'OR', inputs: [{ input: 'B' }, { input: 'C' }] },
      ],
      outputs: { f1: { gate: 'g3' }, o1: { gate: 'g4' } },
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

// no はステージの番号（組み合わせ回路編から続けて数える）、inputs は蛇口の名前の並び（画面の上から）。
// kind は 'comb'（組み合わせ回路編）か 'seq'（順序回路編）。
const withDefaults = (kind, offset) => (stage, i) => ({
  switchable: [],
  hidden: false,
  ...stage,
  kind,
  no: offset + i + 1,
  inputs: Object.keys(stage.faucets),
});

export const COMBINATIONAL_STAGES = STAGES.map(withDefaults('comb', 0));
export const SEQUENTIAL_STAGES = SEQUENTIAL.map(withDefaults('seq', COMBINATIONAL_STAGES.length));
export const ALL_STAGES = [...COMBINATIONAL_STAGES, ...SEQUENTIAL_STAGES];
