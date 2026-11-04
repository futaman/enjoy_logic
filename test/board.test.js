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
  ruleProblems,
  sanitizeBoard,
  layoutOf,
  wirePaths,
  LAYOUT,
  boxPosition,
  fillTallPositions,
  movePart,
  pinPosition,
} from '../src/board.js';
import { ALL_STAGES as COMBINATIONAL_STAGES } from '../src/stages.js';

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
  const s = stage(12);
  const board = build([['NOT', 300, 100]], []);
  assert.equal(remaining(createBoard(), s, 'NOT'), 2);
  assert.equal(remaining(board, s, 'NOT'), 1);
});

test('参考解を盤面で組んだものは正解になる（ステージ6）', () => {
  const s = stage(6);
  const board = build(
    [['AND', 300, 100]],
    [[A, pin('p1', 'in0')], [B, pin('p1', 'in1')], [outPin('p1'), out('b1')]],
  );
  assert.deepEqual(checkBoard(board, s), { ok: true });
});

test('判定は、予定表の全部の時間で行う', () => {
  // ステージ6：朝（A 開 B 閉）と昼（A 閉 B 開）はおやじ、夜（両方開）は花。
  const s = stage(6);
  // 蛇口Aをそのままつなぐと、夜はうまくいくが、朝におやじに水がかかる
  const direct = build([['AND', 300, 100]], [[A, pin('p1', 'in0')], [A, pin('p1', 'in1')], [outPin('p1'), out('b1')]]);
  const result = checkBoard(direct, s);
  assert.equal(result.ok, false);
  assert.equal(result.time, 0);
  assert.deepEqual(result.expected, { b1: false });
  assert.deepEqual(result.actual, { b1: true });
});

test('つながっていない入口は水がないものとして扱う', () => {
  const s = stage(6);
  const board = build([['AND', 300, 100]], [[A, pin('p1', 'in0')], [outPin('p1'), out('b1')]]);
  assert.equal(checkBoard(board, s).ok, false);
});

test('ルール：出口は全部つなぎ、仕掛け箱の仕掛けは全部使って、丸を全部つなぐ', () => {
  const s = stage(10); // 仕掛け箱にイエスマンと多様性好き
  assert.deepEqual(ruleProblems(createBoard(), s), [
    { kind: 'outlet', outlets: ['b1', 'b2'] },
    { kind: 'tray', types: ['OR', 'XOR'] },
  ]);
  const half = build([['OR', 300, 100], ['XOR', 300, 300]], [[A, pin('p1', 'in0')], [outPin('p1'), out('b1')], [B, out('b2')]]);
  assert.deepEqual(ruleProblems(half, s), [{ kind: 'loose', parts: ['p1', 'p2'] }]);
  const full = build(
    [['OR', 300, 100], ['XOR', 300, 300]],
    [
      [A, pin('p1', 'in0')],
      [B, pin('p1', 'in1')],
      [A, pin('p2', 'in0')],
      [B, pin('p2', 'in1')],
      [outPin('p1'), out('b2')],
      [outPin('p2'), out('b1')],
    ],
  );
  assert.deepEqual(ruleProblems(full, s), []);
  assert.deepEqual(checkBoard(full, s), { ok: true });
});

test('水路がぐるぐる回ると、判定は例外になる', () => {
  const s = stage(3);
  const board = build(
    [['NOT', 300, 100], ['NOT', 500, 100]],
    [[outPin('p2'), pin('p1', 'in0')], [outPin('p1'), pin('p2', 'in0')], [outPin('p1'), out('b1')]],
  );
  assert.throws(() => checkBoard(board, s), /ぐるぐる/);
});

test('水の流れ：その時間に開いた蛇口につながった水路が1になる', () => {
  const s = stage(5); // 朝は A 開、夜は A 閉
  const board = build(
    [['NOT', 300, 100]],
    [[A, pin('p1', 'in0')], [outPin('p1'), out('b2')]],
  );
  const morning = liveState(board, s, s.times[0].faucets);
  assert.deepEqual(morning.wires, [true, false]);
  assert.equal(morning.outputs.b2, false);
  const night = liveState(board, s, s.times[1].faucets);
  assert.deepEqual(night.wires, [false, true]);
  assert.equal(night.outputs.b2, true);
});

