import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ANGERS,
  ANGER_LEVELS,
  RARE_ANGERS,
  angerFor,
  failureKind,
  gateLine,
  growthFor,
  hostLine,
  wiltFor,
} from '../src/reactions.js';

test('おやじは1〜4回目まで順に激しく怒る', () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((count) => angerFor(count).id),
    ['kora', 'steam', 'giant', 'rocket'],
  );
});

test('5回目からはレア演出が出る', () => {
  assert.equal(angerFor(5, () => 0).id, RARE_ANGERS[0].id);
  assert.equal(angerFor(9, () => 0.999).id, RARE_ANGERS.at(-1).id);
});

test('おやじ図鑑には、怒り方が重ならずに全部並ぶ', () => {
  const ids = ALL_ANGERS.map((anger) => anger.id);
  assert.equal(new Set(ids).size, ANGER_LEVELS.length + RARE_ANGERS.length);
});

test('花は段階を追って大きく育ち、4段目で森になる', () => {
  assert.equal(growthFor(0), null);
  const scales = [1, 2, 3, 4, 5].map((level) => growthFor(level).scale);
  for (let i = 1; i < 4; i++) assert.ok(scales[i] > scales[i - 1]);
  assert.equal(growthFor(4).name, 'ひまわりの森');
  assert.equal(growthFor(9).level, 4);
});

test('花は失敗するたびにしおれ方が進む', () => {
  assert.deepEqual([1, 2, 3, 7].map((count) => wiltFor(count).level), [1, 2, 3, 3]);
});

test('仕掛けのひとことは、来た水で決まる', () => {
  assert.equal(gateLine('NOT', [true]), 'やだね！');
  assert.equal(gateLine('NOT', [false]), 'じゃあ出す！');
  assert.equal(gateLine('AND', [true, true]), 'よし、通れ！');
  assert.equal(gateLine('AND', [true, false]), '規則ですので');
  assert.equal(gateLine('AND', [false, false]), null);
  assert.equal(gateLine('OR', [false, true]), 'はいはい！');
  assert.equal(gateLine('XOR', [true, false]), 'ちがうっていいね！');
  assert.equal(gateLine('XOR', [true, true]), 'おんなじは、つまらん');
});

test('失敗の種類：おやじに水がかかったらおやじの演出を優先する', () => {
  assert.equal(failureKind({ f1: true, o1: false }, { f1: false, o1: true }), 'oyaji');
  assert.equal(failureKind({ f1: true }, { f1: false }), 'flower');
  assert.equal(failureKind({ f1: true }, null), 'loop');
});

test('司会の一言は、プレイヤーを責めない', () => {
  const lines = [1, 2, 3, 4, 5].flatMap((count) => ['oyaji', 'flower', 'loop'].map((kind) => hostLine(kind, count)));
  for (const line of lines) assert.doesNotMatch(line, /ダメ|不正解|間違い/);
});
