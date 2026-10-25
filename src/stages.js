// 組み合わせ回路編の8ステージ（仕様書「論理回路まなびゲーム 仕様書（初版）」より）。
// mission は画面に出す目標の文、lesson は学ぶこと。
// inputs は蛇口の名前、outputs は出口ごとの「正しい答え」。
// tray は仕掛け箱に入っている数（ここにない仕掛けは使えない）。
// solution は参考解（テストで正解になることを確かめる）。

export const COMBINATIONAL_STAGES = [
  {
    no: 1,
    title: 'はじめての水やり',
    mission: '蛇口を開けたら、花に水が届くようにつなごう',
    lesson: '1と0、配線',
    tray: {},
    inputs: ['A'],
    outputs: {
      out: (v) => v.A,
    },
    solution: {
      gates: [],
      outputs: { out: { input: 'A' } },
    },
  },
  {
    no: 2,
    title: 'おやじの昼寝',
    mission: '蛇口を開けるとおやじが昼寝、閉めると花に水',
    lesson: 'NOT',
    tray: { NOT: 2 },
    inputs: ['A'],
    outputs: {
      out: (v) => !v.A,
    },
    solution: {
      gates: [{ id: 'g1', type: 'NOT', inputs: [{ input: 'A' }] }],
      outputs: { out: { gate: 'g1' } },
    },
  },
  {
    no: 3,
    title: '二人の庭師',
    mission: '蛇口AとBが両方開いたときだけ花に水',
    lesson: 'AND',
    tray: { AND: 2 },
    inputs: ['A', 'B'],
    outputs: {
      out: (v) => v.A && v.B,
    },
    solution: {
      gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { out: { gate: 'g1' } },
    },
  },
  {
    no: 4,
    title: 'どっちでも',
    mission: 'AかBのどちらかが開いたら花に水',
    lesson: 'OR',
    tray: { OR: 2 },
    inputs: ['A', 'B'],
    outputs: {
      out: (v) => v.A || v.B,
    },
    solution: {
      gates: [{ id: 'g1', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { out: { gate: 'g1' } },
    },
  },
  {
    no: 5,
    title: 'けんかする庭師',
    mission: '片方だけ開いたら花。両方開いたらおやじ',
    lesson: 'XOR',
    tray: { XOR: 2 },
    inputs: ['A', 'B'],
    outputs: {
      out: (v) => v.A !== v.B,
    },
    solution: {
      gates: [{ id: 'g1', type: 'XOR', inputs: [{ input: 'A' }, { input: 'B' }] }],
      outputs: { out: { gate: 'g1' } },
    },
  },
  {
    no: 6,
    title: '新しい仕掛け',
    mission: '両方開いたときだけおやじ。それ以外は花',
    lesson: 'NAND（NORも同じように作れる）',
    tray: { AND: 2, OR: 1, NOT: 2 },
    inputs: ['A', 'B'],
    outputs: {
      out: (v) => !(v.A && v.B),
    },
    solution: {
      gates: [
        { id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'NOT', inputs: [{ gate: 'g1' }] },
      ],
      outputs: { out: { gate: 'g2' } },
    },
  },
  {
    no: 7,
    title: '多数決',
    mission: '蛇口3つのうち2つ以上開いたら花に水',
    lesson: '3つの蛇口の組み合わせを考える',
    tray: { AND: 4, OR: 3 },
    inputs: ['A', 'B', 'C'],
    outputs: {
      out: (v) => [v.A, v.B, v.C].filter(Boolean).length >= 2,
    },
    solution: {
      gates: [
        { id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'AND', inputs: [{ input: 'B' }, { input: 'C' }] },
        { id: 'g3', type: 'AND', inputs: [{ input: 'A' }, { input: 'C' }] },
        { id: 'g4', type: 'OR', inputs: [{ gate: 'g1' }, { gate: 'g2' }] },
        { id: 'g5', type: 'OR', inputs: [{ gate: 'g4' }, { gate: 'g3' }] },
      ],
      outputs: { out: { gate: 'g5' } },
    },
  },
  {
    no: 8,
    title: '花が2つ',
    mission: '開いた蛇口の数を、2つの花壇で示そう（上が1の位、下が2の位）',
    lesson: '開いた蛇口の数を2進数で表す（半加算器）',
    tray: { AND: 2, XOR: 2 },
    inputs: ['A', 'B'],
    outputs: {
      sum: (v) => v.A !== v.B,
      carry: (v) => v.A && v.B,
    },
    solution: {
      gates: [
        { id: 'g1', type: 'XOR', inputs: [{ input: 'A' }, { input: 'B' }] },
        { id: 'g2', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] },
      ],
      outputs: { sum: { gate: 'g1' }, carry: { gate: 'g2' } },
    },
  },
];
