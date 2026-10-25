import { COMBINATIONAL_STAGES } from './stages.js';
import { TUTORIALS } from './tutorial.js';
import { faucetIcon, flowerIcon, gateIcon, hostIcon, oyajiIcon, starIcon } from './icons.js';
import {
  ALL_ANGERS,
  angerFor,
  failureKind,
  gateLine,
  growthFor,
  hostLine,
  wiltFor,
} from './reactions.js';
import { CHARACTERS } from './characters.js';
import { expectedOf } from './logic.js';
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
  ruleProblems,
  sameEnd,
} from './board.js';

const SAVE_KEY = 'enjoy_logic.progress.v1';
const JUDGE_STEP_MS = 300; // 実行のとき、水が1段進む時間
const KIND_NAMES = { flower: '花', oyaji: 'おやじ' };
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const OYAJI_SHOW_MS = 2600; // おやじが怒る演出の長さ（タップで飛ばせる）
const MIN_SCALE = 0.8; // 文字が読める最小の大きさ（小さい画面では横にスクロールして庭を動かす）
const MAX_SCALE = 1.3;

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
  run: null, // 実行の結果 { kind, host, message, growth, wilt, problems }
  baseScale: 1,
  zoom: 1,
  tutorialOpen: false,
  angerCount: 0, // このステージでおやじに水をかけた回数（怒り方の段階）
  wiltCount: 0, // このステージで花に水が届かなかった回数
  misses: 0, // このステージで水やりに失敗した回数（星の数に使う）
  marks: null, // 出口ごとの ○×
  cards: [], // これから見せる紹介カード
  progress: loadProgress(),
};

const currentStage = () => COMBINATIONAL_STAGES[state.stageIndex];

