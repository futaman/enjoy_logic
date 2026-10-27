import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allRows, checkCircuit, expectedOf, evaluate } from '../src/logic.js';
import { ALL_STAGES as COMBINATIONAL_STAGES } from '../src/stages.js';

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

test('蛇口の開け方を全部並べる', () => {
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

  test(`ステージ${stage.no}（${stage.title}）の参考解は、仕掛け箱の中身ちょうどで作れる`, () => {
    const used = {};
    for (const gate of stage.solution.gates) used[gate.type] = (used[gate.type] ?? 0) + 1;
    assert.deepEqual(used, stage.tray);
  });
}

test('違う回路は、最初にうまくいかなかった時間と、出口ごとの値を返す', () => {
  const stage = COMBINATIONAL_STAGES.find((s) => s.no === 6); // カタブツ（朝 A 開 B 閉 → おやじ）
  const wrong = {
    gates: [{ id: 'g1', type: 'OR', inputs: [{ input: 'A' }, { input: 'B' }] }],
    outputs: { b1: { gate: 'g1' } },
  };
  const result = checkCircuit(wrong, stage);
  assert.equal(result.ok, false);
  assert.equal(result.time, 0);
  assert.deepEqual(result.expected, { b1: false });
  assert.deepEqual(result.actual, { b1: true });
});

test('全部の時間で合わないと正解にならない（1つの時間だけ合ってもだめ）', () => {
  const stage = COMBINATIONAL_STAGES.find((s) => s.no === 6); // 朝・昼はおやじ、夜は花
  const onlyA = { gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { input: 'A' }] }], outputs: { b1: { gate: 'g1' } } };
  // 夜は合うが、朝におやじに水がかかる
  assert.deepEqual(checkCircuit(onlyA, stage).time, 0);
});

test('花だんのキャラが仕様：花は1、おやじは0', () => {
  assert.deepEqual(expectedOf({ outputs: { b1: 'flower', b2: 'oyaji' } }), { b1: true, b2: false });
});
