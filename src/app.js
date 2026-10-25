import { COMBINATIONAL_STAGES } from './stages.js';
import { allRows } from './logic.js';
import {
  LAYOUT,
  FAUCETS,
  PART_NAMES,
  addPart,
  connect,
  createBoard,
  disconnect,
  findPart,
  isSource,
  liveState,
  movePart,
  pinPosition,
  pinsOf,
  remaining,
  removePart,
  rowTop,
  sameEnd,
} from './board.js';

const SAVE_KEY = 'enjoy_logic.progress.v1';
const OUTLET_NAMES = { out: '出口', sum: '花壇（1の位）', carry: '花壇（2の位）' };
const MIN_SCALE = 0.6;

const $ = (selector) => document.querySelector(selector);
const wrap = $('#garden-wrap');
const garden = $('#garden');
const tray = $('#tray');
const schedule = $('#schedule');

const state = {
  stageIndex: 0,
  board: createBoard(),
  faucets: {},
  undo: [],
  redo: [],
  pending: null, // 2回タップでつなぐとき、最初に触れた端
  selectedWire: null,
  hintLevel: 0,
  judging: false,
  judgeRow: null,
  judgeFail: null,
  skip: false,
  baseScale: 1,
  zoom: 1,
  progress: loadProgress(),
};

const currentStage = () => COMBINATIONAL_STAGES[state.stageIndex];

// 保存できなくても遊べるように、読み書きは try で囲む。
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved?.stages ? saved : { stages: {} };
  } catch {
    return { stages: {} };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.progress));
  } catch {
    // 保存できない環境でも、そのまま遊べる
  }
}

function stageProgress(no) {
  state.progress.stages[no] ??= { board: null, stars: 0, cleared: false, hintUsed: false };
  return state.progress.stages[no];
}

// ---------- 画面の切り替え・拡大 ----------

function showScreen(name) {
  $('#game').hidden = name !== 'game';
  $('#stage-select').hidden = name !== 'select';
  if (name === 'select') renderStageList();
}

function setScale(scale) {
  garden.style.setProperty('--s', scale);
  garden.style.transform = `scale(${scale})`;
  // 拡大した分の大きさを、スクロールの範囲として確保する
  $('#garden-box').style.width = `${LAYOUT.width * scale}px`;
  $('#garden-box').style.height = `${LAYOUT.height * scale}px`;
}

// 幅に合わせる（小さい画面では最小の大きさまで）。拡大・縮小はこの大きさの0.5〜2倍。
function fitWidth(minimum = MIN_SCALE) {
  state.baseScale = Math.max(wrap.clientWidth / LAYOUT.width, minimum);
  state.zoom = 1;
  setScale(state.baseScale);
  wrap.scrollLeft = 0;
  wrap.scrollTop = 0;
}

// 指（マウス）の位置の下にある庭の点を動かさないように、拡大・縮小する。
// 2本指のときは、指の動きに合わせて庭も動く。
function zoomAt(zoom, clientX, clientY) {
  const rect = wrap.getBoundingClientRect();
  const oldScale = state.baseScale * state.zoom;
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const gardenX = (wrap.scrollLeft + px) / oldScale;
  const gardenY = (wrap.scrollTop + py) / oldScale;
  state.zoom = Math.min(Math.max(zoom, 0.5), 2);
  const scale = state.baseScale * state.zoom;
  setScale(scale);
  wrap.scrollLeft = gardenX * scale - px;
  wrap.scrollTop = gardenY * scale - py;
}

// ---------- 状態の変更 ----------

function openStage(index) {
  state.stageIndex = index;
  const stage = currentStage();
  state.board = stageProgress(stage.no).board ?? createBoard();
  state.faucets = Object.fromEntries(stage.inputs.map((name) => [name, false]));
  state.undo = [];
  state.redo = [];
  state.pending = null;
  state.selectedWire = null;
  state.judgeFail = null;
  state.hintLevel = 0;
  showScreen('game');
  fitWidth();
  render();
}

function setBoard(board) {
  state.board = board;
  state.selectedWire = null;
  state.judgeFail = null;
  stageProgress(currentStage().no).board = board;
  saveProgress();
  render();
}

function commit(next) {
  if (state.judging || next === state.board) return;
  state.undo.push(state.board);
  state.redo = [];
  setBoard(next);
}

function undo() {
  if (state.judging || state.undo.length === 0) return;
  state.redo.push(state.board);
  setBoard(state.undo.pop());
}

