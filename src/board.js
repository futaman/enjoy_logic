// 庭の上の仕掛けと水路の状態。画面からは独立しているので、テストで直接動かせる。
// 状態はすべて新しい値を返す（元の盤面は変えない）。元に戻す機能に使うため。
import { GATE_ARITY, checkCircuit, solve } from './logic.js';

// 庭の大きさと置き場所（画面の単位は px）。
export const LAYOUT = {
  width: 900,
  height: 520,
  partWidth: 110,
  partHeight: 50,
  faucetX: 20,
  faucetWidth: 100,
  outletX: 760,
  rowFirst: 40,
  rowGap: 150,
};

export const FAUCETS = ['A', 'B', 'C'];
export const PART_NAMES = { NOT: '天野君', AND: '二重扉', OR: '合流', XOR: 'けんか弁' };

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
const clampX = (x) => Math.min(Math.max(x, 160), LAYOUT.outletX - 30 - LAYOUT.partWidth);
const clampY = (y) => Math.min(Math.max(y, 10), LAYOUT.height - LAYOUT.partHeight - 10);

function nextPartId(board) {
  const largest = board.parts.reduce((max, part) => Math.max(max, Number(part.id.slice(1))), 0);
  return `p${largest + 1}`;
}

export function addPart(board, type, x, y) {
  const part = { id: nextPartId(board), type, x: clampX(snap(x)), y: clampY(snap(y)) };
  return { ...board, parts: [...board.parts, part] };
}

export function movePart(board, id, x, y) {
  const parts = board.parts.map((part) =>
    part.id === id ? { ...part, x: clampX(snap(x)), y: clampY(snap(y)) } : part,
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
  const L = LAYOUT;
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

// 予定表の全部の行と照らし合わせる。水路がぐるぐる回るときは例外になる。
export function checkBoard(board, stage) {
  return checkCircuit(toCircuit(board, stage), stage);
}

// 蛇口の開け方ごとに、仕掛けの出力・出口・水路に水が流れているかを返す。
export function liveState(board, stage, faucets) {
  const { gates, outputs } = solve(toCircuit(board, stage), faucets);
  const valueOfEnd = (end) => ('faucet' in end ? faucets[end.faucet] : gates[end.part]);
  return { gates, outputs, wires: board.wires.map((wire) => valueOfEnd(wire.from)) };
}
