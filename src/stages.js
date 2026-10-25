// 組み合わせ回路編のステージ（仕様書「論理回路まなびゲーム 仕様書（第2版）」より）。
// 1つのステージは、予定表（times）の時間ごとに1回ずつ水を流す。時間は朝・昼・夕方・夜のうち1〜4回。
// 予定表は画面に前もって出ていて、どの時間に何が変わるかがわかる。全部の時間でうまくいけばクリア。
//   times[].time は時間（'morning' 朝 / 'noon' 昼 / 'evening' 夕方 / 'night' 夜）。並びは時間の順。
//   times[].faucets はその時間の蛇口の開け閉め（プレイヤーは変えられない）。
//   times[].outputs はその時間に花だん（出口）にいるキャラ。'flower'（花：水が欲しい＝1）か
//     'oyaji'（おやじ：花だんで寝ている。水をかけない＝0）。おやじは時間によって寝に来る花だんが変わる。
//   tray は仕掛け箱に入っている数。仕掛け箱の仕掛けは全部使う（ルール）。
//   intro は、このステージで初めて出てくるキャラ（紹介カードを出す）。
//   solution は参考解（テストで正解になることを確かめる）。
// どのステージも、仕掛け箱の仕掛けを1つ抜いたり、それまでに出てきた別の仕掛けに替えたりすると
// 解けないように作ってある（tools/solver.js で総当たりして確かめる。test/puzzle.test.js）。

const STAGES = [
  {
    no: 1,
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
    no: 2,
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
    no: 3,
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
    no: 4,
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
    no: 5,
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
    no: 6,
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
    no: 7,
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
    no: 8,
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
    no: 9,
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
    no: 10,
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
    no: 11,
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
    intro: [],
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
    no: 12,
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

// inputs は蛇口の名前の並び（画面の上から）、outlets は花だんの名前の並び。どの時間でも同じ。
export const COMBINATIONAL_STAGES = STAGES.map((stage) => ({
  ...stage,
  inputs: Object.keys(stage.times[0].faucets),
  outlets: Object.keys(stage.times[0].outputs),
}));
