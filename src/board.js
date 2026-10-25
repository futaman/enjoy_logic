// 庭の上の仕掛けと水路の状態。画面からは独立しているので、テストで直接動かせる。
// 状態はすべて新しい値を返す（元の盤面は変えない）。元に戻す機能に使うため。
import { GATE_ARITY, checkCircuit, solve } from './logic.js';

// 庭の大きさと置き場所（画面の単位は px）。仕掛けが2つまでのステージの大きさ。
export const LAYOUT = {
  width: 700,
  height: 480,
  partWidth: 120,
  partHeight: 50,
  faucetX: 16,
  faucetWidth: 120,
  outletX: 560,
  rowFirst: 40,
  rowGap: 150,
};

// ステージに合わせた庭の大きさ。仕掛けが3つ以上あるステージは、1つ増えるごとに横へ広げる。
// 出口は右端に寄せる。
const EXTRA_WIDTH_PER_PART = 160;

export function layoutOf(stage) {
  const parts = Object.values(stage.tray).reduce((sum, count) => sum + count, 0);
  const width = LAYOUT.width + EXTRA_WIDTH_PER_PART * Math.max(0, parts - 2);
  return { ...LAYOUT, width, outletX: width - (LAYOUT.width - LAYOUT.outletX) };
}

export const FAUCETS = ['A', 'B', 'C'];
export const PART_NAMES = { NOT: '天野君', AND: 'カタブツ', OR: 'イエスマン', XOR: '多様性好き' };

const SNAP = 10;

// 端（pin）の表し方:
//   蛇口の出口   { faucet: 'A' }
//   仕掛けの出口 { part: 'p1', pin: 'out' }
//   仕掛けの入口 { part: 'p1', pin: 'in0' } / 'in1'
//   出口         { outlet: 'out' }
export const isSource = (end) => 'faucet' in end || end.pin === 'out';
export const isSink = (end) => 'outlet' in end || (end.pin !== undefined && end.pin !== 'out');
export const sameEnd = (a, b) =>
  a.faucet === b.faucet && a.part === b.part && a.pin === b.pin && a.outlet === b.outlet;

export const rowTop = (index) => LAYOUT.rowFirst + index * LAYOUT.rowGap;

export function pinsOf(type) {
  return GATE_ARITY[type] === 1 ? ['in0'] : ['in0', 'in1'];
}

export function createBoard() {
  return { parts: [], wires: [] };
}

export function findPart(board, id) {
  return board.parts.find((part) => part.id === id);
}

export function placedCount(board, type) {
  return board.parts.filter((part) => part.type === type).length;
}

// 仕掛け箱に残っている数。
export function remaining(board, stage, type) {
  return (stage.tray[type] ?? 0) - placedCount(board, type);
}

const snap = (value) => Math.round(value / SNAP) * SNAP;
const clampX = (x, L) => Math.min(Math.max(x, 150), L.outletX - 30 - L.partWidth);
const clampY = (y, L) => Math.min(Math.max(y, 10), L.height - L.partHeight - 10);

function nextPartId(board) {
  const largest = board.parts.reduce((max, part) => Math.max(max, Number(part.id.slice(1))), 0);
  return `p${largest + 1}`;
}

// layout は庭の大きさ（layoutOf(stage)）。仕掛けが庭からはみ出さないようにする。
export function addPart(board, type, x, y, layout = LAYOUT) {
  const part = { id: nextPartId(board), type, x: clampX(snap(x), layout), y: clampY(snap(y), layout) };
  return { ...board, parts: [...board.parts, part] };
}

export function movePart(board, id, x, y, layout = LAYOUT) {
  const parts = board.parts.map((part) =>
    part.id === id ? { ...part, x: clampX(snap(x), layout), y: clampY(snap(y), layout) } : part,
  );
  return { ...board, parts };
}

// 仕掛けを消すと、つながっていた水路もいっしょに消える。
export function removePart(board, id) {
  return {
    parts: board.parts.filter((part) => part.id !== id),
    wires: board.wires.filter((wire) => wire.from.part !== id && wire.to.part !== id),
  };
}

