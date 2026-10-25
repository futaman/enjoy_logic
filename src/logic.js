// 回路の評価。仕掛け（ゲート）は入力や他の仕掛けから値を受け取り、1つの値を出す。
// 1 は「水が流れている」、0 は「水がない」。

export const GATE_ARITY = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
  NAND: 2,
  NOR: 2,
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
export function solve(circuit, values) {
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
    if (visiting.has(ref.gate)) throw new Error(`水路がぐるぐる回っている: ${ref.gate}`);

    const gate = gateById.get(ref.gate);
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
  return { gates, outputs };
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

// 出口ごとの「正しい答え」。花は水が欲しい（1）、おやじは水をかけない（0）。
export function expectedOf(stage) {
  return Object.fromEntries(Object.entries(stage.outputs).map(([name, kind]) => [name, kind === 'flower']));
}

// 画面に見えている蛇口の開け方（1つだけ）で回路を動かし、出口ごとの答えと比べる。
// 手で回せる蛇口があるステージでは、プレイヤーが回したあとの開け方を faucets に渡す。
// 全部合えば { ok: true }、違えば出口ごとの値を返す。
export function checkCircuit(circuit, stage, faucets = stage.faucets) {
  const expected = expectedOf(stage);
  const actual = evaluate(circuit, faucets);
  const same = Object.keys(expected).every((name) => expected[name] === actual[name]);
  return same ? { ok: true } : { ok: false, expected, actual };
}