// 保存できなくても遊べるように、読み書きは try で囲む。
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved?.stages ? { oyaji: [], settings: {}, cardsSeen: [], ...saved } : { stages: {}, oyaji: [], settings: {}, cardsSeen: [] };
  } catch {
    return { stages: {}, oyaji: [], settings: {}, cardsSeen: [] };
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

// 画面の揺れと点滅を弱める（端末の「動きを減らす」設定のときは、初めから弱める）。
const calm = () => REDUCED_MOTION || Boolean(state.progress.settings.calm);

// ---------- 画面の切り替え・拡大 ----------

function showScreen(name) {
  $('#game').hidden = name !== 'game';
  $('header').hidden = name !== 'game';
  $('#stage-select').hidden = name !== 'select';
  if (name === 'select') {
    renderStageList();
    renderZukan();
  }
}

function setScale(scale) {
  garden.style.setProperty('--s', scale);
  garden.style.transform = `scale(${scale})`;
  // 拡大した分の大きさを、スクロールの範囲として確保する
  $('#garden-box').style.width = `${LAYOUT.width * scale}px`;
  $('#garden-box').style.height = `${LAYOUT.height * scale}px`;
}

// 幅に合わせる（小さい画面では最小の大きさまで）。拡大・縮小はこの大きさの0.5〜2倍。
// 大きい画面でも、下のボタンや仕掛け箱が見えるように、画面の高さの6割までにする。
function fitWidth(minimum = MIN_SCALE) {
  const byWidth = wrap.clientWidth / LAYOUT.width;
  const byHeight = (window.innerHeight * 0.6) / LAYOUT.height;
  state.baseScale = Math.max(Math.min(byWidth, byHeight, MAX_SCALE), minimum);
  state.zoom = 1;
  setScale(state.baseScale);
  wrap.scrollLeft = 0;
  wrap.scrollTop = 0;
}

// 指（マウス）の位置の下にある庭の点を動かさないように、拡大・縮小する。
// 2本指のときは、指の動きに合わせて庭も動く。
function zoomAt(zoom, clientX, clientY) {
  const before = garden.getBoundingClientRect();
  const oldScale = state.baseScale * state.zoom;
  const gardenX = (clientX - before.left) / oldScale;
  const gardenY = (clientY - before.top) / oldScale;
  state.zoom = Math.min(Math.max(zoom, 0.5), 2);
  const scale = state.baseScale * state.zoom;
  setScale(scale);
  // 大きさを変えたあと、同じ庭の点が指の下に来るようにスクロールする
  const after = garden.getBoundingClientRect();
  wrap.scrollLeft += after.left + gardenX * scale - clientX;
  wrap.scrollTop += after.top + gardenY * scale - clientY;
}

// ---------- 状態の変更 ----------

function openStage(index) {
  state.stageIndex = index;
  const stage = currentStage();
  state.board = stageProgress(stage.no).board ?? createBoard();
  state.faucets = stage.faucets; // 蛇口の開け閉めはステージで決まっている
  state.undo = [];
  state.redo = [];
  state.pending = null;
  state.selectedWire = null;
  state.run = null;
  state.marks = null;
  stopReveal();
  state.hintLevel = 0;
  state.angerCount = 0;
  state.wiltCount = 0;
  state.misses = 0;
  wrap.classList.remove('forest');
  // 初めてのステージは、チュートリアルを開いておく
  state.tutorialOpen = Boolean(TUTORIALS[stage.no]) && !stageProgress(stage.no).tutorialSeen;
  showScreen('game');
  fitWidth();
  render();
  // 初めて出てくるキャラは、紹介カードで説明する
  const seen = state.progress.cardsSeen;
  queueCards(stage.intro.filter((key) => !seen.includes(key)));
}

function setBoard(board) {
  state.board = board;
  state.selectedWire = null;
  state.run = null;
  state.marks = null;
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

// 出口の呼び名。同じキャラが2つ以上いるときは番号を付ける（花1、花2）。
function outletLabel(stage, name) {
  const kind = stage.outputs[name];
  const same = Object.keys(stage.outputs).filter((other) => stage.outputs[other] === kind);
  return same.length > 1 ? `${KIND_NAMES[kind]}${same.indexOf(name) + 1}` : KIND_NAMES[kind];
}

function failureMessage(stage, expected, actual) {
  if (!actual) return '水路がぐるぐる回っていて、水の行き先が決まらないよ。';
  const wrong = Object.keys(expected)
    .filter((name) => expected[name] !== actual[name])
    .map((name) => `${outletLabel(stage, name)}${expected[name] ? 'に水が届かなかった' : 'に水がかかってしまった'}`);
  return `${wrong.join('。')}。どこから水が来ているか、水路をたどってみよう。`;
}

// ルールが守れていないときの一言。
function ruleMessage(stage, problems) {
  return problems
    .map((problem) => {
      if (problem.kind === 'outlet') {
        const names = problem.outlets.map((name) => outletLabel(stage, name)).join('と');
        return `${names}に、まだ水路がつながっていないよ。出口は全部つなごう。`;
      }
      if (problem.kind === 'tray') {
        const names = problem.types.map((type) => PART_NAMES[type]).join('と');
        return `仕掛け箱に、まだ${names}が残っているよ。仕掛けは全部使おう。`;
      }
      return 'つながっていない丸がある仕掛けがいるよ。仕掛けの入口も出口も全部つなごう。';
    })
    .join('\n');
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

// 準備完了（実行）：画面に見えている蛇口のまま水を流し、出口のキャラが反応する。
// 成功すると花がぐんぐん育ち、失敗するとおやじが怒る（これが一番の見せ場）。
async function judge() {
  if (state.judging) return;
  const stage = currentStage();
  state.pending = null;
  state.selectedWire = null;
  state.marks = null;
  const problems = ruleProblems(state.board, stage);
  if (problems.length) {
    state.run = { kind: 'rule', problems, host: 'おっと、水を流す前に！', message: ruleMessage(stage, problems) };
    render();
    return;
  }
  state.judging = true;
  state.skip = false;
  state.run = { kind: null, host: null, message: '水を流してみるよ…' };
  await playReveal(JUDGE_STEP_MS);
  const expected = expectedOf(stage);
  const actual = currentLive()?.outputs ?? null;
  const ok = Boolean(actual) && Object.keys(expected).every((name) => expected[name] === actual[name]);
  state.marks = actual
    ? Object.fromEntries(Object.keys(expected).map((name) => [name, expected[name] === actual[name]]))
    : null;
  if (ok) {
    state.run = { kind: 'ok', host: 'やったね！', message: '花には水が届いて、おやじはぐっすり昼寝中。', growth: 0 };
    // 花が段階を追って大きくなり、最後はひまわりの森になる
    const hasFlower = Object.values(expected).some(Boolean);
    for (let level = 1; hasFlower && level <= 4; level++) {
      state.run.growth = level;
      render();
      popText(level === 4 ? 'ひまわりの森！！' : 'ポン！'.repeat(level), 'grow');
      await pause(state.skip || REDUCED_MOTION ? 0 : 550);
    }
  } else {
    const kind = failureKind(expected, actual);
    state.misses += 1;
    state.run = { kind, message: failureMessage(stage, expected, actual) };
    if (kind === 'oyaji') {
      state.angerCount += 1;
      state.run.host = hostLine(kind, state.angerCount);
      render();
      await showOyaji(angerFor(state.angerCount));
    } else {
      if (kind === 'flower') state.wiltCount += 1;
      state.run.wilt = kind === 'flower' ? wiltFor(state.wiltCount) : null;
      state.run.host = hostLine(kind, state.wiltCount);
    }
  }
  state.judging = false;
  render();
  if (ok) {
    await pause(REDUCED_MOTION ? 0 : 500);
    finishStage();
  }
}

// おやじが怒る演出。画面いっぱいに出し、時間がたつかタップで閉じる。
function showOyaji(anger) {
  const seen = state.progress.oyaji;
  const isNew = !seen.includes(anger.id);
  if (isNew) seen.push(anger.id);
  saveProgress();
  const show = $('#oyaji-show');
  const big = anger.id === 'clone'
    ? Array.from({ length: 5 }, () => `<div class="clone-one">${oyajiIcon(anger.mood)}</div>`).join('')
    : oyajiIcon(anger.mood);
  const star = anger.id === 'rocket' ? `<div class="star-after">${starIcon()}</div>` : '';
  show.className = `${anger.id} ${calm() ? 'calm' : ''}`;
  show.innerHTML = `<div class="burst"></div>
    <div class="big-oyaji">${big}</div>${star}
    <p class="shout">${anger.shout}</p>
    <p class="caption">${isNew ? '【おやじ図鑑に登録】' : ''}${anger.title}</p>
    <p class="skip">タップで つぎへ</p>`;
  show.hidden = false;
  if (!calm() && ['giant', 'rocket', 'daibutsu', 'clone'].includes(anger.id)) {
    document.body.classList.remove('shake');
    void document.body.offsetWidth; // 揺れのアニメーションを最初から
    document.body.classList.add('shake');
  }
  return new Promise((resolve) => {
    const close = () => {
      clearTimeout(timer);
      show.removeEventListener('pointerdown', close);
      show.hidden = true;
      document.body.classList.remove('shake');
      resolve();
    };
    const timer = setTimeout(close, REDUCED_MOTION ? 1500 : OYAJI_SHOW_MS);
    show.addEventListener('pointerdown', close);
  });
}

// 庭の上に、大きな書き文字（「ポン！」など）を出す。
function popText(text, kind) {
  if (REDUCED_MOTION) return;
  const el = document.createElement('div');
  el.className = `pop-text ${kind}`;
  el.textContent = text;
  wrap.append(el);
  setTimeout(() => el.remove(), 1200);
}

function finishStage() {
  const stage = currentStage();
  const progress = stageProgress(stage.no);
  // 星：クリア、1回も失敗しない、ヒントを使わない
  const stars = 1 + (state.misses === 0 ? 1 : 0) + (progress.hintUsed ? 0 : 1);
  progress.cleared = true;
  progress.stars = Math.max(progress.stars, stars);
  saveProgress();
  showClear(stars);
}

function showClear(stars) {
  const hasNext = state.stageIndex < COMBINATIONAL_STAGES.length - 1;
  $('#clear-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('#clear-cast').innerHTML = `${flowerIcon('bloom')}${flowerIcon('sun')}${oyajiIcon('clap')}${flowerIcon('sun')}${flowerIcon('bloom')}`;
  $('#next-stage').hidden = !hasNext;
  const dialog = $('#clear-dialog');
  dialog.classList.toggle('fireworks', stars === 3);
  // 紙吹雪
  const colors = ['#ff5a5f', '#ffc93c', '#1e9bff', '#4cbb5a', '#ff8fb1', '#a565c9'];
  $('#confetti').innerHTML = REDUCED_MOTION
    ? ''
    : Array.from({ length: 60 }, (_, i) => {
        const left = Math.round(Math.random() * 100);
        const delay = (Math.random() * 1.2).toFixed(2);
        const spin = Math.round(Math.random() * 720 - 360);
        return `<i style="left:${left}%;background:${colors[i % colors.length]};animation-delay:${delay}s;--spin:${spin}deg"></i>`;
      }).join('');
  dialog.hidden = false;
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
  renderRunStatus();
}

// チュートリアルの手順。できた手順には印が付く。
function renderTutorial(stage) {
  const steps = TUTORIALS[stage.no] ?? [];
  $('#tutorial').hidden = !state.tutorialOpen || steps.length === 0;
  if (state.tutorialOpen === false || steps.length === 0) return;
  const snapshot = {
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

  // 判定の結果を見せている間（実行中か、実行のあと）だけ、出口のキャラが水に反応する。
  const judged = Boolean(state.run) && state.run.kind !== 'rule';
  const problems = state.run?.problems ?? [];
  const problemOutlets = problems.find((problem) => problem.kind === 'outlet')?.outlets ?? [];
  const problemParts = problems.find((problem) => problem.kind === 'loose')?.parts ?? [];

  stage.inputs.forEach((name) => {
    const open = Boolean(state.faucets[name]);
    const top = rowTop(FAUCETS.indexOf(name));
    boxes.push(
      `<div class="box faucet ${open ? 'open' : ''}" data-faucet="${name}" style="left:${LAYOUT.faucetX}px;top:${top}px">${faucetIcon(open)}<span class="label"><span class="name">蛇口${name}</span><span class="sub">${open ? '開いている' : '閉じている'}</span></span></div>`,
    );
    pins.push(pinHtml(stage, { faucet: name }, open));
  });

  // 出口にいるキャラ（花かおやじ）はステージで決まっていて、水が来ても変わらない。
  // 変わるのは様子だけ：花は咲く／しおれる、おやじは昼寝／怒る。
  Object.keys(stage.outputs).forEach((name, index) => {
    const kind = stage.outputs[name];
    const half = levels ? 2 * levels.outlets[name] : 0;
    const water = reached(half) ? live?.outputs[name] : undefined;
    // 水を流している途中は、水が届いた出口から反応する。結果が出たら全部反応する。
    const reacting = judged && water !== undefined && (Boolean(levels) || state.run.kind !== null);
    const run = state.run;
    const growth = kind === 'flower' && water && run?.kind === 'ok' ? growthFor(run.growth) : null;
    const wilt = kind === 'flower' && !water && run?.wilt && !state.judging ? run.wilt : null;
    let mood;
    if (kind === 'flower') {
      if (!reacting) mood = 'bud';
      else if (water) mood = growth && growth.level >= 3 ? 'sun' : 'bloom';
      else mood = wilt?.level === 3 ? 'mummy' : 'wilt';
    } else {
      mood = reacting && water ? 'angry' : 'sleep';
    }
    const picture = kind === 'flower' ? flowerIcon(mood) : oyajiIcon(mood);
    const goal = kind === 'flower' ? '水がほしい' : '水はきらい';
    const ok = water === (kind === 'flower');
    let say = '';
    if (reacting && arriving(half)) {
      if (kind === 'flower' && water) say = '<span class="say pop">ポン！</span>';
      if (kind === 'oyaji' && water) say = '<span class="say pop mad">こらっ！</span>';
      if (kind === 'oyaji' && !water) say = '<span class="say pop">ぐー…</span>';
    }
    if (wilt) say = `<span class="say pop sad">${wilt.shout}</span>`;
    const grow = growth ? `--grow:${growth.scale}` : '';
    const mark = state.marks && !state.judging
      ? `<span class="mark ${state.marks[name] ? 'ok' : 'ng'}">${state.marks[name] ? '○' : '×'}</span>`
      : '';
    const classes = [
      'box',
      'outlet',
      kind,
      reacting ? (ok ? 'ok' : 'ng') : '',
      water ? 'wet' : '',
      reacting && arriving(half) ? 'arrive' : '',
      growth ? 'grown' : '',
      wilt ? `wilt-${wilt.level}` : '',
      problemOutlets.includes(name) ? 'problem' : '',
    ];
    boxes.push(
      `<div class="${classes.join(' ')}" data-outlet="${name}" style="left:${LAYOUT.outletX}px;top:${rowTop(index)}px;${grow}">${picture}<span class="label"><span class="name">${outletLabel(stage, name)}</span><span class="sub">${goal}</span></span>${mark}${say}</div>`,
    );
    pins.push(pinHtml(stage, { outlet: name }, Boolean(water)));
  });

  state.board.parts.forEach((part) => {
    const half = levels ? 2 * levels.parts[part.id] : 0;
    const wet = reached(half) && Boolean(live?.gates[part.id]);
    const classes = ['box', 'part', wet ? 'on' : '', arriving(half) ? 'working' : '', problemParts.includes(part.id) ? 'problem' : ''];
    // 水を受けた仕掛けは、ひとこと言う（水をたどって見せている間だけ）
    let say = '';
    if (levels && reached(half) && live) {
      const inputs = pinsOf(part.type).map((pin) => {
        const index = state.board.wires.findIndex((wire) => sameEnd(wire.to, { part: part.id, pin }));
        return index >= 0 && Boolean(live.wires[index]);
      });
      const line = gateLine(part.type, inputs);
      const boom = part.type === 'XOR' && inputs.every(Boolean);
      if (line) say = `<span class="say ${arriving(half) ? 'pop' : ''} ${boom ? 'boom' : ''}">${line}</span>`;
      if (boom && arriving(half)) classes.push('collide');
    }
    boxes.push(
      `<div class="${classes.join(' ')}" data-part="${part.id}" style="left:${part.x}px;top:${part.y}px">${gateIcon(part.type)}<span class="label"><span class="name">${part.type}</span><span class="sub">${PART_NAMES[part.type]}</span></span>${say}</div>`,
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

  // 花に続けて水をやれると、庭がひまわりの森になる
  wrap.classList.toggle('forest', state.run?.kind === 'ok' && state.run.growth >= 4);
  garden.innerHTML = `<svg id="wires" width="${LAYOUT.width}" height="${LAYOUT.height}" viewBox="0 0 ${LAYOUT.width} ${LAYOUT.height}">${wires}</svg>${boxes.join('')}${pins.join('')}`;
}

// 司会のじょうろの吹き出し。実行の結果と、うまくいかなかった理由を言う。
function renderRunStatus() {
  const box = $('#run-status');
  const run = state.run;
  box.hidden = !run;
  if (!run) return;
  const failed = run.kind && run.kind !== 'ok';
  const host = run.host && !state.judging ? `<b>${run.host}</b><br>` : '';
  box.innerHTML = `<div class="host-row">${hostIcon()}<p class="bubble ${failed ? 'ng' : ''}">${host}${run.message}</p></div>`;
}

function renderTray(stage) {
  const types = Object.keys(stage.tray);
  tray.innerHTML = types.length
    ? types
        .map((type) => {
          const left = remaining(state.board, stage, type);
          return `<div class="chip ${left > 0 ? '' : 'empty'}" data-type="${type}">${gateIcon(type)}<span class="label"><span class="name">${PART_NAMES[type]}</span><span class="sub">${type}　のこり ${left}</span></span></div>`;
        })
        .join('')
    : '<p>このステージは、水路だけでつなぎます。</p>';
  $('#tray-title').textContent = types.length
    ? '仕掛け箱（ドラッグして庭に置く。タップで説明。全部使おう）'
    : '仕掛け箱';
}

function renderToolbar() {
  $('#undo').disabled = state.judging || state.undo.length === 0;
  $('#redo').disabled = state.judging || state.redo.length === 0;
  $('#judge').disabled = state.judging;
  $('#delete-wire').hidden = state.selectedWire === null;
}

function describeRef(stage, ref) {
  if ('input' in ref) return `蛇口${ref.input}`;
  if ('gate' in ref) {
    const gate = stage.solution.gates.find((candidate) => candidate.id === ref.gate);
    return `${PART_NAMES[gate.type]}(${gate.id})`;
  }
  return ref.const ? '1' : '0';
}

// ヒントは2段階：どの出口にどこからの水をつなぐか → 仕掛けの入口まで全部。
function renderHint(stage) {
  const hint = $('#hint-text');
  if (state.hintLevel === 0) {
    hint.hidden = true;
    return;
  }
  const outlets = Object.entries(stage.solution.outputs).map(
    ([name, ref]) => `${outletLabel(stage, name)} ← ${describeRef(stage, ref)}`,
  );
  const gates = stage.solution.gates.map(
    (gate) => `${PART_NAMES[gate.type]}(${gate.id}) ← ${gate.inputs.map((ref) => describeRef(stage, ref)).join('、')}`,
  );
  hint.hidden = false;
  hint.textContent = (state.hintLevel === 1 ? outlets : [...outlets, ...gates]).join('\n');
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

// ---------- キャラの紹介カード ----------

function characterIcon(key) {
  if (key === 'faucet') return faucetIcon(true);
  if (key === 'flower') return flowerIcon('bloom');
  if (key === 'oyaji') return oyajiIcon('sleep');
  return gateIcon(key);
}

// 「入口の水 → 出口の水」の表。水があるところは青い「水」、ないところは「なし」。
function waterCell(value) {
  return `<span class="w ${value ? 'w1' : 'w0'}">${value ? '水' : 'なし'}</span>`;
}

function showCard(key) {
  const character = CHARACTERS[key];
  if (!character) return;
  const table = character.table
    ? `<table class="water-table"><thead><tr><th>入口</th><th></th><th>出口</th></tr></thead><tbody>${character.table
        .map(([inputs, output]) => `<tr><td>${inputs.map(waterCell).join(' ')}</td><td>→</td><td>${waterCell(output)}</td></tr>`)
        .join('')}</tbody></table>`
    : '';
  $('#card').innerHTML = `<div class="card">
      <div class="card-icon">${characterIcon(key)}</div>
      <p class="card-name">${character.name}<span class="card-word">${character.word}</span></p>
      <p class="card-catch">「${character.catch}」</p>
      <ul>${character.lines.map((line) => `<li>${line}</li>`).join('')}</ul>
      ${table}
      <button id="card-close" class="primary">わかった！</button>
    </div>`;
  $('#card').hidden = false;
  if (!state.progress.cardsSeen.includes(key)) {
    state.progress.cardsSeen.push(key);
    saveProgress();
  }
}

// 紹介カードを順に見せる（閉じると次のカード）。
function queueCards(keys) {
  state.cards = [...keys];
  const next = state.cards.shift();
  if (next) showCard(next);
}

function closeCard() {
  $('#card').hidden = true;
  const next = state.cards.shift();
  if (next) showCard(next);
}

// おやじ図鑑。見た怒り方だけ絵が出る。
function renderZukan() {
  const seen = state.progress.oyaji;
  $('#zukan-count').textContent = `${seen.length} / ${ALL_ANGERS.length}`;
  $('#zukan-list').innerHTML = ALL_ANGERS.map((anger) => {
    const found = seen.includes(anger.id);
    return `<li class="${found ? '' : 'unknown'}">${oyajiIcon(found ? anger.mood : 'sleep')}<span>${found ? anger.title : '？？？'}</span></li>`;
  }).join('');
  $('#calm').checked = calm();
  $('#calm').disabled = REDUCED_MOTION;
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
    if (!drag.moved) {
      showCard(findPart(state.board, drag.id).type);
      return;
    }
    if (inside(event, tray)) commit(removePart(state.board, drag.id));
    else commit(movePart(state.board, drag.id, drag.pos.x, drag.pos.y));
    return;
  }
  if (drag.kind === 'card') {
    if (!drag.moved) showCard(drag.key);
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
    if (!drag.moved) {
      showCard(drag.type);
      return;
    }
    if (inside(event, garden)) {
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
  const outletEl = event.target.closest('.outlet');
  const hitEl = event.target.closest('.hit');
  let drag = null;
  if (pinEl) {
    drag = { kind: 'wire', end: readEnd(pinEl) };
  } else if (partEl) {
    const part = findPart(state.board, partEl.dataset.part);
    drag = { kind: 'part', id: part.id, origin: { x: part.x, y: part.y }, el: partEl };
  } else if (faucetEl) {
    drag = { kind: 'card', key: 'faucet' };
  } else if (outletEl) {
    drag = { kind: 'card', key: currentStage().outputs[outletEl.dataset.outlet] };
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
  if (remaining(state.board, currentStage(), type) <= 0) {
    showCard(type);
    return;
  }
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
$('#card').addEventListener('click', (event) => {
  if (event.target.id === 'card-close' || event.target.id === 'card') closeCard();
});
$('#calm').addEventListener('change', (event) => {
  state.progress.settings.calm = event.target.checked;
  saveProgress();
});
$('#back').addEventListener('click', () => {
  showScreen('game');
  fitWidth();
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

$('#logo-cast').innerHTML = `${flowerIcon('bloom')}${gateIcon('NOT')}${oyajiIcon('sleep')}${hostIcon()}${flowerIcon('sun')}`;
showScreen('select');
document.documentElement.dataset.ready = '1';
