import { COMBINATIONAL_STAGES } from './stages.js';
import { TUTORIALS } from './tutorial.js';
import { faucetIcon, flowerIcon, gateIcon, oyajiIcon } from './icons.js';
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
  flowLevels,
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
const PLAY_STEP_MS = 150; // 蛇口を触ったとき、水が1段進む時間（仕掛け1つで約0.3秒）
const JUDGE_STEP_MS = 300; // 実行のとき、水が1段進む時間
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const MIN_SCALE = 0.8; // 文字が読める最小の大きさ（小さい画面では横にスクロールして庭を動かす）

const $ = (selector) => document.querySelector(selector);
const wrap = $('#garden-wrap');
const garden = $('#garden');
const tray = $('#tray');

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
  skip: false,
  reveal: null, // 水をたどって見せている途中の段（null のときは全部見せる）
  revealToken: 0,
  run: null, // 実行の進み具合 { rows, index, results, failure }
  rowMarks: null, // 出口ごとの ○×
  baseScale: 1,
  zoom: 1,
  tutorialOpen: false,
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
  state.run = null;
  state.rowMarks = null;
  stopReveal();
  state.hintLevel = 0;
  // 初めてのステージは、チュートリアルを開いておく
  state.tutorialOpen = Boolean(TUTORIALS[stage.no]) && !stageProgress(stage.no).tutorialSeen;
  showScreen('game');
  fitWidth();
  render();
}

