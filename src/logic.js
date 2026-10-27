// 回路の評価。仕掛け（ゲート）は入力や他の仕掛けから値を受け取り、1つの値を出す。
// 1 は「水が流れている」、0 は「水がない」。
// DFF（ししおどし）だけは記憶を持つ。拍の間はためている水（state）を出し、
// カコンと鳴って次の拍になるとき、入口に来ている水をためる。だから1拍おくれて水が出る。

export const GATE_ARITY = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
  NAND: 2,
  NOR: 2,
  DFF: 1,
};

const GATE_FUNCS = {
  NOT: ([a]) => !a,
  AND: ([a, b]) => a && b,
  OR: ([a, b]) => a || b,
  XOR: ([a, b]) => a !== b,
  NAND: ([a, b]) => !(a && b),
  NOR: ([a, b]) => !(a || b),
};

// 回路の形:
// {
//   gates: [{ id: 'g1', type: 'AND', inputs: [{ input: 'A' }, { gate: 'g2' }] }, ...],
//   outputs: { out: { gate: 'g1' } },
// }
// 参照は { input: '蛇口名' } か { gate: '仕掛けのid' }。
export function validateCircuit(circuit) {
  const gateIds = new Set();
  for (const gate of circuit.gates) {
    if (gateIds.has(gate.id)) throw new Error(`仕掛けのidが重なっている: ${gate.id}`);
    gateIds.add(gate.id);
    if (!(gate.type in GATE_ARITY)) throw new Error(`知らない仕掛け: ${gate.type}`);
    if (gate.inputs.length !== GATE_ARITY[gate.type]) {
      throw new Error(`${gate.id}（${gate.type}）の入口の数が違う`);
    }
  }
  const refs = [
    ...circuit.gates.flatMap((gate) => gate.inputs),
    ...Object.values(circuit.outputs),
  ];
  for (const ref of refs) {
    if ('gate' in ref && !gateIds.has(ref.gate)) throw new Error(`存在しない仕掛け: ${ref.gate}`);
  }
}

// 出口の値と、すべての仕掛けの出力を返す（水路の色づけに使う）。
// dffState は、ししおどしがそれぞれためている水（{ 仕掛けのid: true/false }、ないものは false）。
// next は、カコンのあと（次の拍）にししおどしがためる水。
export function solve(circuit, values, dffState = {}) {
  validateCircuit(circuit);
  const gateById = new Map(circuit.gates.map((gate) => [gate.id, gate]));
  const cache = new Map();

  const valueOf = (ref, visiting) => {
    if ('const' in ref) return ref.const;
    if ('input' in ref) {
      if (!(ref.input in values)) throw new Error(`蛇口の値がない: ${ref.input}`);
      return values[ref.input];
    }
    if (cache.has(ref.gate)) return cache.get(ref.gate);
    const gate = gateById.get(ref.gate);
    // ししおどしは、ためている水を出すだけ（入口はたどらないので、出口を戻す回路も作れる）
    if (gate.type === 'DFF') return Boolean(dffState[gate.id]);
    if (visiting.has(ref.gate)) throw new Error(`水路がぐるぐる回っている: ${ref.gate}`);

    visiting.add(ref.gate);
    const result = GATE_FUNCS[gate.type](gate.inputs.map((input) => valueOf(input, visiting)));
    visiting.delete(ref.gate);
    cache.set(ref.gate, result);
    return result;
  };

  const outputs = Object.fromEntries(
    Object.entries(circuit.outputs).map(([name, ref]) => [name, valueOf(ref, new Set())]),
  );
  const gates = Object.fromEntries(
    circuit.gates.map((gate) => [gate.id, valueOf({ gate: gate.id }, new Set())]),
  );
  const next = Object.fromEntries(
    circuit.gates
      .filter((gate) => gate.type === 'DFF')
      .map((gate) => [gate.id, valueOf(gate.inputs[0], new Set())]),
  );
  return { gates, outputs, next };
}

export function evaluate(circuit, values) {
  return solve(circuit, values).outputs;
}

// 蛇口の開け方を全部並べる（仕掛けの紹介カードの表に使う）。['A', 'B'] なら 00, 01, 10, 11 の4通り。
export function allRows(inputNames) {
  const count = 2 ** inputNames.length;
  return Array.from({ length: count }, (_, n) =>
    Object.fromEntries(
      inputNames.map((name, i) => [name, Boolean((n >> (inputNames.length - 1 - i)) & 1)]),
    ),
  );
}

// 時間（予定表の1回ぶん）の呼び名。組み合わせ回路編は朝・昼・夕方・夜のうち決まった時間に水を流す。
// 順序回路編は、ししおどしが「カコン」と鳴るたびに進む「拍」（time は 'beat'。呼び名は timeLabel）。
export const TIME_NAMES = { morning: '朝', noon: '昼', evening: '夕方', night: '夜' };

export function timeLabel(stage, index) {
  const time = stage.times[index];
  return time.time === 'beat' ? `${index + 1}拍目` : TIME_NAMES[time.time];
}

// 出口にいるキャラ。花（水が欲しい＝1）、おやじ（水をかけない＝0）、
// パクパク君は口を開けている（'open'＝1）か閉じている（'shut'＝0）か。
export const WANTS_WATER = { flower: true, oyaji: false, open: true, shut: false };
export const characterOf = (kind) => (kind === 'open' || kind === 'shut' ? 'dog' : kind);

// 出口ごとの「正しい答え」。time はステージの予定表の1回ぶん（{ time, faucets, outputs }）。
export function expectedOf(time) {
  return Object.fromEntries(Object.entries(time.outputs).map(([name, kind]) => [name, WANTS_WATER[kind]]));
}

// 予定表の時間を順に回路を動かす。時間ごとの { faucets, gates, outputs, dff } を返す。
// ししおどしは、前の時間に入口へ来た水を次の時間に出す（初めは水をためていない）。
// ししおどしのない回路では、時間ごとに別々に動かすのと同じになる。
export function simulate(circuit, stage) {
  let dff = {};
  return stage.times.map((time) => {
    const { gates, outputs, next } = solve(circuit, time.faucets, dff);
    const result = { faucets: time.faucets, gates, outputs, dff };
    dff = next;
    return result;
  });
}

// 予定表の時間を順に、出口ごとの答えと比べる。
// 全部の時間で合えば { ok: true }、違う時間があれば、最初の時間とその出口ごとの値を返す。
export function checkCircuit(circuit, stage) {
  const results = simulate(circuit, stage);
  for (const [index, time] of stage.times.entries()) {
    const expected = expectedOf(time);
    const actual = results[index].outputs;
    const same = Object.keys(expected).every((name) => expected[name] === actual[name]);
    if (!same) return { ok: false, time: index, expected, actual };
  }
  return { ok: true };
}
