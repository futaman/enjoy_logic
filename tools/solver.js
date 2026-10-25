// パズルとして成り立っているかを確かめるための、総当たりの解き手（画面では使わない）。
// ルールはアプリ（src/board.js の ruleProblems と checkBoard）と同じ：
//   - 仕掛け箱の仕掛けは全部置き、入口も出口も全部つなぐ（つながない入口で 0 を作ることはできない）
//   - 出口（花だん）は全部つなぐ。1つの出口から何本でも分けてよい。水路はぐるぐる回してはいけない
//   - 予定表の時間（朝・昼・夜）すべてで、花だんの言うとおりになれば正解
// 速くするため、値は「時間ごとの水のあるなし」をビットに並べた数で持つ（朝＝1ビット目…）。
import { GATE_ARITY } from '../src/logic.js';

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

// ステージの蛇口・花だんを、時間ごとのビットにする。
export function masksOf(stage) {
  const times = stage.times;
  const bits = (pick) => times.reduce((mask, time, i) => mask | (pick(time) ? 1 << i : 0), 0);
  const inputs = Object.keys(times[0].faucets);
  const outlets = Object.keys(times[0].outputs);
  return {
    full: (1 << times.length) - 1,
    inputs,
    outlets,
    faucet: inputs.map((name) => bits((time) => time.faucets[name])),
    want: outlets.map((name) => bits((time) => time.outputs[name] === 'flower')),
  };
}

// types の仕掛けをちょうど全部使う解を1つ探す。なければ null。
// 解は src/logic.js の回路の形（{ gates, outputs }）で返す。
export function findSolution(stage, types) {
  const { full, inputs, outlets, faucet, want } = masksOf(stage);
  // 出口に要る値ごとの、花だんの数
  const outletsByWant = new Map();
  for (const w of want) outletsByWant.set(w, (outletsByWant.get(w) ?? 0) + 1);

  for (const order of orders(types)) {
    // 仕掛けは並べた順に置き、入口には蛇口か「前に置いた仕掛け」だけをつなぐ（これでぐるぐるは起きない）。
    // どんな回路も水の流れる順に並べられるので、並べ方を全部試せば取りこぼしはない。
    const sources = [...faucet]; // 値（ビット）
    const used = new Array(order.length).fill(0);
    const picks = [];

    const finish = () => {
      // 使われていない仕掛けは、どれかの花だんにつなぐしかない。値の合う花だんが足りるか。
      const need = new Map();
      for (let g = 0; g < order.length; g++) {
        if (used[g] > 0) continue;
        const value = sources[inputs.length + g];
        need.set(value, (need.get(value) ?? 0) + 1);
      }
      for (const [value, count] of need) if ((outletsByWant.get(value) ?? 0) < count) return null;
      // どの花だんにも、値の合う水の元が要る
      const loose = [...Array(order.length).keys()].filter((g) => used[g] === 0);
      const taken = new Set();
      const outputs = {};
      for (let o = 0; o < outlets.length; o++) {
        const g = loose.find((candidate) => !taken.has(candidate) && sources[inputs.length + candidate] === want[o]);
        let index = g === undefined ? sources.findIndex((value) => value === want[o]) : inputs.length + g;
        if (index < 0) return null;
        if (g !== undefined) taken.add(g);
        outputs[outlets[o]] = refOf(index);
      }
      return outputs;
    };
    const refOf = (index) => (index < inputs.length ? { input: inputs[index] } : { gate: `g${index - inputs.length + 1}` });

    const place = (g) => {
      if (g === order.length) return finish();
      const type = order[g];
      const count = sources.length; // 蛇口と、前に置いた仕掛け
      const arity = GATE_ARITY[type];
      for (let a = 0; a < count; a++) {
        for (let b = arity === 1 ? 0 : SYMMETRIC.has(type) ? a : 0; b < (arity === 1 ? 1 : count); b++) {
          const pins = arity === 1 ? [a] : [a, b];
          for (const pin of pins) if (pin >= inputs.length) used[pin - inputs.length] += 1;
          sources.push(OPS[type](full, ...pins.map((pin) => sources[pin])));
          picks.push(pins);
          const outputs = place(g + 1);
          if (outputs) return outputs;
          picks.pop();
          sources.pop();
          for (const pin of pins) if (pin >= inputs.length) used[pin - inputs.length] -= 1;
        }
      }
      return null;
    };

    const outputs = place(0);
    if (outputs) {
      const gates = order.map((type, g) => ({ id: `g${g + 1}`, type, inputs: picks[g].map(refOf) }));
      return { gates, outputs };
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
export function shortcuts(stage, known, { first = false } = {}) {
  const types = expandTray(stage.tray);
  const found = [];
  for (const type of new Set(types)) {
    const index = types.indexOf(type);
    const without = types.filter((_, i) => i !== index);
    const removed = findSolution(stage, without);
    if (removed) found.push({ type, change: '抜く', solution: removed });
    for (const other of known) {
      if (first && found.length) return found;
      if (other === type) continue;
      const replaced = findSolution(stage, types.map((t, i) => (i === index ? other : t)));
      if (replaced) found.push({ type, change: `${other}に替える`, solution: replaced });
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