// 出口から入口へ水路を引く。入口には1本だけ。出口からは何本でも分けられる。
// 引けない組み合わせ（出口どうしなど）は何もしない。
export function connect(board, from, to) {
  if (!isSource(from) || !isSink(to)) return board;
  if (from.part !== undefined && !findPart(board, from.part)) return board;
  if (to.part !== undefined) {
    const part = findPart(board, to.part);
    if (!part || !pinsOf(part.type).includes(to.pin)) return board;
    if (from.part === to.part) return board;
  }
  const wires = board.wires.filter((wire) => !sameEnd(wire.to, to));
  return { ...board, wires: [...wires, { from, to }] };
}

export function disconnect(board, to) {
  return { ...board, wires: board.wires.filter((wire) => !sameEnd(wire.to, to)) };
}

// 画面上の端の位置（水路の始点・終点、ピンの置き場所）。
export function pinPosition(stage, board, end) {
  const L = layoutOf(stage);
  if ('faucet' in end) {
    return { x: L.faucetX + L.faucetWidth, y: rowTop(FAUCETS.indexOf(end.faucet)) + 25 };
  }
  if ('outlet' in end) {
    return { x: L.outletX, y: rowTop(Object.keys(stage.outputs).indexOf(end.outlet)) + 25 };
  }
  const part = findPart(board, end.part);
  if (end.pin === 'out') return { x: part.x + L.partWidth, y: part.y + 25 };
  const pins = pinsOf(part.type);
  const offsets = pins.length === 1 ? [25] : [15, 35];
  return { x: part.x, y: part.y + offsets[pins.indexOf(end.pin)] };
}

// 水路の通り道。蛇口や仕掛けの出口から横へ出て、途中で縦に曲がり、入口へ横から入る。
// 曲がる場所は始点と終点の真ん中。ただし、別の水が流れる縦の線と重なりそうなときは、
// 少しずつずらして見分けられるようにする（同じ出口から分かれた水路は重なってよい）。
const LANE_GAP = 14;

export function wirePaths(stage, board) {
  const lanes = []; // 置いた縦の線 { x, top, bottom, from }
  return board.wires.map((wire) => {
    const a = pinPosition(stage, board, wire.from);
    const b = pinPosition(stage, board, wire.to);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    const from = JSON.stringify(wire.from);
    const base = Math.round((a.x + b.x) / 2);
    const clash = (x) =>
      lanes.some(
        (lane) => lane.from !== from && Math.abs(lane.x - x) < LANE_GAP && lane.top <= bottom && top <= lane.bottom,
      );
    let x = base;
    if (a.y !== b.y) {
      // 真ん中から右・左へ交互にずらして、空いている場所を探す
      for (let step = 1; step <= 12 && clash(x); step++) {
        x = base + Math.ceil(step / 2) * LANE_GAP * (step % 2 ? 1 : -1);
      }
      lanes.push({ x, top, bottom, from });
    }
    return { a, b, x, d: `M${a.x} ${a.y} H${x} V${b.y} H${b.x}` };
  });
}

// 盤面を、評価できる回路の形に直す。つながっていない入口は水がないもの（0）として扱う。
export function toCircuit(board, stage) {
  const sourceOf = (sink) => {
    const wire = board.wires.find((candidate) => sameEnd(candidate.to, sink));
    if (!wire) return { const: false };
    return 'faucet' in wire.from ? { input: wire.from.faucet } : { gate: wire.from.part };
  };
  return {
    gates: board.parts.map((part) => ({
      id: part.id,
      type: part.type,
      inputs: pinsOf(part.type).map((pin) => sourceOf({ part: part.id, pin })),
    })),
    outputs: Object.fromEntries(
      Object.keys(stage.outputs).map((name) => [name, sourceOf({ outlet: name })]),
    ),
  };
}

// ステージの開け方で、出口ごとの答えと照らし合わせる。水路がぐるぐる回るときは例外になる。
export function checkBoard(board, stage, faucets = stage.faucets) {
  return checkCircuit(toCircuit(board, stage), stage, faucets);
}