function setBoard(board) {
  state.board = board;
  state.selectedWire = null;
  state.run = null;
  state.rowMarks = null;
  stopReveal();
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
  state.run = null;
  state.rowMarks = null;
  playReveal(PLAY_STEP_MS); // 水が仕掛けを1つずつ通る様子を見せる
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

// 1つの開け方について、出口ごとに目標どおりかを返す（水路がぐるぐる回っていると null）。
function rowMarks(stage, board, row) {
  try {
    const { outputs } = liveState(board, stage, row);
    return Object.fromEntries(
      Object.keys(stage.outputs).map((name) => [name, outputs[name] === stage.outputs[name](row)]),
    );
  } catch {
    return null;
  }
}

function failureMessage(stage, row, marks) {
  if (!marks) return '水路がぐるぐる回っていて、水の行き先が決まらないよ。';
  const faucets = stage.inputs.map((name) => `蛇口${name}が${row[name] ? '開' : '閉'}`).join('、');
  const wrong = Object.keys(marks)
    .filter((name) => !marks[name])
    .map((name) => `${OUTLET_NAMES[name]}${stage.outputs[name](row) ? 'に水が届かなかった' : 'に水がかかってしまった'}`);
  return `${faucets}のとき、${wrong.join('。')}。`;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stopReveal() {
  state.revealToken += 1;
  state.reveal = null;
}

// 水を蛇口から順番にたどって見せる。水路を流れる段と、仕掛けが動く段を交互に進める。
// 途中で盤面が変わったら（stopReveal）、そこでやめる。
async function playReveal(stepMs) {
  const token = ++state.revealToken;
  const levels = flowLevels(state.board, currentStage());
  const ms = REDUCED_MOTION ? 0 : stepMs;
  garden.style.setProperty('--step', `${ms}ms`);
  if (levels && ms > 0) {
    const last = 2 * Math.max(1, ...Object.values(levels.parts), ...Object.values(levels.outlets));
    for (let half = 0; half <= last; half++) {
      if (token !== state.revealToken) return;
      state.reveal = half;
      render();
      await pause(state.skip ? 0 : ms);
    }
  }
  if (token !== state.revealToken) return;
  state.reveal = null;
  render();
}

// 準備完了（実行）：蛇口の開け方を1つずつ試し、水の流れをたどって出口に ○× を付ける。
async function judge() {
  if (state.judging) return;
  const stage = currentStage();
  const rows = allRows(stage.inputs);
  state.judging = true;
  state.skip = false;
  state.pending = null;
  state.selectedWire = null;
  state.run = { rows, index: 0, results: [], failure: null };
  for (let i = 0; i < rows.length; i++) {
    state.run.index = i;
    state.faucets = rows[i];
    state.rowMarks = null;
    await playReveal(JUDGE_STEP_MS);
    const marks = rowMarks(stage, state.board, rows[i]);
    const ok = Boolean(marks) && Object.values(marks).every(Boolean);
    state.rowMarks = marks;
    state.run.results.push(ok);
    if (!ok) state.run.failure = failureMessage(stage, rows[i], marks);
    render();
    await pause(state.skip || REDUCED_MOTION ? 0 : 700);
    if (!ok) break;
  }
  state.judging = false;
  render();
  if (!state.run.failure) finishStage();
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
  $('#mission').textContent = `目標：${stage.mission}`;
  $('#mission').hidden = !stage.mission;
  renderGarden(stage, live);
  renderTray(stage);
  renderToolbar();
  renderHint(stage);
  renderTutorial(stage);
  renderRunStatus(stage);
}

// チュートリアルの手順。できた手順には印が付く。
function renderTutorial(stage) {
  const steps = TUTORIALS[stage.no] ?? [];
  $('#tutorial').hidden = !state.tutorialOpen || steps.length === 0;
  if (state.tutorialOpen === false || steps.length === 0) return;
  const snapshot = {
    faucets: state.faucets,
    board: state.board,
    cleared: Boolean(stageProgress(stage.no).cleared),
  };
  const doneFlags = steps.map((step) => Boolean(step.done(snapshot)));
  const current = doneFlags.indexOf(false);
  $('#tutorial-steps').innerHTML = steps
    .map((step, i) => {
      const cls = doneFlags[i] ? 'done' : i === current ? 'now' : '';
      return `<li class="${cls}">${step.text}</li>`;
    })
    .join('');
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
  // 水をたどって見せている途中なら、段（half）が今の段までのものだけに水を見せる。
  const levels = state.reveal === null ? null : flowLevels(state.board, stage);
  const reached = (half) => !levels || half <= state.reveal;
  const arriving = (half) => Boolean(levels) && half === state.reveal;

  stage.inputs.forEach((name) => {
    const open = Boolean(state.faucets[name]);
    const top = rowTop(FAUCETS.indexOf(name));
    boxes.push(
      `<div class="box faucet ${open ? 'open' : ''}" data-faucet="${name}" style="left:${LAYOUT.faucetX}px;top:${top}px">${faucetIcon(open)}<span class="label"><span class="name">蛇口${name}</span><span class="sub">${open ? '開いている' : '閉じている'}</span></span></div>`,
    );
    pins.push(pinHtml(stage, { faucet: name }, open));
  });

  Object.keys(stage.outputs).forEach((name, index) => {
    const half = levels ? 2 * levels.outlets[name] : 0;
    const expected = stage.outputs[name](state.faucets);
    const actual = reached(half) ? live?.outputs[name] : undefined;
    const status = actual === undefined ? 'waiting' : actual === expected ? 'ok' : 'ng';
    // 絵は水が届いた結果（花は咲く、おやじは怒る）。下の文は、本当の目標。
    const picture = expected ? flowerIcon(Boolean(actual)) : oyajiIcon(Boolean(actual));
    const goal = expected ? '水をもらう' : '水をかけない';
    const mark = state.rowMarks
      ? `<span class="mark ${state.rowMarks[name] ? 'ok' : 'ng'}">${state.rowMarks[name] ? '○' : '×'}</span>`
      : '';
    const classes = ['box', 'outlet', status, actual ? 'wet' : '', arriving(half) ? 'arrive' : ''];
    boxes.push(
      `<div class="${classes.join(' ')}" data-outlet="${name}" style="left:${LAYOUT.outletX}px;top:${rowTop(index)}px">${picture}<span class="label"><span class="name">${OUTLET_NAMES[name]}</span><span class="sub">${goal}</span></span>${mark}</div>`,
    );
    pins.push(pinHtml(stage, { outlet: name }, false));
  });

  state.board.parts.forEach((part) => {
    const half = levels ? 2 * levels.parts[part.id] : 0;
    const wet = reached(half) && Boolean(live?.gates[part.id]);
    const classes = ['box', 'part', wet ? 'on' : '', arriving(half) ? 'working' : ''];
    boxes.push(
      `<div class="${classes.join(' ')}" data-part="${part.id}" style="left:${part.x}px;top:${part.y}px">${gateIcon(part.type)}<span class="label"><span class="name">${part.type}</span><span class="sub">${PART_NAMES[part.type]}</span></span></div>`,
    );
    pinsOf(part.type).forEach((pin) => pins.push(pinHtml(stage, { part: part.id, pin }, false)));
    pins.push(pinHtml(stage, { part: part.id, pin: 'out' }, wet));
  });

  const wires = state.board.wires
    .map((wire, i) => {
      const a = pinPosition(stage, state.board, wire.from);
      const b = pinPosition(stage, state.board, wire.to);
      const middle = (a.x + b.x) / 2;
      const d = `M${a.x} ${a.y} H${middle} V${b.y} H${b.x}`;
      const half = levels ? 2 * levels.wires[i] + 1 : 0;
      const on = reached(half) && Boolean(live?.wires[i]);
      const classes = [
        'wire',
        reached(half) ? '' : 'waiting',
        on ? 'on' : '',
        on && arriving(half) ? 'arrive' : '',
        state.selectedWire === i ? 'selected' : '',
      ];
      // 水が流れている水路には、流れる模様を重ねる
      const flow = on && !arriving(half) ? `<path class="flow" d="${d}"/>` : '';
      return `<path class="${classes.join(' ')}" d="${d}" pathLength="100"/>${flow}<path class="hit" data-wire="${i}" d="${d}"/>`;
    })
    .join('');

  garden.innerHTML = `<svg id="wires" width="${LAYOUT.width}" height="${LAYOUT.height}" viewBox="0 0 ${LAYOUT.width} ${LAYOUT.height}">${wires}</svg>${boxes.join('')}${pins.join('')}`;
}

// 実行中の進み具合（試した開け方ごとの ○×）と、うまくいかなかった理由。
function renderRunStatus(stage) {
  const box = $('#run-status');
  const run = state.run;
  box.hidden = !run;
  if (!run) return;
  const dots = run.rows
    .map((_, i) => {
      const result = run.results[i];
      if (result === undefined) {
        const now = state.judging && i === run.index ? 'now' : '';
        return `<span class="dot ${now}">${i + 1}</span>`;
      }
      return `<span class="dot ${result ? 'ok' : 'ng'}">${result ? '○' : '×'}</span>`;
    })
    .join('');
  const row = run.rows[run.index];
  const faucets = stage.inputs.map((name) => `蛇口${name}：${row[name] ? '開' : '閉'}`).join('　');
  let message = 'すべての開け方で成功！';
  if (run.failure) message = run.failure;
  else if (state.judging) message = `ためしている開け方　${faucets}`;
  box.innerHTML = `<div class="dots">${dots}</div><p class="${run.failure ? 'ng' : ''}">${message}</p>`;
}

function renderTray(stage) {
  const types = Object.keys(stage.tray);
  tray.innerHTML = types.length
    ? types
        .map((type) => {
          const left = remaining(state.board, stage, type);
          return `<div class="chip ${left > 0 ? '' : 'empty'}" data-type="${type}">${gateIcon(type)}<span class="label"><span class="name">${type}　${PART_NAMES[type]}</span><span class="sub">のこり ${left}</span></span></div>`;
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
  if (!state.judging) stopReveal(); // 触り始めたら、水をたどる演出はやめて全部見せる
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
    drag.ghost.style.left = `${event.clientX - 60}px`;
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
  ghost.innerHTML = `${gateIcon(type)}<span class="name">${type}</span>`;
  ghost.style.left = `${event.clientX - 60}px`;
  ghost.style.top = `${event.clientY - 25}px`;
  document.body.append(ghost);
  event.preventDefault();
  startDrag(event, { kind: 'new', type, ghost });
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
$('#tutorial-button').addEventListener('click', () => {
  state.tutorialOpen = !state.tutorialOpen;
  render();
});
$('#tutorial-close').addEventListener('click', () => {
  state.tutorialOpen = false;
  stageProgress(currentStage().no).tutorialSeen = true;
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
