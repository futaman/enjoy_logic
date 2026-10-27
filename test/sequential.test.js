import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENTIAL_STAGES, ALL_STAGES, COMBINATIONAL_STAGES } from '../src/stages.js';
import { checkCircuit, expectedOf, simulate, timeLabel } from '../src/logic.js';
import { addPart, connect, createBoard, flowLevels, liveTimes, ruleProblems } from '../src/board.js';
import { ALL_DOG_FORMS, DOG_FORMS, RARE_DOG_FORMS, dogFormFor, dogReaction, gateLine } from '../src/reactions.js';

const stage = (no) => ALL_STAGES.find((s) => s.no === no);
const mouths = (s, name = 'd1') => s.times.map((time) => (time.outputs[name] === 'open' ? 1 : 0)).join('');

test('順序回路編は、組み合わせ回路編のあとに番号が続き、8拍の予定表を持つ', () => {
  assert.equal(SEQUENTIAL_STAGES[0].no, COMBINATIONAL_STAGES.length + 1);
  assert.equal(ALL_STAGES.length, COMBINATIONAL_STAGES.length + SEQUENTIAL_STAGES.length);
  for (const s of SEQUENTIAL_STAGES) {
    assert.equal(s.kind, 'seq');
    assert.equal(s.times.length, 8);
    for (const time of s.times) {
      assert.equal(time.time, 'beat');
      for (const kind of Object.values(time.outputs)) assert.ok(kind === 'open' || kind === 'shut');
    }
  }
});

test('拍の呼び名は「何拍目」', () => {
  const s = SEQUENTIAL_STAGES[0];
  assert.equal(timeLabel(s, 0), '1拍目');
  assert.equal(timeLabel(s, 7), '8拍目');
  assert.equal(timeLabel(COMBINATIONAL_STAGES.find((c) => c.times.length === 4), 2), '夕方');
});

test('ししおどしは、1拍前の水を出す（最初の拍は水なし）', () => {
  const circuit = { gates: [{ id: 'g1', type: 'DFF', inputs: [{ input: 'A' }] }], outputs: { d1: { gate: 'g1' } } };
  const s = { times: [1, 0, 1, 1].map((open) => ({ time: 'beat', faucets: { A: Boolean(open) }, outputs: { d1: 'shut' } })) };
  assert.deepEqual(simulate(circuit, s).map((time) => time.outputs.d1), [false, true, false, true]);
});

test('ししおどしを通せば、出口を入口に戻してもぐるぐるにならない（1拍おきに 1 と 0）', () => {
  const s = SEQUENTIAL_STAGES.find((x) => x.title === '1拍おき');
  assert.deepEqual(simulate(s.solution, s).map((time) => (time.outputs.d1 ? 1 : 0)).join(''), mouths(s));
});

test('パクパク君は、口を開けている拍だけ水が欲しい', () => {
  const s = SEQUENTIAL_STAGES.find((x) => x.title === 'ししおどし'); // 口：01001101
  assert.deepEqual(expectedOf(s.times[1]), { d1: true });
  assert.deepEqual(expectedOf(s.times[2]), { d1: false });
});

test('違う回路は、最初に合わなかった拍を返す', () => {
  const s = SEQUENTIAL_STAGES.find((x) => x.title === 'ししおどし'); // 1拍おくれが正解。直接つなぐと1拍目でかみつかれる
  const result = checkCircuit({ gates: [], outputs: { d1: { input: 'A' } } }, s);
  assert.equal(result.ok, false);
  assert.equal(result.time, 0);
  assert.deepEqual(result.actual, { d1: true });
});

test('盤面でも拍ごとに水の様子が出て、ししおどしは水の出発点として扱う', () => {
  const s = SEQUENTIAL_STAGES.find((x) => x.title === 'ししおどし');
  let board = addPart(createBoard(), 'DFF', 300, 100);
  board = connect(board, { faucet: 'A' }, { part: 'p1', pin: 'in0' });
  board = connect(board, { part: 'p1', pin: 'out' }, { outlet: 'd1' });
  const times = liveTimes(board, s);
  assert.equal(times.length, 8);
  assert.deepEqual(times.map((time) => (time.outputs.d1 ? 1 : 0)).join(''), mouths(s));
  assert.deepEqual(times[1].faucets, { A: false });
  assert.deepEqual(ruleProblems(board, s), []);
  assert.deepEqual(flowLevels(board, s).outlets, { d1: 2 });
});

test('ししおどしのない回路では、予定表の時間ごとに別々に動かすのと同じ', () => {
  const s = COMBINATIONAL_STAGES.find((c) => c.times.length === 4);
  const results = simulate(s.solution, s);
  results.forEach((result, i) => assert.deepEqual(result.dff, {}, `${i}`));
});

test('パクパク君は失敗するたびに姿が変わり、4回目からはレアな姿になる', () => {
  assert.deepEqual([0, 1, 2, 3].map((misses) => dogFormFor(misses).id), DOG_FORMS.map((form) => form.id));
  assert.equal(dogFormFor(4, () => 0).id, RARE_DOG_FORMS[0].id);
  assert.equal(new Set(ALL_DOG_FORMS.map((form) => form.id)).size, ALL_DOG_FORMS.length);
});

test('口を閉じているのに水が来たらかみつき、口を開けているのに来なかったら悲しむ', () => {
  assert.equal(dogReaction({ d1: false }, { d1: true }), 'bite');
  assert.equal(dogReaction({ d1: true }, { d1: false }), 'sad');
});

test('ししおどしは、水をためるときにひとこと言う', () => {
  assert.equal(gateLine('DFF', [true]), 'ためておくね');
  assert.equal(gateLine('DFF', [false]), null);
});
