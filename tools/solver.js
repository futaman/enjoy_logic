// パズルとして成り立っているかを確かめるための、総当たりの解き手（画面では使わない）。
// ルールはアプリ（src/board.js の ruleProblems と checkBoard）と同じ：
//   - 仕掛け箱の仕掛けは全部置き、入口も出口も全部つなぐ（つながない入口で 0 を作ることはできない）
//   - 出口は全部つなぐ。1つの出口から何本でも分けてよい。水路はぐるぐる回してはいけない
//     （ただし、ししおどしを通るなら出口を入口に戻してよい）
//   - 予定表の時間すべてで、出口のキャラの言うとおりになれば正解
// 速くするため、値は「時間ごとの水のあるなし」をビットに並べた数で持つ（1回目の時間＝1ビット目…）。
// ししおどし（DFF）は1拍おくれて水を出すので、入口のビットを1つずらしたものが出口になる（最初の拍は水なし）。
import { GATE_ARITY, WANTS_WATER } from '../src/logic.js';

const OPS = {
  NOT: (full, a) => ~a & full,
  AND: (full, a, b) => a & b,
  OR: (full, a, b) => a | b,
  XOR: (full, a, b) => a ^ b,
};
const SYMMETRIC = new Set(['AND', 'OR', 'XOR']);

// 仕掛け箱 { NOT: 2, AND: 1 } → ['NOT', 'NOT', 'AND']
export const expandTray = (tray) => Object.entries(tray).flatMap(([type, count]) => Array(count).fill(type));

// 同じものを含む並びの、重ならない並べ方を全部。
function* orders(types) {
  if (types.length === 0) {
    yield [];
    return;
  }
  for (const type of new Set(types)) {
    const rest = [...types];
    rest.splice(rest.indexOf(type), 1);
    for (const tail of orders(rest)) yield [type, ...tail];
  }
}

// ステージの蛇口・出口を、時間ごとのビットにする。
export function masksOf(stage) {
  const times = stage.times;
  const bits = (pick) => times.reduce((mask, time, i) => mask | (pick(time) ? 1 << i : 0), 0);
  const inputs = Object.keys(times[0].faucets);
  const outlets = Object.keys(times[0].outputs);
  return {
    full: (1 << times.length) - 1,
    count: times.length,
    inputs,
    outlets,
    faucet: inputs.map((name) => bits((time) => time.faucets[name])),
    want: outlets.map((name) => bits((time) => WANTS_WATER[time.outputs[name]])),
  };
}

// 選んだ候補の中から、ぜんぶの組み合わせを順に作る（候補の番号の並びを返す）。
function* choices(sizes) {
  const pick = new Array(sizes.length).fill(0);
  if (sizes.some((size) => size === 0)) return;
  while (true) {
    yield pick;
    let i = 0;
    while (i < sizes.length && ++pick[i] === sizes[i]) pick[i++] = 0;
    if (i === sizes.length) return;
  }
}