// 保存してあった盤面のうち、このステージにないもの（蛇口・出口・仕掛け箱にない仕掛け）を取り除く。
// ステージの中身が変わったあとに古い盤面を読み込んでも、行き先のない水路が描かれないようにする。
export function sanitizeBoard(board, stage) {
  if (!board || !Array.isArray(board.parts) || !Array.isArray(board.wires)) return createBoard();
  const counts = {};
  const parts = board.parts.filter((part) => {
    counts[part.type] = (counts[part.type] ?? 0) + 1;
    return counts[part.type] <= (stage.tray[part.type] ?? 0);
  });
  const partIds = new Set(parts.map((part) => part.id));
  const exists = (end) => {
    if ('faucet' in end) return end.faucet in stage.faucets;
    if ('outlet' in end) return end.outlet in stage.outputs;
    return partIds.has(end.part);
  };
  const wires = board.wires.filter((wire) => exists(wire.from) && exists(wire.to));
  return { parts, wires };
}

// 蛇口の開け方ごとに、仕掛けの出力・出口・水路に水が流れているかを返す。
export function liveState(board, stage, faucets) {
  const { gates, outputs } = solve(toCircuit(board, stage), faucets);
  const valueOfEnd = (end) => ('faucet' in end ? faucets[end.faucet] : gates[end.part]);
  return { gates, outputs, wires: board.wires.map((wire) => valueOfEnd(wire.from)) };
}

// 水が届く順番。蛇口が0、仕掛けは入口に来る水のうち一番遅いもの＋1、
// 出口はつながった元＋1、水路は元の順番と同じ。
// 実行のアニメーションで、水を順番にたどって見せるのに使う。
// 水路がぐるぐる回っているときは null。
export function flowLevels(board, stage) {
  const memo = new Map();
  const wireInto = (sink) => board.wires.find((wire) => sameEnd(wire.to, sink));

  const levelOf = (end, visiting) => {
    if ('faucet' in end) return 0;
    if (memo.has(end.part)) return memo.get(end.part);
    if (visiting.has(end.part)) throw new Error('loop');
    visiting.add(end.part);
    const part = findPart(board, end.part);
    const sources = pinsOf(part.type)
      .map((pin) => wireInto({ part: part.id, pin }))
      .filter(Boolean)
      .map((wire) => levelOf(wire.from, visiting));
    visiting.delete(end.part);
    const level = 1 + Math.max(0, ...sources);
    memo.set(end.part, level);
    return level;
  };

  try {
    const parts = Object.fromEntries(
      board.parts.map((part) => [part.id, levelOf({ part: part.id, pin: 'out' }, new Set())]),
    );
    const wires = board.wires.map((wire) => levelOf(wire.from, new Set()));
    const outlets = Object.fromEntries(
      Object.keys(stage.outputs).map((name) => {
        const wire = wireInto({ outlet: name });
        return [name, wire ? levelOf(wire.from, new Set()) + 1 : 1];
      }),
    );
    return { parts, wires, outlets };
  } catch {
    return null;
  }
}

// 判定の前に守るルール。守れていないところを返す（空なら守れている）。
//   出口は全部つなぐ（つながっていない出口は、水がないのか、つなぎ忘れなのか分からないため）。
//   仕掛け箱の仕掛けは全部庭に置き、入口も出口もつなぐ（仕掛けを使わずに解けないようにするため）。
export function ruleProblems(board, stage) {
  const wiredTo = (end) => board.wires.some((wire) => sameEnd(wire.to, end));
  const problems = [];
  const outlets = Object.keys(stage.outputs).filter((name) => !wiredTo({ outlet: name }));
  if (outlets.length) problems.push({ kind: 'outlet', outlets });
  const types = Object.keys(stage.tray).filter((type) => remaining(board, stage, type) > 0);
  if (types.length) problems.push({ kind: 'tray', types });
  const parts = board.parts
    .filter(
      (part) =>
        pinsOf(part.type).some((pin) => !wiredTo({ part: part.id, pin })) ||
        !board.wires.some((wire) => wire.from.part === part.id),
    )
    .map((part) => part.id);
  if (parts.length) problems.push({ kind: 'loose', parts });
  return problems;
}
