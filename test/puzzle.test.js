import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_STAGES as COMBINATIONAL_STAGES } from '../src/stages.js';
import { addPart, checkBoard, connect, createBoard, ruleProblems } from '../src/board.js';
import { GATE_ARITY } from '../src/logic.js';
import { describe, expandTray, findSolution, knownGates, shortcuts } from '../tools/solver.js';

// パズルとして成り立っているか（総当たり）。ステージを変えたら `node tools/audit.js` で中身も見られる。
COMBINATIONAL_STAGES.forEach((stage, index) => {
  test(`ステージ${stage.no}：仕掛け箱の仕掛けを1つ抜いても、別の仕掛けに替えても解けない`, () => {
    const found = shortcuts(stage, knownGates(COMBINATIONAL_STAGES, index));
    assert.deepEqual(
      found.map((shortcut) => `${shortcut.type}を${shortcut.change}: ${describe(shortcut.solution)}`),
      [],
    );
  });

  test(`ステージ${stage.no}：解き手の見つけた解は、画面の盤面でもルールを守って正解になる`, () => {
    const solution = findSolution(stage, expandTray(stage.tray));
    assert.ok(solution);
    let board = createBoard();
    solution.gates.forEach((gate, i) => {
      board = addPart(board, gate.type, 200, 20 + i * 60);
    });
    const partId = new Map(solution.gates.map((gate, i) => [gate.id, `p${i + 1}`]));
    const end = (ref) => ('input' in ref ? { faucet: ref.input } : { part: partId.get(ref.gate), pin: 'out' });
    solution.gates.forEach((gate) => {
      gate.inputs.forEach((ref, pin) => {
        board = connect(board, end(ref), { part: partId.get(gate.id), pin: `in${pin}` });
      });
    });
    for (const [name, ref] of Object.entries(solution.outputs)) board = connect(board, end(ref), { outlet: name });
    assert.deepEqual(ruleProblems(board, stage), []);
    assert.deepEqual(checkBoard(board, stage), { ok: true });
  });
});

test('解き手は、解けないものは解けないと言う', () => {
  const stage = {
    tray: { AND: 1 },
    times: [
      { time: 'morning', faucets: { A: true, B: false }, outputs: { b1: 'flower' } },
      { time: 'night', faucets: { A: false, B: true }, outputs: { b1: 'flower' } },
    ],
  };
  assert.equal(findSolution(stage, ['AND']), null);
  assert.ok(findSolution(stage, ['OR']));
});

test('解き手は、同じ水を両方の入口に入れる抜け道も見つける', () => {
  // 1回だけの状況では、カタブツに同じ水を入れると、ただの水路と同じになる
  const stage = {
    tray: { AND: 1 },
    times: [{ time: 'morning', faucets: { A: true, B: true }, outputs: { b1: 'flower' } }],
  };
  assert.deepEqual(shortcuts(stage, ['NOT', 'AND']).map((shortcut) => shortcut.change), ['抜く']);
  assert.ok(Object.keys(GATE_ARITY).includes('AND'));
});
