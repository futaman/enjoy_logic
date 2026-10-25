import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBINATIONAL_STAGES } from '../src/stages.js';
import { CHARACTERS } from '../src/characters.js';
import { checkCircuit, evaluate } from '../src/logic.js';

const refsOf = (solution) => [
  ...solution.gates.flatMap((gate) => gate.inputs),
  ...Object.values(solution.outputs),
];

for (const stage of COMBINATIONAL_STAGES) {
  test(`ステージ${stage.no}：参考解は仕掛けを全部使い、どの仕掛けの出口も使っている（ルールを守れる）`, () => {
    const used = new Set(refsOf(stage.solution).filter((ref) => 'gate' in ref).map((ref) => ref.gate));
    for (const gate of stage.solution.gates) assert.ok(used.has(gate.id), `${gate.id} の出口がつながっていない`);
  });

  test(`ステージ${stage.no}：出口は花かおやじで、出てくるキャラには説明がある`, () => {
    // 花だんにいるのは花かおやじだけ
    for (const time of stage.times) {
      for (const kind of Object.values(time.outputs)) assert.ok(kind === 'flower' || kind === 'oyaji');
    }
    // 仕掛けの紹介カードがある
    for (const key of [...stage.intro, ...Object.keys(stage.tray)]) assert.ok(CHARACTERS[key], `${key} の説明がない`);
  });
}

for (const stage of COMBINATIONAL_STAGES) {
  test(`ステージ${stage.no}：予定表は1〜4回、時間の順で、どの時間も蛇口と花だんがそろっている`, () => {
    const order = ['morning', 'noon', 'evening', 'night'];
    assert.ok(stage.times.length >= 1 && stage.times.length <= 4);
    const indexes = stage.times.map((time) => order.indexOf(time.time));
    assert.ok(indexes.every((i, k) => i >= 0 && (k === 0 || i > indexes[k - 1])), '時間の順になっていない');
    for (const time of stage.times) {
      assert.deepEqual(Object.keys(time.faucets), stage.inputs);
      assert.deepEqual(Object.keys(time.outputs), stage.outlets);
    }
  });
}

test('キャラは、初めて使うステージより前か同じステージで紹介される', () => {
  const introduced = new Set();
  for (const stage of COMBINATIONAL_STAGES) {
    for (const key of stage.intro) introduced.add(key);
    for (const time of stage.times) {
      for (const kind of Object.values(time.outputs)) assert.ok(introduced.has(kind), `ステージ${stage.no}の${kind}`);
    }
    if (stage.times.length > 1) assert.ok(introduced.has('clock'), `ステージ${stage.no}の予定表`);
    for (const type of Object.keys(stage.tray)) assert.ok(introduced.has(type), `ステージ${stage.no}の${type}`);
  }
});

test('紹介カードの表は、仕掛けの本当の動きと同じ', () => {
  for (const type of ['NOT', 'AND', 'OR', 'XOR']) {
    for (const [inputs, output] of CHARACTERS[type].table) {
      const names = inputs.map((_, i) => `I${i}`);
      const circuit = {
        gates: [{ id: 'g', type, inputs: names.map((input) => ({ input })) }],
        outputs: { out: { gate: 'g' } },
      };
      const values = Object.fromEntries(names.map((name, i) => [name, Boolean(inputs[i])]));
      assert.equal(evaluate(circuit, values).out, Boolean(output), `${type} ${inputs}`);
    }
  }
});

test('見えない庭は後半のステージだけで、最初の見えない庭で紹介される', () => {
  const hidden = COMBINATIONAL_STAGES.filter((stage) => stage.hidden);
  assert.ok(hidden.length >= 2);
  assert.ok(hidden[0].intro.includes('fog'));
  assert.ok(hidden[0].no > COMBINATIONAL_STAGES.length / 2);
});