test('水が届く順番：蛇口→仕掛け→出口の順に大きくなる', () => {
  const s = stage(7);
  const board = build(
    [['NOT', 300, 300], ['AND', 400, 100]],
    [
      [A, pin('p1', 'in0')],
      [B, pin('p2', 'in0')],
      [outPin('p1'), pin('p2', 'in1')],
      [outPin('p2'), out('b1')],
    ],
  );
  assert.deepEqual(flowLevels(board, s), {
    parts: { p1: 1, p2: 2 },
    wires: [0, 0, 1, 2],
    outlets: { b1: 3 },
  });
});

test('水が届く順番：ぐるぐる回る水路があると null', () => {
  const s = stage(3);
  const board = build(
    [['NOT', 300, 100], ['NOT', 500, 100]],
    [[outPin('p2'), pin('p1', 'in0')], [outPin('p1'), pin('p2', 'in0')]],
  );
  assert.equal(flowLevels(board, s), null);
});

test('古い盤面を読み込んでも、ステージにない蛇口・出口・仕掛けへの水路は消える', () => {
  const s = stage(3); // 蛇口A、花だん b1、天野君1つ
  const old = {
    parts: [
      { id: 'p1', type: 'AND', x: 300, y: 100 },
      { id: 'p2', type: 'NOT', x: 300, y: 200 },
      { id: 'p3', type: 'NOT', x: 300, y: 300 },
    ],
    wires: [
      { from: A, to: pin('p1', 'in0') },
      { from: B, to: pin('p2', 'in0') },
      { from: A, to: pin('p2', 'in0') },
      { from: outPin('p2'), to: out('out') },
      { from: outPin('p2'), to: out('b1') },
    ],
  };
  assert.deepEqual(sanitizeBoard(old, s), {
    parts: [{ id: 'p2', type: 'NOT', x: 300, y: 200 }],
    wires: [
      { from: A, to: pin('p2', 'in0') },
      { from: outPin('p2'), to: out('b1') },
    ],
  });
  assert.deepEqual(sanitizeBoard(null, s), createBoard());
});

test('庭は、仕掛けが3つ以上のステージで横に広がり、出口は右端に寄る', () => {
  assert.equal(layoutOf(stage(5)).width, LAYOUT.width); // 仕掛け1つ
  const wide = layoutOf(stage(12)); // 仕掛け4つ
  assert.ok(wide.width > layoutOf(stage(11)).width); // 仕掛け3つ
  assert.ok(layoutOf(stage(11)).width > LAYOUT.width);
  assert.equal(wide.width - wide.outletX, LAYOUT.width - LAYOUT.outletX);
  // 広い庭では、仕掛けをもっと右まで置ける
  const board = addPart(createBoard(), 'NOT', 2000, 100, wide);
  assert.ok(board.parts[0].x > LAYOUT.outletX);
});

test('別の水が流れる水路は、縦の線が重ならないようにずらす', () => {
  const s = stage(12);
  const C = { faucet: 'C' };
  // 3つの蛇口から、同じ高さに置いた仕掛けへ。真ん中で曲がると縦の線が重なる
  const board = build(
    [['NOT', 400, 160], ['NOT', 400, 160], ['NOT', 400, 160]],
    [[A, pin('p1', 'in0')], [B, pin('p2', 'in0')], [C, pin('p3', 'in0')]],
  );
  const xs = wirePaths(s, board).map((path) => path.x);
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) assert.ok(Math.abs(xs[i] - xs[j]) >= 14, `${xs}`);
  }
});

test('同じ出口から分かれた水路は、同じ縦の線を通ってよい', () => {
  const s = stage(12);
  const board = build([['NOT', 400, 160], ['NOT', 400, 160]], [[A, pin('p1', 'in0')], [A, pin('p2', 'in0')]]);
  const [first, second] = wirePaths(s, board);
  assert.equal(first.x, second.x);
});

// ---------- 縦長の庭（スマホ） ----------

