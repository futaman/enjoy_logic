import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBINATIONAL_STAGES } from '../src/stages.js';
import { CHARACTERS } from '../src/characters.js';
import { evaluate } from '../src/logic.js';

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
    // 出口にいるのは花かおやじだけ
    for (const kind of Object.values(stage.outputs)) assert.ok(kind === 'flower' || kind === 'oyaji');
    // 仕掛けの紹介カードがある
    for (const key of [...stage.intro, ...Object.keys(stage.tray)]) assert.ok(CHARACTERS[key], `${key} の説明がない`);
  });
}

test('キャラは、初めて使うステージより前か同じステージで紹介される', () => {
  const introduced = new Set();
  for (const stage of COMBINATIONAL_STAGES) {
    for (const key of stage.intro) introduced.add(key);
    for (const kind of Object.values(stage.outputs)) assert.ok(introduced.has(kind), `ステージ${stage.no}の${kind}`);
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
