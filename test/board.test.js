import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPart,
  checkBoard,
  connect,
  createBoard,
  flowLevels,
  liveState,
  remaining,
  removePart,
} from '../src/board.js';
import { COMBINATIONAL_STAGES } from '../src/stages.js';

const stage = (no) => COMBINATIONAL_STAGES.find((s) => s.no === no);
const A = { faucet: 'A' };
const B = { faucet: 'B' };
const out = (name) => ({ outlet: name });
const pin = (id, name) => ({ part: id, pin: name });
const outPin = (id) => ({ part: id, pin: 'out' });

// 盤面を組み立てる小さな補助（座標は重ならなければ何でもよい）
function build(parts, wires, base = createBoard()) {
  let board = base;
  parts.forEach(([type, x, y], i) => {
    board = addPart(board, type, x, y);
    assert.equal(board.parts.length, i + 1);
  });
  for (const [from, to] of wires) board = connect(board, from, to);
  return board;
}

test('出口から入口へはつなげる。出口どうしや入口どうしは断る', () => {
  const board = build([['AND', 300, 100]], []);
  assert.equal(connect(board, A, B).wires.length, 0);
  assert.equal(connect(board, pin('p1', 'in0'), pin('p1', 'in1')).wires.length, 0);
  assert.equal(connect(board, outPin('p1'), outPin('p1')).wires.length, 0);
  assert.equal(connect(board, A, pin('p1', 'in0')).wires.length, 1);
});

test('入口には1本だけ。つなぎ直すと前の水路は消える', () => {
  const board = build([['NOT', 300, 100]], [[A, pin('p1', 'in0')], [B, pin('p1', 'in0')]]);
  assert.deepEqual(board.wires, [{ from: B, to: pin('p1', 'in0') }]);
});

test('出口からは何本でも水路を分けられる', () => {
  const board = build(
    [['NOT', 300, 100], ['NOT', 300, 300]],
    [[A, pin('p1', 'in0')], [A, pin('p2', 'in0')]],
  );
  assert.equal(board.wires.length, 2);
});

test('自分自身の出口から自分の入口へはつなげない', () => {
  const board = build([['NOT', 300, 100]], []);
  assert.equal(connect(board, outPin('p1'), pin('p1', 'in0')).wires.length, 0);
});

test('仕掛けを消すと、つながっていた水路も消える', () => {
  const board = build([['AND', 300, 100]], [[A, pin('p1', 'in0')], [outPin('p1'), out('out')]]);
  const after = removePart(board, 'p1');
  assert.deepEqual(after.parts, []);
  assert.deepEqual(after.wires, []);
});

test('仕掛け箱の残りの数は、置いた数を引いて出す', () => {
  const s = stage(3);
  const board = build([['AND', 300, 100]], []);
  assert.equal(remaining(createBoard(), s, 'AND'), 2);
  assert.equal(remaining(board, s, 'AND'), 1);
});

test('参考解を盤面で組んだものは正解になる（ステージ3）', () => {
  const s = stage(3);
  const board = build(
    [['AND', 300, 100]],
    [[A, pin('p1', 'in0')], [B, pin('p1', 'in1')], [outPin('p1'), out('out')]],
  );
  assert.deepEqual(checkBoard(board, s), { ok: true });
});

test('つながっていない入口は水がないものとして扱う', () => {
  const s = stage(3);
  const board = build([['AND', 300, 100]], [[A, pin('p1', 'in0')], [outPin('p1'), out('out')]]);
  const result = checkBoard(board, s);
  assert.equal(result.ok, false);
  assert.deepEqual(result.row, { A: true, B: true });
});

test('ステージ8の半加算器は2つの出口を両方見る', () => {
  const s = stage(8);
  const board = build(
    [['XOR', 300, 100], ['AND', 300, 300]],
    [
      [A, pin('p1', 'in0')],
      [B, pin('p1', 'in1')],
      [A, pin('p2', 'in0')],
      [B, pin('p2', 'in1')],
      [outPin('p1'), out('sum')],
      [outPin('p2'), out('carry')],
    ],
  );
  assert.deepEqual(checkBoard(board, s), { ok: true });
});

test('水路がぐるぐる回ると、判定は例外になる', () => {
  const s = stage(2);
  const board = build(
    [['NOT', 300, 100], ['NOT', 500, 100]],
    [[outPin('p2'), pin('p1', 'in0')], [outPin('p1'), pin('p2', 'in0')], [outPin('p1'), out('out')]],
  );
  assert.throws(() => checkBoard(board, s), /ぐるぐる/);
});

test('水の流れ：蛇口を開けると、つながった水路が1になる', () => {
  const s = stage(2);
  const board = build(
    [['NOT', 300, 100]],
    [[A, pin('p1', 'in0')], [outPin('p1'), out('out')]],
  );
  const closed = liveState(board, s, { A: false });
  const opened = liveState(board, s, { A: true });
  assert.deepEqual(closed.wires, [false, true]);
  assert.deepEqual(opened.wires, [true, false]);
  assert.equal(opened.outputs.out, false);
});

test('水が届く順番：蛇口→仕掛け→出口の順に大きくなる', () => {
  const s = stage(6);
  const board = build(
    [['AND', 300, 100], ['NOT', 300, 300]],
    [
      [A, pin('p1', 'in0')],
      [B, pin('p1', 'in1')],
      [outPin('p1'), pin('p2', 'in0')],
      [outPin('p2'), out('out')],
    ],
  );
  assert.deepEqual(flowLevels(board, s), {
    parts: { p1: 1, p2: 2 },
    wires: [0, 0, 1, 2],
    outlets: { out: 3 },
  });
});

test('水が届く順番：ぐるぐる回る水路があると null', () => {
  const s = stage(2);
  const board = build(
    [['NOT', 300, 100], ['NOT', 500, 100]],
    [[outPin('p2'), pin('p1', 'in0')], [outPin('p1'), pin('p2', 'in0')]],
  );
  assert.equal(flowLevels(board, s), null);
});