test('縦長の庭：蛇口が上、出口が下に並び、スマホの幅に収まる', () => {
  const s = stage(12); // 蛇口2つ、花だん2つ、仕掛け4つ
  const T = layoutOf(s, 'tall');
  assert.equal(T.orientation, 'tall');
  assert.ok(T.width <= 360, `${T.width}`);
  const a = boxPosition(s, createBoard(), A, T);
  const b = boxPosition(s, createBoard(), B, T);
  const outlet = boxPosition(s, createBoard(), out('b1'), T);
  assert.equal(a.y, b.y);
  assert.ok(b.x >= a.x + T.partWidth, '蛇口が横に並ぶ');
  assert.ok(outlet.y > T.gateBottom, '出口は仕掛けの段より下');
  assert.ok(T.height >= outlet.y + T.partHeight);
  // 段は3段まで（ステージ20の3つ続きが置ける）
  assert.equal(T.rows, 3);
});

test('縦長の庭：出口は箱の下、入口は箱の上。水路は下へ出て、曲がって、上から入る', () => {
  const s = stage(7);
  const T = layoutOf(s, 'tall');
  let board = addPart(createBoard(), 'AND', 20, T.gateTop, T);
  board = connect(board, A, pin('p1', 'in0'));
  const faucet = boxPosition(s, board, A, T);
  assert.deepEqual(pinPosition(s, board, A, T), { x: faucet.x + T.partWidth / 2, y: faucet.y + T.partHeight });
  const part = boxPosition(s, board, { part: 'p1' }, T);
  const in0 = pinPosition(s, board, pin('p1', 'in0'), T);
  const in1 = pinPosition(s, board, pin('p1', 'in1'), T);
  assert.equal(in0.y, part.y);
  assert.ok(in0.x < in1.x);
  assert.equal(pinPosition(s, board, outPin('p1'), T).y, part.y + T.partHeight);
  const [path] = wirePaths(s, board, T);
  assert.match(path.d, /^M\S+ \S+ V\S+ H\S+ V\S+$/);
});

test('縦長の庭で置いた仕掛けは、横長の庭での置き場所も持つ。動かすのは今の向きだけ', () => {
  const s = stage(7);
  const T = layoutOf(s, 'tall');
  const W = layoutOf(s);
  let board = addPart(createBoard(), 'NOT', 100, T.gateTop + 20, T);
  const placed = board.parts[0];
  assert.deepEqual(placed.tall, { x: 100, y: T.gateTop + 20 });
  assert.ok(placed.x >= 150 && placed.x <= W.outletX - 30 - W.partWidth);
  assert.ok(placed.y >= 10 && placed.y <= W.height - W.partHeight - 10);
  board = movePart(board, 'p1', 40, T.gateTop, T);
  assert.deepEqual(board.parts[0].tall, { x: 40, y: T.gateTop });
  assert.equal(board.parts[0].x, placed.x, '横長の置き場所はそのまま');
  board = movePart(board, 'p1', 300, 200, W);
  assert.deepEqual(board.parts[0].tall, { x: 40, y: T.gateTop }, '縦長の置き場所はそのまま');
});

test('横長の庭で置いた仕掛けには、縦長の庭で水の流れる順に重ならない置き場所が付く', () => {
  const s = stage(12);
  const T = layoutOf(s, 'tall');
  const board = build(
    [['NOT', 300, 40], ['NOT', 300, 190], ['AND', 450, 40], ['OR', 450, 190]],
    [
      [A, pin('p1', 'in0')],
      [B, pin('p2', 'in0')],
      [outPin('p1'), pin('p3', 'in0')],
      [outPin('p2'), pin('p3', 'in1')],
      [outPin('p1'), pin('p4', 'in0')],
      [outPin('p2'), pin('p4', 'in1')],
    ],
  );
  const filled = fillTallPositions(board, s);
  const spots = filled.parts.map((part) => part.tall);
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const apart = Math.abs(spots[i].x - spots[j].x) >= T.partWidth || Math.abs(spots[i].y - spots[j].y) >= T.partHeight;
      assert.ok(apart, `${i} と ${j} が重なる`);
    }
  }
  // 天野君（1段目の水）は、カタブツ・イエスマン（2段目の水）より上
  assert.ok(spots[0].y < spots[2].y && spots[1].y < spots[3].y);
  // 全部に置き場所があれば、同じ盤面のまま
  assert.equal(fillTallPositions(filled, s), filled);
});
