import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENTIAL_STAGES, ALL_STAGES, COMBINATIONAL_STAGES } from '../src/stages.js';
import { checkSequence, expectedAt, faucetsAt, simulate } from '../src/logic.js';
import { addPart, connect, createBoard, flowLevels, liveSequence, ruleProblems } from '../src/board.js';
import { CHARACTERS } from '../src/characters.js';
import { ALL_DOG_FORMS, DOG_FORMS, RARE_DOG_FORMS, dogFormFor, dogReaction, gateLine } from '../src/reactions.js';

// 番号は組み合わせ回路編の数で変わるので、名前で探す
const stage = (title) => SEQUENTIAL_STAGES.find((s) => s.title === title);

for (const s of SEQUENTIAL_STAGES) {
  test(`順序${s.no}（${s.title}）：参考解が全部の拍で正解になり、仕掛け箱の中身ちょうどで作れる`, () => {
    assert.deepEqual(checkSequence(s.solution, s), { ok: true });
    const used = {};
    for (const gate of s.solution.gates) used[gate.type] = (used[gate.type] ?? 0) + 1;
    assert.deepEqual(used, s.tray);
    for (const row of [...Object.values(s.faucets), ...Object.values(s.mouth)]) assert.equal(row.length, s.beats);
    for (const kind of Object.values(s.outputs)) assert.equal(kind, 'dog');
    for (const key of [...s.intro, ...Object.keys(s.tray)]) assert.ok(CHARACTERS[key], key);
  });
}

test('順序回路編は、組み合わせ回路編のあとに番号が続く', () => {
  assert.equal(SEQUENTIAL_STAGES[0].no, COMBINATIONAL_STAGES.length + 1);
  assert.equal(ALL_STAGES.length, COMBINATIONAL_STAGES.length + SEQUENTIAL_STAGES.length);
});

test('ししおどしは、1拍前の水を出す（最初の拍は水なし）', () => {
  const circuit = { gates: [{ id: 'g1', type: 'DFF', inputs: [{ input: 'A' }] }], outputs: { d1: { gate: 'g1' } } };
  const s = { beats: 4, faucets: { A: [1, 0, 1, 1] }, outputs: { d1: 'dog' }, mouth: { d1: [0, 1, 0, 1] } };
  assert.deepEqual(simulate(circuit, s).map((beat) => beat.outputs.d1), [false, true, false, true]);
});

test('ししおどしを通せば、出口を入口に戻してもぐるぐるにならない（1拍おきに 1 と 0）', () => {
  const s = stage('1拍おき');
  assert.deepEqual(simulate(s.solution, s).map((beat) => beat.outputs.d1), s.mouth.d1.map(Boolean));
});

test('拍ごとの蛇口と、パクパク君が欲しいもの', () => {
  const s = stage('ししおどし');
  assert.deepEqual(faucetsAt(s, 3), { A: true });
  assert.deepEqual(expectedAt(s, 1), { d1: true });
  assert.deepEqual(expectedAt(s, 2), { d1: false });
});

test('違う回路は、最初に合わなかった拍を返す', () => {
  const s = stage('ししおどし'); // 1拍おくれが正解。直接つなぐと1拍目で口を閉じているのに水が来る
  const direct = { gates: [], outputs: { d1: { input: 'A' } } };
  const result = checkSequence(direct, s);
  assert.equal(result.ok, false);
  assert.equal(result.beat, 0);
  assert.deepEqual(result.actual, { d1: true });
});

test('盤面でも拍ごとに水の様子が出て、ししおどしは水の出発点として扱う', () => {
  const s = stage('ししおどし');
  let board = addPart(createBoard(), 'DFF', 300, 100);
  board = connect(board, { faucet: 'A' }, { part: 'p1', pin: 'in0' });
  board = connect(board, { part: 'p1', pin: 'out' }, { outlet: 'd1' });
  const beats = liveSequence(board, s);
  assert.equal(beats.length, s.beats);
  assert.deepEqual(beats.map((beat) => beat.outputs.d1), [false, true, false, false, true, true, false, true]);
  assert.deepEqual(beats[1].faucets, { A: false });
  assert.deepEqual(ruleProblems(board, s), []);
  assert.deepEqual(flowLevels(board, s).outlets, { d1: 2 });
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
