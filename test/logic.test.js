import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allRows, checkCircuit, evaluate } from '../src/logic.js';
import { COMBINATIONAL_STAGES } from '../src/stages.js';

test('基本の仕掛けは真理値表どおりに動く', () => {
  const cases = [
    ['NOT', { A: false }, true],
    ['AND', { A: true, B: false }, false],
    ['OR', { A: true, B: false }, true],
    ['XOR', { A: true, B: true }, false],
    ['NAND', { A: true, B: true }, false],
    ['NOR', { A: false, B: false }, true],
  ];
  for (const [type, inputs, expected] of cases) {
    const circuit = {
      gates: [{ id: 'g1', type, inputs: Object.keys(inputs).map((name) => ({ input: name })) }],
      outputs: { out: { gate: 'g1' } },
    };
    assert.equal(evaluate(circuit, inputs).out, expected, type);
  }
});

test('予定表の行は蛇口の開け方を全部並べる', () => {
  assert.deepEqual(allRows(['A', 'B']), [
    { A: false, B: false },
    { A: false, B: true },
    { A: true, B: false },
    { A: true, B: true },
  ]);
});

test('蛇口の値がないと止まる', () => {
  const circuit = { gates: [], outputs: { out: { input: 'A' } } };
  assert.throws(() => evaluate(circuit, {}), /蛇口の値がない: A/);
});

test('ぐるぐる回る水路は見つける', () => {
  const circuit = {
    gates: [
      { id: 'g1', type: 'NOT', inputs: [{ gate: 'g2' }] },
      { id: 'g2', type: 'NOT', inputs: [{ gate: 'g1' }] },
    ],
    outputs: { out: { gate: 'g1' } },
  };
  assert.throws(() => evaluate(circuit, {}), /ぐるぐる/);
});

test('入口の数が合わない仕掛けは受け付けない', () => {
  const circuit = {
    gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }] }],
    outputs: { out: { gate: 'g1' } },
  };
  assert.throws(() => evaluate(circuit, { A: true }), /入口の数/);
});

for (const stage of COMBINATIONAL_STAGES) {
  test(`ステージ${stage.no}（${stage.title}）の参考解が正解になる`, () => {
    assert.deepEqual(checkCircuit(stage.solution, stage), { ok: true });
  });
}

test('違う回路は、どの行で違ったかを返す', () => {
  const stage = COMBINATIONAL_STAGES[2]; // 二人の庭師（AND）
  const wrong = {
    gates: [{ id: 'g1', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] }],
    outputs: { out: { gate: 'g1' } },
  };
  const result = checkCircuit(wrong, stage);
  assert.equal(result.ok, false);
  assert.deepEqual(result.row, { A: false, B: true });
  assert.equal(result.expected.out, false);
  assert.equal(result.actual.out, true);
});

test('6番目のステージはANDだけでは正解にならない（NANDを作る必要がある）', () => {
  const stage = COMBINATIONAL_STAGES[5];
  const andOnly = {
    gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'B' }] }],
    outputs: { out: { gate: 'g1' } },
  };
  assert.equal(checkCircuit(andOnly, stage).ok, false);
});
