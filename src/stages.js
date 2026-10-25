// 組み合わせ回路編の8ステージ（仕様書「論理回路まなびゲーム 仕様書（初版）」より）。
// inputs は蛇口の名前、outputs は出口ごとの「正しい答え」。
// solution は参考解（テストで正解になることを確かめる）。

export const COMBINATIONAL_STAGES = [
  {
    no: 1,
    title: 'はじめての水やり',
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
    lesson: 'NAND・NOR、組み合わせて新しい仕掛けを作れる',
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
    lesson: '3入力、予定表から回路を考える',
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
    lesson: '開いた蛇口の数を、2つの花壇で示す（半加算器）',
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
