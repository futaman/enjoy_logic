// 庭の上の仕掛けと水路の状態。画面からは独立しているので、テストで直接動かせる。
// 状態はすべて新しい値を返す（元の盤面は変えない）。元に戻す機能に使うため。
import { GATE_ARITY, checkCircuit, simulate, solve } from './logic.js';

// 庭の大きさと置き場所（画面の単位は px）。仕掛けが2つまでのステージの大きさ。
// 庭には2つの向きがある。
//   'wide'（横長）：蛇口が左、出口が右に縦に並び、水は左から右へ流れる。PC・タブレット向け
//   'tall'（縦長）：蛇口が上、出口が下に横に並び、水は上から下へ流れる。幅のせまいスマホ向け。
//     横長の庭を縮めると文字や絵が小さくなりすぎるので、ほぼそのままの大きさで見せられる形にする
// 仕掛けの置き場所は向きごとに持つ（横長は part.x・part.y、縦長は part.tall）。
export const LAYOUT = {
  orientation: 'wide',
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

const partCount = (stage) => Object.values(stage.tray).reduce((sum, count) => sum + count, 0);

// 縦長の庭。仕掛けの段は、仕掛けの数だけ（ただし3段まで）用意して、水の流れる順に1段ずつ置けるようにする。
// 今のステージでは、水が通る仕掛けは多くても3つ続き（ステージ20）なので、3段あれば足りる。
const TALL = {
  partWidth: 130,
  partHeight: 56,
  margin: 12, // 左右の余白
  columnGap: 30, // 横に並べた箱どうしの間
  faucetY: 16,
  rowGap: 60, // 蛇口の段・仕掛けの段・出口の段の間
  rowStep: 116, // 仕掛けの段どうしの間（箱の高さ＋水路を通すすき間）
  bottom: 28, // 出口の下の余白（○×の印やふきだしの分）
};

export function layoutOf(stage, orientation = 'wide') {
  const wideWidth = LAYOUT.width + EXTRA_WIDTH_PER_PART * Math.max(0, partCount(stage) - 2);
  const wide = { ...LAYOUT, width: wideWidth, outletX: wideWidth - (LAYOUT.width - LAYOUT.outletX) };
  if (orientation !== 'tall') return wide;
  const T = TALL;
  const columns = Math.max(2, stage.inputs.length, stage.outlets.length);
  const rows = Math.min(3, Math.max(1, partCount(stage)));
  const gateTop = T.faucetY + T.partHeight + T.rowGap;
  const gateBottom = gateTop + (rows - 1) * T.rowStep;
  const outletY = partCount(stage) === 0 ? gateTop + T.rowGap : gateBottom + T.partHeight + T.rowGap;
  const width = 2 * T.margin + columns * T.partWidth + (columns - 1) * T.columnGap;
  // count 個の箱を、columns 列の真ん中にそろえて並べたときの i 番目の左端
  const columnX = (i, count) => T.margin + ((columns - count) / 2 + i) * (T.partWidth + T.columnGap);
  return {
    ...T,
    orientation: 'tall',
    width,
    height: outletY + T.partHeight + T.bottom,
    columns,
    rows,
    gateTop,
    gateBottom,
    outletY,
    columnX,
    wide, // 縦長で置いた仕掛けに、横長での置き場所も付けるときに使う
  };
}

export const FAUCETS = ['A', 'B', 'C'];
export const PART_NAMES = { NOT: '天野君', AND: 'カタブツ', OR: 'イエスマン', XOR: '多様性好き', DFF: 'ししおどし' };

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
// 縦長の庭で仕掛けを置ける範囲：蛇口の段と出口の段の間
const clampTall = (x, y, T) => ({
  x: Math.round(Math.min(Math.max(x, 4), T.width - T.partWidth - 4)),
  y: Math.round(Math.min(Math.max(y, T.faucetY + T.partHeight + 20), T.outletY - T.partHeight - 20)),
});

// 縦長の庭の置き場所を、横長の庭の置き場所に置きかえる（縦と横を入れかえて、範囲を合わせる）。
function wideFromTall(pos, T) {
  const W = T.wide;
  const along = T.gateBottom > T.gateTop ? (pos.y - T.gateTop) / (T.gateBottom - T.gateTop) : 0;
  const across = (pos.x - T.margin) / Math.max(1, T.width - 2 * T.margin - T.partWidth);
  const x0 = 150;
  const x1 = W.outletX - 30 - W.partWidth;
  return { x: x0 + Math.min(Math.max(along, 0), 1) * (x1 - x0), y: 10 + Math.min(Math.max(across, 0), 1) * (W.height - W.partHeight - 20) };
}

function nextPartId(board) {
  const largest = board.parts.reduce((max, part) => Math.max(max, Number(part.id.slice(1))), 0);
  return `p${largest + 1}`;
}

// layout は庭の大きさ（layoutOf(stage, 向き)）。x・y はその向きの庭での位置。仕掛けが庭からはみ出さないようにする。
// 縦長の庭で置いたときは、横長の庭での置き場所も付けておく（あとで PC で開いても置き場所がある）。
export function addPart(board, type, x, y, layout = LAYOUT) {
  let part;
  if (layout.orientation === 'tall') {
    const tall = clampTall(x, y, layout);
    const wide = wideFromTall(tall, layout);
    part = { id: nextPartId(board), type, x: clampX(snap(wide.x), layout.wide), y: clampY(snap(wide.y), layout.wide), tall };
  } else {
    part = { id: nextPartId(board), type, x: clampX(snap(x), layout), y: clampY(snap(y), layout) };
  }
  return { ...board, parts: [...board.parts, part] };
}

// 動かすのは、今の向きの庭での置き場所だけ（もう一方の向きの置き場所は変えない）。
export function movePart(board, id, x, y, layout = LAYOUT) {
  const parts = board.parts.map((part) => {
    if (part.id !== id) return part;
    if (layout.orientation === 'tall') return { ...part, tall: clampTall(x, y, layout) };
    return { ...part, x: clampX(snap(x), layout), y: clampY(snap(y), layout) };
  });
  return { ...board, parts };
}

// 縦長の庭での置き場所がない仕掛け（横長の庭で置いたもの）に、置き場所を決める。
// 水の流れる順（flowLevels）に、上の段から空いているところへ並べる。全部あるときは同じ盤面を返す。
export function fillTallPositions(board, stage) {
  if (board.parts.every((part) => part.tall)) return board;
  const T = layoutOf(stage, 'tall');
  const levels = flowLevels(board, stage)?.parts ?? {};
  const taken = board.parts.filter((part) => part.tall).map((part) => part.tall);
  const free = (pos) =>
    taken.every((other) => Math.abs(other.x - pos.x) >= T.partWidth + 10 || Math.abs(other.y - pos.y) >= T.partHeight + 20);
  const slots = [];
  for (let row = 0; row < T.rows; row++) {
    for (let column = 0; column < T.columns; column++) slots.push({ row, x: T.columnX(column, T.columns), y: T.gateTop + row * T.rowStep });
  }
  const order = board.parts
    .filter((part) => !part.tall)
    .sort((a, b) => (levels[a.id] ?? 1) - (levels[b.id] ?? 1) || a.x - b.x || a.y - b.y);
  const placed = new Map();
  for (const part of order) {
    // 水の流れる順の段から探しはじめ、空いていなければ下の段、それでもなければ上の段
    const want = Math.min(T.rows - 1, Math.max(0, (levels[part.id] ?? 1) - 1));
    const ranked = [...slots].sort((a, b) => (a.row >= want ? a.row - want : 100 + want - a.row) - (b.row >= want ? b.row - want : 100 + want - b.row));
    const slot = ranked.find((candidate) => free(candidate)) ?? ranked[0];
    const pos = { x: Math.round(slot.x), y: slot.y };
    taken.push(pos);
    placed.set(part.id, pos);
  }
  return { ...board, parts: board.parts.map((part) => (placed.has(part.id) ? { ...part, tall: placed.get(part.id) } : part)) };
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

// 蛇口・出口・仕掛けの箱の左上の位置。L は庭の大きさ（layoutOf(stage, 向き)）。
export function boxPosition(stage, board, item, L = layoutOf(stage)) {
  if (L.orientation === 'tall') {
    if ('faucet' in item) return { x: L.columnX(stage.inputs.indexOf(item.faucet), stage.inputs.length), y: L.faucetY };
    if ('outlet' in item) return { x: L.columnX(stage.outlets.indexOf(item.outlet), stage.outlets.length), y: L.outletY };
    const part = findPart(board, item.part);
    return part.tall ?? { x: L.margin, y: L.gateTop };
  }
  if ('faucet' in item) return { x: L.faucetX, y: rowTop(FAUCETS.indexOf(item.faucet)) };
  if ('outlet' in item) return { x: L.outletX, y: rowTop(stage.outlets.indexOf(item.outlet)) };
  const part = findPart(board, item.part);
  return { x: part.x, y: part.y };
}

// 画面上の端の位置（水路の始点・終点、ピンの置き場所）。
// 横長の庭は、出口が箱の右、入口が箱の左。縦長の庭は、出口が箱の下、入口が箱の上。
export function pinPosition(stage, board, end, L = layoutOf(stage)) {
  const box = boxPosition(stage, board, end, L);
  const w = L.partWidth;
  const h = L.partHeight;
  const tall = L.orientation === 'tall';
  if (isSource(end)) return tall ? { x: box.x + w / 2, y: box.y + h } : { x: box.x + w, y: box.y + h / 2 };
  const pins = 'outlet' in end ? ['in'] : pinsOf(findPart(board, end.part).type);
  const index = 'outlet' in end ? 0 : pins.indexOf(end.pin);
  const share = pins.length === 1 ? 0.5 : [0.3, 0.7][index];
  return tall ? { x: box.x + w * share, y: box.y } : { x: box.x, y: box.y + h * share };
}

// 水路の通り道。出口から水の流れる向き（横長は横、縦長は下）へ出て、途中で曲がり、入口へ同じ向きから入る。
// 曲がる場所は始点と終点の真ん中。ただし、別の水が流れる線と重なりそうなときは、
// 少しずつずらして見分けられるようにする（同じ出口から分かれた水路は重なってよい）。
// lane（横長では x とも呼ぶ）は、曲がってから進む線の位置。
const LANE_GAP = 14;

export function wirePaths(stage, board, L = layoutOf(stage)) {
  const tall = L.orientation === 'tall';
  // 流れる向きを u、それと直角の向きを v として、横長でも縦長でも同じ計算にする
  const u = (p) => (tall ? p.y : p.x);
  const v = (p) => (tall ? p.x : p.y);
  const lanes = []; // 置いた線 { at, low, high, from }
  return board.wires.map((wire) => {
    const a = pinPosition(stage, board, wire.from, L);
    const b = pinPosition(stage, board, wire.to, L);
    const low = Math.min(v(a), v(b));
    const high = Math.max(v(a), v(b));
    const from = JSON.stringify(wire.from);
    const base = Math.round((u(a) + u(b)) / 2);
    const clash = (at) =>
      lanes.some((lane) => lane.from !== from && Math.abs(lane.at - at) < LANE_GAP && lane.low <= high && low <= lane.high);
    let at = base;
    if (v(a) !== v(b)) {
      // 真ん中から前・後ろへ交互にずらして、空いている場所を探す
      for (let step = 1; step <= 12 && clash(at); step++) {
        at = base + Math.ceil(step / 2) * LANE_GAP * (step % 2 ? 1 : -1);
      }
      lanes.push({ at, low, high, from });
    }
    const d = tall ? `M${a.x} ${a.y} V${at} H${b.x} V${b.y}` : `M${a.x} ${a.y} H${at} V${b.y} H${b.x}`;
    return { a, b, x: at, lane: at, d };
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
      stage.outlets.map((name) => [name, sourceOf({ outlet: name })]),
    ),
  };
}

// 予定表の全部の時間で、出口ごとの答えと照らし合わせる。水路がぐるぐる回るときは例外になる。
export function checkBoard(board, stage) {
  return checkCircuit(toCircuit(board, stage), stage);
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
    if ('faucet' in end) return stage.inputs.includes(end.faucet);
    if ('outlet' in end) return stage.outlets.includes(end.outlet);
    return partIds.has(end.part);
  };
  const wires = board.wires.filter((wire) => exists(wire.from) && exists(wire.to));
  return { parts, wires };
}

// 蛇口の開け方（とししおどしがためている水）で、仕掛けの出力・出口・水路に水が流れているかを返す。
export function liveState(board, stage, faucets, dffState = {}) {
  const { gates, outputs } = solve(toCircuit(board, stage), faucets, dffState);
  const valueOfEnd = (end) => ('faucet' in end ? faucets[end.faucet] : gates[end.part]);
  return { gates, outputs, wires: board.wires.map((wire) => valueOfEnd(wire.from)) };
}

// 予定表の時間ごとの水の様子（liveState と同じ形に、その時間の蛇口 faucets を足したもの）。
// ししおどしがためた水は、次の時間に持ちこす。水路がぐるぐる回るときは例外になる。
export function liveTimes(board, stage) {
  return simulate(toCircuit(board, stage), stage).map((time) => ({
    ...liveState(board, stage, time.faucets, time.dff),
    faucets: time.faucets,
  }));
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
    const part = findPart(board, end.part);
    // ししおどしは、ためていた水を拍の初めに出す。蛇口と同じく水の出発点として扱う
    if (part.type === 'DFF') return 1;
    if (visiting.has(end.part)) throw new Error('loop');
    visiting.add(end.part);
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
      stage.outlets.map((name) => {
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
  const outlets = stage.outlets.filter((name) => !wiredTo({ outlet: name }));
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