// types の仕掛けをちょうど全部使う解を1つ探す。なければ null。
// 解は src/logic.js の回路の形（{ gates, outputs }）で返す。
export function findSolution(stage, types) {
  const { full, count, inputs, outlets, faucet, want } = masksOf(stage);
  const n = inputs.length;
  // 出口に要る値ごとの、出口の数
  const outletsByWant = new Map();
  for (const w of want) outletsByWant.set(w, (outletsByWant.get(w) ?? 0) + 1);

  const dffCount = types.filter((type) => type === 'DFF').length;
  const others = types.filter((type) => type !== 'DFF');

  for (const order of orders(others)) {
    // 水の元の並び：蛇口、ししおどし、ほかの仕掛け（並べた順）。
    // ほかの仕掛けの入口には、蛇口・ししおどし・「前に置いた仕掛け」だけをつなぐ（これでぐるぐるは起きない）。
    // ししおどしの入口には、自分以外の何をつないでもよい。
    // どんな回路も水の流れる順に並べられるので、並べ方を全部試せば取りこぼしはない。
    const total = n + dffCount + order.length;
    const pinSizes = [];
    order.forEach((type, c) => {
      for (let p = 0; p < GATE_ARITY[type]; p++) pinSizes.push(n + dffCount + c);
    });
    for (let d = 0; d < dffCount; d++) pinSizes.push(total - 1);
    const pinStart = [];
    order.reduce((at, type) => (pinStart.push(at), at + GATE_ARITY[type]), 0);
    const dffPin = (d, pick) => {
      const raw = pick[pinStart.length ? pinStart.at(-1) + GATE_ARITY[order.at(-1)] + d : d];
      return raw >= n + d ? raw + 1 : raw; // 自分自身は飛ばす
    };

    for (const pick of choices(pinSizes)) {
      // 2つ入口のある仕掛けは、入口を入れ替えても同じなので片方だけ調べる
      if (order.some((type, c) => SYMMETRIC.has(type) && pick[pinStart[c]] > pick[pinStart[c] + 1])) continue;
      const pinsOf = (c) => Array.from({ length: GATE_ARITY[order[c]] }, (_, p) => pick[pinStart[c] + p]);
      const dffIn = Array.from({ length: dffCount }, (_, d) => dffPin(d, pick));

      // 時間ごとの水を求める。ししおどしの出口は、入口を1拍ずらしたもの。拍の数だけくり返せば決まる
      const values = [...faucet, ...new Array(dffCount + order.length).fill(0)];
      for (let round = 0; round <= count; round++) {
        order.forEach((type, c) => {
          values[n + dffCount + c] = OPS[type](full, ...pinsOf(c).map((pin) => values[pin]));
        });
        let changed = false;
        for (let d = 0; d < dffCount; d++) {
          const next = (values[dffIn[d]] << 1) & full;
          if (next !== values[n + d]) changed = true;
          values[n + d] = next;
        }
        if (!changed) break;
      }

      // 使われていない仕掛けは、どれかの出口につなぐしかない。値の合う出口が足りるか
      const used = new Array(total).fill(false);
      for (let c = 0; c < order.length; c++) for (const pin of pinsOf(c)) used[pin] = true;
      for (const pin of dffIn) used[pin] = true;
      const loose = [];
      for (let i = n; i < total; i++) if (!used[i]) loose.push(i);
      const need = new Map();
      for (const i of loose) need.set(values[i], (need.get(values[i]) ?? 0) + 1);
      if ([...need].some(([value, k]) => (outletsByWant.get(value) ?? 0) < k)) continue;
      // どの出口にも、値の合う水の元が要る
      const taken = new Set();
      const outputs = {};
      let ok = true;
      for (let o = 0; o < outlets.length && ok; o++) {
        const g = loose.find((i) => !taken.has(i) && values[i] === want[o]);
        const index = g ?? values.findIndex((value) => value === want[o]);
        if (index < 0) ok = false;
        if (g !== undefined) taken.add(g);
        outputs[outlets[o]] = index;
      }
      if (!ok) continue;

      // 回路の形にする。仕掛けの id は、ししおどし → ほかの仕掛けの順に g1, g2, …
      const refOf = (index) => (index < n ? { input: inputs[index] } : { gate: `g${index - n + 1}` });
      const gates = [
        ...dffIn.map((pin, d) => ({ id: `g${d + 1}`, type: 'DFF', inputs: [refOf(pin)] })),
        ...order.map((type, c) => ({ id: `g${dffCount + c + 1}`, type, inputs: pinsOf(c).map(refOf) })),
      ];
      return { gates, outputs: Object.fromEntries(Object.entries(outputs).map(([name, i]) => [name, refOf(i)])) };
    }
  }
  return null;
}

// stages[index] までに出てきた仕掛けの種類（紹介カードの intro から）。
export function knownGates(stages, index) {
  const keys = stages.slice(0, index + 1).flatMap((stage) => stage.intro);
  return keys.filter((key) => key in GATE_ARITY);
}

// 仕掛け箱の仕掛けが、本当に要るかを調べる。
// 仕掛けを1つ「抜く」か、それまでに出てきた別の仕掛けに「替える」と解けてしまうなら、その仕掛けの働きは要らない。
// known は、このステージまでに出てきた仕掛けの種類。返すのは、抜け道（解けてしまう替え方）の一覧。
// first を true にすると、1つ見つけたところでやめる（ステージを考えるときに速く回すため）。
// ステージの accepted に書いた別解（仕掛け箱にない仕掛けを使う別解で、遊ぶ人は使えないもの）は数えない。
export function shortcuts(stage, known, { first = false } = {}) {
  const accepted = (type, change) => (stage.accepted ?? []).some((a) => a.type === type && a.change === change);
  const types = expandTray(stage.tray);
  const found = [];
  for (const type of new Set(types)) {
    const index = types.indexOf(type);
    const without = types.filter((_, i) => i !== index);
    const removed = findSolution(stage, without);
    if (removed && !accepted(type, '抜く')) found.push({ type, change: '抜く', solution: removed });
    for (const other of known) {
      if (first && found.length) return found;
      if (other === type) continue;
      const replaced = findSolution(stage, types.map((t, i) => (i === index ? other : t)));
      if (replaced && !accepted(type, `${other}に替える`)) found.push({ type, change: `${other}に替える`, solution: replaced });
    }
  }
  return found;
}

// 回路を1行で書く（報告用）。
export function describe(circuit) {
  const ref = (r) => ('input' in r ? r.input : r.gate);
  return [
    ...circuit.gates.map((gate) => `${gate.id}=${gate.type}(${gate.inputs.map(ref).join(',')})`),
    ...Object.entries(circuit.outputs).map(([name, r]) => `${name}←${ref(r)}`),
  ].join('  ');
}