function redo() {
  if (state.judging || state.redo.length === 0) return;
  state.undo.push(state.board);
  setBoard(state.redo.pop());
}

function toggleFaucet(name) {
  if (state.judging) return;
  state.faucets = { ...state.faucets, [name]: !state.faucets[name] };
  state.judgeFail = null;
  render();
}

// 2つの端をつなぐ。向きは出口→入口に自動で揃える。
function link(a, b) {
  const [from, to] = isSource(a) ? [a, b] : [b, a];
  commit(connect(state.board, from, to));
}

// ピンを1回ずつタップしてつなぐ（小さい画面や、ドラッグが苦手な人向け）。
function tapPin(end) {
  const previous = state.pending;
  if (!previous) {
    state.pending = end;
  } else {
    state.pending = null;
    if (!sameEnd(previous, end)) link(previous, end);
  }
  render();
}

function currentLive() {
  try {
    return liveState(state.board, currentStage(), state.faucets);
  } catch {
    return null; // 水路がぐるぐる回っているときは水が流れない扱い
  }
}

// ---------- 判定 ----------

function rowMatches(stage, board, row) {
  try {
    const { outputs } = liveState(board, stage, row);
    return Object.keys(stage.outputs).every((name) => outputs[name] === stage.outputs[name](row));
  } catch {
    return false;
  }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function judge() {
  if (state.judging) return;
  const stage = currentStage();
  const rows = allRows(stage.inputs);
  state.judging = true;
  state.skip = false;
  state.judgeFail = null;
  let failedAt = null;
  for (let i = 0; i < rows.length; i++) {
    state.faucets = rows[i];
    state.judgeRow = i;
    render();
    await pause(state.skip ? 0 : 350);
    if (!rowMatches(stage, state.board, rows[i])) {
      failedAt = i;
      break;
    }
  }
  state.judging = false;
  state.judgeRow = null;
  state.judgeFail = failedAt;
  if (failedAt === null) finishStage();
  render();
}

function finishStage() {
  const stage = currentStage();
  const progress = stageProgress(stage.no);
  const partsUsed = state.board.parts.length;
  const stars =
    1 + (partsUsed <= stage.solution.gates.length ? 1 : 0) + (progress.hintUsed ? 0 : 1);
  progress.cleared = true;
  progress.stars = Math.max(progress.stars, stars);
  saveProgress();
  showClear(stars);
}

function showClear(stars) {
  const hasNext = state.stageIndex < COMBINATIONAL_STAGES.length - 1;
  $('#clear-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('#next-stage').hidden = !hasNext;
  $('#clear-dialog').hidden = false;
}

// ---------- 描画 ----------

function render() {
  const stage = currentStage();
  const live = currentLive();
  $('#title').textContent = `${stage.no}. ${stage.title}`;
  $('#lesson').textContent = stage.lesson;
  renderGarden(stage, live);
  renderSchedule(stage);
  renderTray(stage);
  renderToolbar();
  renderHint(stage);
}

// 端のピン。タップ・ドラッグで水路を引く場所。
function pinHtml(stage, end, wet) {
  const p = pinPosition(stage, state.board, end);
  const key = JSON.stringify(end);
  const pending = state.pending && JSON.stringify(state.pending) === key ? 'pending' : '';
  return `<div class="pin ${wet ? 'wet' : ''} ${pending}" data-end="${encodeURIComponent(key)}" style="left:${p.x}px;top:${p.y}px"></div>`;
}

function renderGarden(stage, live) {
  const boxes = [];
  const pins = [];

  stage.inputs.forEach((name) => {
    const open = Boolean(state.faucets[name]);
    const top = rowTop(FAUCETS.indexOf(name));
    boxes.push(
      `<div class="faucet ${open ? 'open' : ''}" data-faucet="${name}" style="left:${LAYOUT.faucetX}px;top:${top}px"><b>蛇口${name}</b><span>${open ? '開いている' : '閉じている'}</span></div>`,
    );
    pins.push(pinHtml(stage, { faucet: name }, open));
  });

  Object.keys(stage.outputs).forEach((name, index) => {
    const expected = stage.outputs[name](state.faucets);
    const actual = live?.outputs[name];
    const status = actual === undefined ? '' : actual === expected ? 'ok' : 'ng';
    boxes.push(
      `<div class="outlet ${status} ${actual ? 'wet' : ''}" data-outlet="${name}" style="left:${LAYOUT.outletX}px;top:${rowTop(index)}px"><b>${OUTLET_NAMES[name]}</b><span>${expected ? '花' : '頑固おやじ'}</span></div>`,
    );
    pins.push(pinHtml(stage, { outlet: name }, false));
  });

  state.board.parts.forEach((part) => {
    boxes.push(
      `<div class="part" data-part="${part.id}" style="left:${part.x}px;top:${part.y}px"><b>${PART_NAMES[part.type]}</b><span>${part.type}</span></div>`,
    );
    pinsOf(part.type).forEach((pin) => pins.push(pinHtml(stage, { part: part.id, pin }, false)));
    pins.push(pinHtml(stage, { part: part.id, pin: 'out' }, Boolean(live?.gates[part.id])));
  });

  const wires = state.board.wires
    .map((wire, i) => {
      const a = pinPosition(stage, state.board, wire.from);
      const b = pinPosition(stage, state.board, wire.to);
      const middle = (a.x + b.x) / 2;
      const d = `M${a.x} ${a.y} H${middle} V${b.y} H${b.x}`;
      const classes = [live?.wires[i] ? 'on' : '', state.selectedWire === i ? 'selected' : ''];
      return `<path class="wire ${classes.join(' ')}" d="${d}"/><path class="hit" data-wire="${i}" d="${d}"/>`;
    })
    .join('');

  garden.innerHTML = `<svg id="wires" width="${LAYOUT.width}" height="${LAYOUT.height}" viewBox="0 0 ${LAYOUT.width} ${LAYOUT.height}">${wires}</svg>${boxes.join('')}${pins.join('')}`;
}

function renderSchedule(stage) {
  const names = Object.keys(stage.outputs);
  const head = [
    ...stage.inputs.map((name) => `<th>${name}</th>`),
    ...names.map((name) => `<th>${OUTLET_NAMES[name]}</th>`),
    '<th></th>',
  ].join('');
  const body = allRows(stage.inputs)
    .map((row, i) => {
      const current = stage.inputs.every((name) => state.faucets[name] === row[name]);
      const cells = [
        ...stage.inputs.map((name) => `<td>${row[name] ? '開' : '閉'}</td>`),
        ...names.map((name) => `<td>${stage.outputs[name](row) ? '花' : '頑固おやじ'}</td>`),
      ].join('');
      let mark = '';
      if (state.judgeFail === i) mark = '×';
      else if (state.judging && i < state.judgeRow) mark = '○';
      else if (state.judging && i === state.judgeRow) mark = '…';
      return `<tr data-row="${i}" class="${current ? 'current' : ''}">${cells}<td class="mark">${mark}</td></tr>`;
    })
    .join('');
  schedule.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderTray(stage) {
  const types = Object.keys(stage.tray);
  tray.innerHTML = types.length
    ? types
        .map((type) => {
          const left = remaining(state.board, stage, type);
          return `<div class="chip ${left > 0 ? '' : 'empty'}" data-type="${type}"><b>${type}　${PART_NAMES[type]}</b><span>のこり ${left}</span></div>`;
        })
        .join('')
    : '<p>このステージは、水路だけでつなぎます。</p>';
}

function renderToolbar() {
  $('#undo').disabled = state.judging || state.undo.length === 0;
  $('#redo').disabled = state.judging || state.redo.length === 0;
  $('#judge').disabled = state.judging;
  $('#delete-wire').hidden = state.selectedWire === null;
}

function describeRef(ref) {
  if ('input' in ref) return ref.input;
  if ('gate' in ref) return ref.gate;
  return ref.const ? '1' : '0';
}

function renderHint(stage) {
  const hint = $('#hint-text');
  if (state.hintLevel === 0) {
    hint.hidden = true;
    return;
  }
  const types = stage.solution.gates.map((gate) => gate.type);
  const lines =
    state.hintLevel === 1
      ? [`使う仕掛け：${types.length ? types.join('・') : 'なし（水路だけ）'}`]
      : [
          ...stage.solution.gates.map(
            (gate) => `${gate.id} = ${gate.type}(${gate.inputs.map(describeRef).join(', ')})`,
          ),
          ...Object.entries(stage.solution.outputs).map(
            ([name, ref]) => `${OUTLET_NAMES[name]} = ${describeRef(ref)}`,
          ),
        ];
  hint.hidden = false;
  hint.textContent = lines.join('\n');
}

function renderStageList() {
  $('#stage-list').innerHTML = COMBINATIONAL_STAGES.map((stage, i) => {
    const progress = state.progress.stages[stage.no];
    const locked = i > 0 && !state.progress.stages[COMBINATIONAL_STAGES[i - 1].no]?.cleared;
    const stars = progress?.stars ?? 0;
    const label = `${stage.no}. ${stage.title}`;
    const status = locked ? '（まだ開かない）' : '★'.repeat(stars) + '☆'.repeat(3 - stars);
    return `<li><button data-stage="${i}" ${locked ? 'disabled' : ''}>${label}　${status}</button></li>`;
  }).join('');
}

// ---------- ドラッグ・タップ ----------

const readEnd = (el) => JSON.parse(decodeURIComponent(el.dataset.end));

function gardenPoint(event) {
  const rect = garden.getBoundingClientRect();
  const scale = rect.width / LAYOUT.width;
  return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
}

function inside(event, element) {
  const rect = element.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function drawTempWire(end, event) {
  const svg = $('#wires');
  let path = $('#temp');
  if (!path) {
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.id = 'temp';
    path.setAttribute('class', 'temp');
    svg.append(path);
  }
  const a = pinPosition(currentStage(), state.board, end);
  const b = gardenPoint(event);
  path.setAttribute('d', `M${a.x} ${a.y} L${b.x} ${b.y}`);
}

function startDrag(event, drag) {
  drag.x0 = event.clientX;
  drag.y0 = event.clientY;
  drag.downX = event.clientX;
  drag.downY = event.clientY;
  drag.pointerId = event.pointerId;
  drag.moved = false;
  drag.scale = garden.getBoundingClientRect().width / LAYOUT.width;
  activeDrag = drag;
  const move = (e) => {
    if (e.pointerId === drag.pointerId) onMove(e, drag);
  };
  const up = (e) => {
    if (e.pointerId !== drag.pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    activeDrag = null;
    onEnd(e, drag);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function onMove(event, drag) {
  if (drag.cancelled) return;
  const dx = event.clientX - drag.x0;
  const dy = event.clientY - drag.y0;
  if (drag.kind === 'pan') {
    // 何もないところを1本指で動かすと、庭が動く
    wrap.scrollLeft -= dx;
    wrap.scrollTop -= dy;
    drag.x0 = event.clientX;
    drag.y0 = event.clientY;
    if (Math.hypot(event.clientX - drag.downX, event.clientY - drag.downY) >= 8) drag.moved = true;
    return;
  }
  if (!drag.moved && Math.hypot(dx, dy) < 8) return; // 8px 以上動いたらドラッグ
  drag.moved = true;
  if (drag.kind === 'wire') drawTempWire(drag.end, event);
  if (drag.kind === 'part') {
    drag.pos = { x: drag.origin.x + dx / drag.scale, y: drag.origin.y + dy / drag.scale };
    drag.el.style.left = `${drag.pos.x}px`;
    drag.el.style.top = `${drag.pos.y}px`;
  }
  if (drag.kind === 'new') {
    drag.ghost.style.left = `${event.clientX - 55}px`;
    drag.ghost.style.top = `${event.clientY - 25}px`;
  }
}

function onEnd(event, drag) {
  if (drag.cancelled) return;
  if (drag.kind === 'pan') {
    if (!drag.moved) tapEmptyGarden(event);
    return;
  }
  if (drag.kind === 'wire') {
    $('#temp')?.remove();
    if (!drag.moved) {
      tapPin(drag.end);
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.pin');
    if (target) link(drag.end, readEnd(target));
    return;
  }
  if (drag.kind === 'part') {
    if (!drag.moved) return;
    if (inside(event, tray)) commit(removePart(state.board, drag.id));
    else commit(movePart(state.board, drag.id, drag.pos.x, drag.pos.y));
    return;
  }
  if (drag.kind === 'faucet') {
    if (!drag.moved) toggleFaucet(drag.name);
    return;
  }
  if (drag.kind === 'wire-hit') {
    if (!drag.moved) {
      state.selectedWire = drag.index;
      render();
    }
    return;
  }
  if (drag.kind === 'new') {
    drag.ghost.remove();
    if (drag.moved && inside(event, garden)) {
      const p = gardenPoint(event);
      commit(addPart(state.board, drag.type, p.x - LAYOUT.partWidth / 2, p.y - LAYOUT.partHeight / 2));
    }
  }
}

// 指の位置。1本指は触った場所で動き方が変わり、2本指は拡大・縮小と庭の移動になる。
const pointers = new Map();
let activeDrag = null;
let pinch = null;
let lastEmptyTap = null;

function startPinch() {
  if (activeDrag) {
    // 1本目の指でのドラッグは取り消す（仕掛けは元の場所へ戻る）
    activeDrag.cancelled = true;
    activeDrag = null;
    $('#temp')?.remove();
    render();
  }
  const [a, b] = [...pointers.values()];
  pinch = { dist0: Math.hypot(a.x - b.x, a.y - b.y), zoom0: state.zoom };
}

function applyPinch() {
  const [a, b] = [...pointers.values()];
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  zoomAt(pinch.zoom0 * (dist / pinch.dist0), (a.x + b.x) / 2, (a.y + b.y) / 2);
}

// 何もないところを素早く2回タップすると、庭全体に戻す。
function tapEmptyGarden(event) {
  const now = performance.now();
  const near = (other) => Math.hypot(event.clientX - other.x, event.clientY - other.y) < 30;
  if (lastEmptyTap && now - lastEmptyTap.time < 300 && near(lastEmptyTap)) {
    lastEmptyTap = null;
    fitWidth(0);
  } else {
    lastEmptyTap = { time: now, x: event.clientX, y: event.clientY };
  }
}

window.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && pointers.size === 2) applyPinch();
});
for (const type of ['pointerup', 'pointercancel']) {
  window.addEventListener(type, (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
  });
}

// マウスのホイールでも拡大・縮小する（PC向け）
wrap.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    zoomAt(state.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX, event.clientY);
  },
  { passive: false },
);

wrap.addEventListener('pointerdown', (event) => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    startPinch();
    return;
  }
  if (pointers.size > 2) return;
  if (state.judging) {
    state.skip = true; // 判定中のタップは、結果だけ見せる
    return;
  }
  const pinEl = event.target.closest('.pin');
  const partEl = event.target.closest('.part');
  const faucetEl = event.target.closest('.faucet');
  const hitEl = event.target.closest('.hit');
  let drag = null;
  if (pinEl) {
    drag = { kind: 'wire', end: readEnd(pinEl) };
  } else if (partEl) {
    const part = findPart(state.board, partEl.dataset.part);
    drag = { kind: 'part', id: part.id, origin: { x: part.x, y: part.y }, el: partEl };
  } else if (faucetEl) {
    drag = { kind: 'faucet', name: faucetEl.dataset.faucet };
  } else if (hitEl) {
    drag = { kind: 'wire-hit', index: Number(hitEl.dataset.wire) };
  } else {
    if (state.pending) {
      state.pending = null;
      render();
    }
    drag = { kind: 'pan' };
  }
  event.preventDefault();
  startDrag(event, drag);
});

tray.addEventListener('pointerdown', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || state.judging) return;
  const type = chip.dataset.type;
  if (remaining(state.board, currentStage(), type) <= 0) return;
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = `<b>${type}　${PART_NAMES[type]}</b>`;
  ghost.style.left = `${event.clientX - 55}px`;
  ghost.style.top = `${event.clientY - 25}px`;
  document.body.append(ghost);
  event.preventDefault();
  startDrag(event, { kind: 'new', type, ghost });
});

schedule.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-row]');
  if (!row || state.judging) return;
  state.faucets = allRows(currentStage().inputs)[Number(row.dataset.row)];
  state.judgeFail = null;
  render();
});

// ---------- ボタン ----------

$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#judge').addEventListener('click', judge);
$('#fit').addEventListener('click', () => {
  fitWidth(0);
  render();
});
$('#delete-wire').addEventListener('click', () => {
  if (state.selectedWire === null) return;
  const wire = state.board.wires[state.selectedWire];
  commit(disconnect(state.board, wire.to));
});
$('#clear-all').addEventListener('click', () => {
  if (window.confirm('仕掛けと水路を全部消しますか？')) commit(createBoard());
});
$('#hint-button').addEventListener('click', () => {
  state.hintLevel = Math.min(state.hintLevel + 1, 2);
  stageProgress(currentStage().no).hintUsed = true;
  saveProgress();
  render();
});
$('#menu').addEventListener('click', () => showScreen('select'));
$('#back').addEventListener('click', () => {
  showScreen('game');
  render();
});
$('#stage-list').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-stage]');
  if (button) openStage(Number(button.dataset.stage));
});
$('#next-stage').addEventListener('click', () => {
  $('#clear-dialog').hidden = true;
  openStage(state.stageIndex + 1);
});
$('#to-menu').addEventListener('click', () => {
  $('#clear-dialog').hidden = true;
  showScreen('select');
});
window.addEventListener('resize', () => {
  if (!$('#game').hidden) fitWidth();
});

showScreen('select');
