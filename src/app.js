import { ALL_STAGES } from './stages.js';
import { TUTORIALS } from './tutorial.js';
import { dogIcon, faucetIcon, flowerIcon, gateIcon, hostIcon, oyajiIcon, shishiodoshiIcon, starIcon, timeIcon } from './icons.js';
import {
  ALL_ANGERS,
  ALL_DOG_FORMS,
  angerFor,
  dogFormFor,
  dogHostLine,
  dogReaction,
  dogShout,
  failureKind,
  gateLine,
  growthFor,
  hostLine,
  wiltFor,
} from './reactions.js';
import { CHARACTERS } from './characters.js';
import { TIME_NAMES, expectedAt, expectedOf, faucetsAt } from './logic.js';
import {
  layoutOf,
  FAUCETS,
  PART_NAMES,
  addPart,
  connect,
  createBoard,
  disconnect,
  findPart,
  flowLevels,
  isSource,
  liveSequence,
  liveState,
  movePart,
  pinPosition,
  pinsOf,
  remaining,
  removePart,
  rowTop,
  ruleProblems,
  sanitizeBoard,
  wirePaths,
  sameEnd,
} from './board.js';

// ステージを予定表（朝・昼・夕方・夜）つきに作り直したので、保存の場所も新しくした。
// 前の版（v1・v2）のステージの進み具合は使わない（おやじ図鑑・設定・見たカードだけ引き継ぐ）。
const SAVE_KEY = 'enjoy_logic.progress.v3';
const OLD_SAVE_KEYS = ['enjoy_logic.progress.v2', 'enjoy_logic.progress.v1'];
// 時間はすべて「ふつう」の速さのときの長さ。実際には、選んだ速さの倍率をかける（speedMs）。
const TIME_OK_MS = 700; // 1つの時間がうまくいったあと、次の時間に進むまでの間
const JUDGE_STEP_MS = 300; // 実行のとき、水が1段進む時間
const KIND_NAMES = { flower: '花', oyaji: 'おやじ', dog: 'パクパク君' };
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const OYAJI_SHOW_MS = 2600; // おやじが怒る演出の長さ（タップで飛ばせる）
// アニメーションの速さ。初めは「ゆっくり」にして、慣れたら上げられる。scale は時間の倍率。
const SPEEDS = [
  { id: 'slow', label: 'ゆっくり', scale: 1.8 },
  { id: 'normal', label: 'ふつう', scale: 1 },
  { id: 'fast', label: 'はやい', scale: 0.5 },
];
const DEFAULT_SPEED = 'slow';
// ステージは前のステージをクリアすると開く。開発や確認のときは、URL の末尾に ?all を付けると全部選べる。
const UNLOCK_ALL_STAGES = new URLSearchParams(window.location.search).has('all');
const MIN_SCALE = 0.8; // 文字が読める最小の大きさ（小さい画面では横にスクロールして庭を動かす）
const MAX_SCALE = 1.3;

const $ = (selector) => document.querySelector(selector);
const wrap = $('#garden-wrap');
const garden = $('#garden');
const tray = $('#tray');

const state = {
  stageIndex: 0,
  board: createBoard(),
  timeIndex: 0, // 庭に見せている予定表の時間（実行中は、水を流している時間）
  faucets: {},
  timeResults: [], // 実行で確かめた時間ごとの ○×（true / false。まだなら undefined）
  timesSeen: [], // このステージで見た予定表の時間（チュートリアルに使う）
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
  beat: 0, // 順序回路編：今見ている拍（0 が1拍目）
  dogForm: 'puppy', // 順序回路編：パクパク君の今の姿（失敗するたびに変わる）
  kakon: false, // 順序回路編：拍が進んだ瞬間（ししおどしが傾く）
  marks: null, // 出口ごとの ○×
  cards: [], // これから見せる紹介カード
  progress: loadProgress(),
};

const currentStage = () => ALL_STAGES[state.stageIndex];
const currentTime = () => currentStage().times[state.timeIndex]; // 組み合わせ回路編だけ
const layout = () => layoutOf(currentStage()); // 今のステージの庭の大きさ

// 保存できなくても遊べるように、読み書きは try で囲む。
function loadProgress() {
  const empty = { stages: {}, oyaji: [], dogs: [], settings: {}, cardsSeen: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved?.stages) return { ...empty, ...saved };
    for (const key of OLD_SAVE_KEYS) {
      const old = JSON.parse(localStorage.getItem(key));
      if (old) return { ...empty, oyaji: old.oyaji ?? [], settings: old.settings ?? {}, cardsSeen: old.cardsSeen ?? [] };
    }
    return empty;
  } catch {
    return empty;
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

const currentSpeed = () => SPEEDS.find((speed) => speed.id === state.progress.settings.speed) ?? SPEEDS.find((speed) => speed.id === DEFAULT_SPEED);
const speedMs = (ms) => Math.round(ms * currentSpeed().scale);

// 速さを1段ずつ切り替える（ゆっくり → ふつう → はやい → ゆっくり …）。
function cycleSpeed() {
  const index = SPEEDS.indexOf(currentSpeed());
  state.progress.settings.speed = SPEEDS[(index + 1) % SPEEDS.length].id;
  saveProgress();
  render();
}

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
  const L = layout();
  garden.style.width = `${L.width}px`;
  garden.style.height = `${L.height}px`;
  $('#garden-box').style.width = `${L.width * scale}px`;
  $('#garden-box').style.height = `${L.height * scale}px`;
}

// 幅に合わせる（小さい画面では最小の大きさまで）。拡大・縮小はこの大きさの0.5〜2倍。
// 大きい画面でも、下のボタンや仕掛け箱が見えるように、画面の高さの6割までにする。
function fitWidth(minimum = MIN_SCALE) {
  const byWidth = wrap.clientWidth / layout().width;
  const byHeight = (window.innerHeight * 0.6) / layout().height;
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
  state.board = sanitizeBoard(stageProgress(stage.no).board, stage);
  state.timesSeen = [];
  state.beat = 0;
  state.dogForm = 'puppy';
  if (stage.kind === 'seq') {
    // 順序回路編は拍ごとの蛇口。子犬のパクパク君は、会った時点で図鑑に登録する
    state.faucets = faucetsAt(stage, 0);
    if (!state.progress.dogs.includes('puppy')) {
      state.progress.dogs.push('puppy');
      saveProgress();
    }
  } else {
    showTime(0);
  }
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

// 予定表の時間を庭に見せる。蛇口の開け閉めと花だんのキャラは、時間ごとにステージで決まっている。
function showTime(index) {
  state.timeIndex = index;
  state.faucets = currentStage().times[index].faucets;
  if (!state.timesSeen.includes(index)) state.timesSeen.push(index);
}

function setBoard(board) {
  state.board = board;
  state.selectedWire = null;
  state.run = null;
  state.marks = null;
  state.timeResults = [];
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
  const stage = currentStage();
  try {
    if (stage.kind === 'seq') return liveSequence(state.board, stage)[state.beat];
    return liveState(state.board, stage, state.faucets);
  } catch {
    return null; // 水路がぐるぐる回っているときは水が流れない扱い
  }
}

// ---------- 判定 ----------

// 出口（花だん）の呼び名。2つ以上あるときは番号を付ける（花だん1、花だん2）。
// 順序回路編の出口はパクパク君。
function outletLabel(stage, name) {
  const base = stage.kind === 'seq' ? KIND_NAMES.dog : '花だん';
  return stage.outlets.length > 1 ? `${base}${stage.outlets.indexOf(name) + 1}` : base;
}

// 予定表が2回以上のときは、どの時間のことかを頭に付ける。
function timePrefix(stage, time) {
  return stage.times.length > 1 ? `${TIME_NAMES[time.time]}に、` : '';
}

function failureMessage(stage, time, expected, actual) {
  if (!actual) return '水路がぐるぐる回っていて、水の行き先が決まらないよ。';
  const wrong = Object.keys(expected)
    .filter((name) => expected[name] !== actual[name])
    .map((name) =>
      expected[name]
        ? `${outletLabel(stage, name)}の花に水が届かなかった`
        : `${outletLabel(stage, name)}で寝ていたおやじに水がかかってしまった`,
    );
  return `${timePrefix(stage, time)}${wrong.join('。')}。その時間の蛇口から、どこへ水が来ているか、水路をたどってみよう。`;
}

// ルールが守れていないときの一言。
function ruleMessage(stage, problems) {
  return problems
    .map((problem) => {
      if (problem.kind === 'outlet') {
        const names = problem.outlets.map((name) => outletLabel(stage, name)).join('と');
        return `${names}に、まだ水路がつながっていないよ。花だんは全部つなごう。`;
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
  const ms = REDUCED_MOTION ? 0 : speedMs(stepMs);
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

// 準備完了（実行）：予定表の時間の順に1回ずつ水を流し、花だんのキャラが反応する。
// 全部の時間でうまくいくと花がぐんぐん育ち、どこかの時間で失敗すると、そこで止めておやじが怒る。
async function judge() {
  if (state.judging) return;
  const stage = currentStage();
  state.pending = null;
  state.selectedWire = null;
  state.marks = null;
  state.timeResults = [];
  const problems = ruleProblems(state.board, stage);
  if (problems.length) {
    state.run = { kind: 'rule', problems, host: 'おっと、水を流す前に！', message: ruleMessage(stage, problems) };
    render();
    return;
  }
  if (stage.kind === 'seq') {
    await judgeSequence(stage);
    return;
  }
  state.judging = true;
  state.skip = false;
  let failed = null;
  for (const [index, time] of stage.times.entries()) {
    showTime(index);
    state.marks = null;
    const when = stage.times.length > 1 ? `${TIME_NAMES[time.time]}（${index + 1}/${stage.times.length}回目）、` : '';
    state.run = { kind: null, host: null, message: `${when}水を流してみるよ…` };
    await playReveal(JUDGE_STEP_MS);
    const expected = expectedOf(time);
    const actual = currentLive()?.outputs ?? null;
    const ok = Boolean(actual) && Object.keys(expected).every((name) => expected[name] === actual[name]);
    state.marks = actual
      ? Object.fromEntries(Object.keys(expected).map((name) => [name, expected[name] === actual[name]]))
      : null;
    state.timeResults[index] = ok;
    if (!ok) {
      failed = { time, expected, actual };
      break;
    }
    if (index < stage.times.length - 1) {
      state.run = { kind: null, host: null, message: `${TIME_NAMES[time.time]}はうまくいった！次は${TIME_NAMES[stage.times[index + 1].time]}。` };
      render();
      popText(`${TIME_NAMES[time.time]} OK！`, 'grow');
      await pause(state.skip || REDUCED_MOTION ? 0 : speedMs(TIME_OK_MS));
    }
  }
  if (!failed) {
    // 花は一気に大きく育ち、庭がひまわりの森になる
    const all = stage.times.length > 1 ? 'どの時間も、' : '';
    state.run = { kind: 'ok', host: 'やったね！', message: `${all}花には水が届いて、おやじはぐっすり寝たまま。`, growth: 4 };
    render();
    if (Object.values(expectedOf(currentTime())).some(Boolean)) popText('ポン！', 'grow');
    await pause(state.skip || REDUCED_MOTION ? 0 : speedMs(1000));
  } else {
    const { time, expected, actual } = failed;
    const kind = failureKind(expected, actual);
    state.misses += 1;
    state.run = { kind, message: failureMessage(stage, time, expected, actual) };
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
  if (!failed) {
    await pause(REDUCED_MOTION ? 0 : speedMs(500));
    finishStage();
  }
}

// 順序回路編の準備完了：1拍目から順に、カコンごとに水を流して、パクパク君が反応する。
// 失敗した拍で止める。パクパク君は失敗するたびに姿が変わる。
async function judgeSequence(stage) {
  let beats;
  try {
    beats = liveSequence(state.board, stage);
  } catch {
    state.run = { kind: 'loop', host: hostLine('loop', 1), message: '水路がぐるぐる回っていて、水の行き先が決まらないよ。' };
    render();
    return;
  }
  state.judging = true;
  state.skip = false;
  state.run = { kind: null, host: null, message: '1拍目から、順に水を流すよ…', results: [] };
  let ok = true;
  for (let beat = 0; beat < stage.beats; beat++) {
    state.beat = beat;
    state.faucets = beats[beat].faucets;
    state.marks = null;
    state.run.message = `${beat + 1}拍目`;
    // 2拍目からは、ししおどしがカコンと鳴って、ためていた水を流す
    state.kakon = beat > 0;
    state.run.beatDone = false;
    if (state.kakon) popText('カコン！', 'kakon');
    await playReveal(JUDGE_STEP_MS);
    state.kakon = false;
    state.run.beatDone = true; // 水が届いたあとも、次の拍までパクパク君の反応を見せておく
    const expected = expectedAt(stage, beat);
    const actual = beats[beat].outputs;
    const good = Object.keys(expected).every((name) => expected[name] === actual[name]);
    state.marks = Object.fromEntries(Object.keys(expected).map((name) => [name, expected[name] === actual[name]]));
    state.run.results[beat] = good;
    if (!good) {
      ok = false;
      const reaction = dogReaction(expected, actual);
      state.misses += 1;
      const form = dogFormFor(state.misses);
      state.dogForm = form.id;
      state.run = {
        ...state.run,
        kind: 'dog',
        host: dogHostLine(reaction, beat),
        message:
          reaction === 'bite'
            ? 'この拍、パクパク君は口を閉じていた。水路をたどって、この拍に水が来ないようにしよう。'
            : 'この拍、パクパク君は口を開けて待っていた。この拍に水が届くようにしよう。',
      };
      render();
      await showDog(form, reaction);
      break;
    }
    render();
    await pause(state.skip || REDUCED_MOTION ? 0 : speedMs(450));
  }
  if (ok) {
    state.run = {
      ...state.run,
      kind: 'ok',
      host: 'やったね！',
      message: 'パクパク君は、口を開けた拍に全部水を飲めた！',
    };
  }
  state.judging = false;
  render();
  if (ok) {
    await pause(REDUCED_MOTION ? 0 : speedMs(500));
    finishStage();
  }
}

// パクパク君が反応する演出。かみつく（bite）か、悲しそうに見つめる（sad）。
function showDog(form, reaction) {
  const seen = state.progress.dogs;
  const isNew = !seen.includes(form.id);
  if (isNew) seen.push(form.id);
  saveProgress();
  return showOverlay({
    className: `dog-show ${reaction} ${form.id}`,
    picture: dogIcon(form.id, reaction),
    shout: dogShout(form.id, reaction),
    caption: `${isNew ? '【パクパク君図鑑に登録】' : ''}${form.title}`,
    shake: reaction === 'bite' && form.id !== 'puppy',
  });
}

// 画面いっぱいの演出（おやじ・パクパク君）。時間がたつかタップで閉じる。
function showOverlay({ className, picture, extra = '', shout, caption, shake }) {
  const show = $('#oyaji-show');
  show.className = `${className} ${calm() ? 'calm' : ''}`;
  show.innerHTML = `<div class="burst"></div>
    <div class="big-oyaji">${picture}</div>${extra}
    <p class="shout">${shout}</p>
    <p class="caption">${caption}</p>
    <p class="skip">タップで つぎへ</p>`;
  show.hidden = false;
  // 動き（CSS のアニメーション）も、選んだ速さに合わせる
  for (const animation of show.getAnimations({ subtree: true })) animation.playbackRate = 1 / currentSpeed().scale;
  if (!calm() && shake) {
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
    const timer = setTimeout(close, REDUCED_MOTION ? 1500 : speedMs(OYAJI_SHOW_MS));
    show.addEventListener('pointerdown', close);
  });
}

// おやじが怒る演出。画面いっぱいに出し、時間がたつかタップで閉じる。
function showOyaji(anger) {
  const seen = state.progress.oyaji;
  const isNew = !seen.includes(anger.id);
  if (isNew) seen.push(anger.id);
  saveProgress();
  const picture = anger.id === 'clone'
    ? Array.from({ length: 5 }, () => `<div class="clone-one">${oyajiIcon(anger.mood)}</div>`).join('')
    : oyajiIcon(anger.mood);
  return showOverlay({
    className: anger.id,
    picture,
    extra: anger.id === 'rocket' ? `<div class="star-after">${starIcon()}</div>` : '',
    shout: anger.shout,
    caption: `${isNew ? '【おやじ図鑑に登録】' : ''}${anger.title}`,
    shake: ['giant', 'rocket', 'daibutsu', 'clone'].includes(anger.id),
  });
}

// 庭の上に、大きな書き文字（「ポン！」など）を出す。
function popText(text, kind) {
  if (REDUCED_MOTION) return;
  const el = document.createElement('div');
  el.className = `pop-text ${kind}`;
  el.textContent = text;
  el.style.animationDuration = `${speedMs(1200)}ms`;
  wrap.append(el);
  setTimeout(() => el.remove(), speedMs(1200));
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
  const hasNext = state.stageIndex < ALL_STAGES.length - 1;
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

// 見えない庭で、まだ水を流していない（準備完了を押していない）とき。
function veiled(stage) {
  return stage.hidden && !state.judging && !(state.run && state.run.kind !== 'rule');
}

function render() {
  const stage = currentStage();
  // 見えない庭では、水を流すまで水路の水を見せない（蛇口の開け閉めは見せる）
  const live = veiled(stage) ? null : currentLive();
  wrap.classList.toggle('veiled', veiled(stage));
  $('#title').textContent = `${stage.no}. ${stage.title}`;
  $('#lesson').textContent = stage.lesson;
  $('#mission').textContent = `目標：${stage.mission}`;
  $('#mission').hidden = !stage.mission;
  renderSchedule(stage);
  renderTimeline(stage);
  renderGarden(stage, live);
  renderTray(stage);
  renderToolbar();
  renderHint(stage);
  renderTutorial(stage);
  renderRunStatus();
}

// 順序回路編のタイムライン。拍ごとの蛇口とパクパク君の口を、全部の拍ぶん並べる。
// マスをタップすると、その拍の庭（水の様子）が見られる。判定のあとは拍ごとに ○× が付く。
function renderTimeline(stage) {
  const box = $('#timeline');
  box.hidden = stage.kind !== 'seq';
  if (box.hidden) return;
  const beats = Array.from({ length: stage.beats }, (_, i) => i);
  const now = (i) => (i === state.beat ? 'now' : '');
  const results = state.run?.results ?? [];
  const head = `<div class="tl-row"><span class="tl-name">拍</span>${beats
    .map((i) => `<button class="tl-cell beat ${now(i)}" data-beat="${i}">${i + 1}</button>`)
    .join('')}</div>`;
  const faucets = stage.inputs
    .map(
      (name) => `<div class="tl-row"><span class="tl-name">蛇口${name}</span>${beats
        .map((i) => {
          const open = Boolean(stage.faucets[name][i]);
          return `<button class="tl-cell ${open ? 'w1' : 'w0'} ${now(i)}" data-beat="${i}">${open ? '開' : '閉'}</button>`;
        })
        .join('')}</div>`,
    )
    .join('');
  const dogs = Object.keys(stage.outputs)
    .map(
      (name) => `<div class="tl-row"><span class="tl-name">${outletLabel(stage, name)}</span>${beats
        .map((i) => {
          const open = Boolean(stage.mouth[name][i]);
          const mark = results[i] === undefined ? '' : results[i] ? 'ok' : 'ng';
          return `<button class="tl-cell mouth ${open ? 'open' : 'shut'} ${mark} ${now(i)}" data-beat="${i}">${open ? 'あーん' : 'むっ'}</button>`;
        })
        .join('')}</div>`,
    )
    .join('');
  box.innerHTML = `${head}${faucets}${dogs}`;
}

// タイムラインのマスをタップして、その拍の庭を見る。
function showBeat(beat) {
  if (state.judging) return;
  const stage = currentStage();
  state.beat = beat;
  state.faucets = faucetsAt(stage, beat);
  state.run = null;
  state.marks = null;
  playReveal(FLOW_STEP_MS);
}

// チュートリアルの手順。できた手順には印が付く。
function renderTutorial(stage) {
  const steps = TUTORIALS[stage.no] ?? [];
  $('#tutorial').hidden = !state.tutorialOpen || steps.length === 0;
  if (state.tutorialOpen === false || steps.length === 0) return;
  const snapshot = {
    beat: state.beat,
    faucets: state.faucets,
    board: state.board,
    cleared: Boolean(stageProgress(stage.no).cleared),
    timesSeen: state.timesSeen,
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

// 仕掛けの入口に来ている水（水路がつながっていない入口は水なし）。
function partInputs(part, live) {
  return pinsOf(part.type).map((pin) => {
    const index = state.board.wires.findIndex((wire) => sameEnd(wire.to, { part: part.id, pin }));
    return index >= 0 && Boolean(live?.wires[index]);
  });
}

// 仕掛けの絵。ししおどしは、入口に水が来ている（ためている）と筒が青くなる。
function partIcon(part, live) {
  if (part.type === 'DFF') return shishiodoshiIcon(Boolean(live) && partInputs(part, live)[0]);
  return gateIcon(part.type);
}

// 予定表：どの時間に、蛇口の開け閉めと花だんのキャラがどうなるか。前もって全部見せる。
// 行をタップすると、その時間の庭を見られる（実行中は、水を流している時間が光る）。
function renderSchedule(stage) {
  const box = $('#schedule');
  // 順序回路編は予定表の代わりにタイムライン（renderTimeline）を出す
  const seq = stage.kind === 'seq';
  box.hidden = seq;
  $('#schedule-title').hidden = seq;
  if (seq) return;
  const head = `<tr><th>時間</th>${stage.inputs.map((name) => `<th>蛇口${name}</th>`).join('')}${stage.outlets
    .map((name) => `<th>${outletLabel(stage, name)}</th>`)
    .join('')}<th></th></tr>`;
  const rows = stage.times
    .map((time, index) => {
      const faucets = stage.inputs
        .map((name) => {
          const open = time.faucets[name];
          return `<td><span class="tap ${open ? 'open' : ''}">${faucetIcon(open)}${open ? '開' : '閉'}</span></td>`;
        })
        .join('');
      const outlets = stage.outlets
        .map((name) => {
          const kind = time.outputs[name];
          const picture = kind === 'flower' ? flowerIcon('bloom') : oyajiIcon('sleep');
          return `<td><span class="who ${kind}">${picture}${kind === 'flower' ? '花' : 'おやじ'}</span></td>`;
        })
        .join('');
      const result = state.timeResults[index];
      const mark = result === undefined ? '' : `<span class="time-mark ${result ? 'ok' : 'ng'}">${result ? '○' : '×'}</span>`;
      const now = index === state.timeIndex ? 'now' : '';
      return `<tr class="${now}" data-time="${index}"><th>${timeIcon(time.time)}${TIME_NAMES[time.time]}</th>${faucets}${outlets}<td class="result">${mark}</td></tr>`;
    })
    .join('');
  const many = stage.times.length > 1;
  $('#schedule-title').textContent = many
    ? `予定表（${stage.times.map((time) => TIME_NAMES[time.time]).join(' → ')} の${stage.times.length}回、水を流す。行をタップでその時間の庭）`
    : `予定表（${TIME_NAMES[stage.times[0].time]}の1回だけ水を流す）`;
  box.innerHTML = `<table>${head}${rows}</table>`;
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
      `<div class="box faucet ${open ? 'open' : ''}" data-faucet="${name}" style="left:${layout().faucetX}px;top:${top}px">${faucetIcon(open)}<span class="label"><span class="name">蛇口${name}</span><span class="sub">${open ? '開いている' : '閉じている'}</span></span></div>`,
    );
    pins.push(pinHtml(stage, { faucet: name }, open));
  });

  // 花だんにいるキャラ（花か、寝に来たおやじか）は予定表の時間ごとに決まっていて、水が来ても変わらない。
  // 変わるのは様子だけ：花は咲く／しおれる、おやじは寝ている／怒る。
  wrap.dataset.time = stage.kind === 'seq' ? 'noon' : currentTime().time;
  stage.outlets.forEach((name, index) => {
    // 順序回路編の出口（パクパク君）はステージで決まっている。組み合わせ回路編は予定表の時間ごと
    const kind = stage.kind === 'seq' ? stage.outputs[name] : currentTime().outputs[name];
    const half = levels ? 2 * levels.outlets[name] : 0;
    const water = reached(half) ? live?.outputs[name] : undefined;
    // 水を流している途中は、水が届いた出口から反応する。結果が出たら全部反応する。
    const reacting =
      judged && water !== undefined && (Boolean(levels) || state.run.kind !== null || Boolean(state.run.beatDone));
    const run = state.run;
    const growth = kind === 'flower' && water && run?.kind === 'ok' ? growthFor(run.growth) : null;
    const wilt = kind === 'flower' && !water && run?.wilt && !state.judging ? run.wilt : null;
    let mood;
    if (kind === 'flower') {
      if (!reacting) mood = 'bud';
      else if (water) mood = growth && growth.level >= 3 ? 'sun' : 'bloom';
      else mood = wilt?.level === 3 ? 'mummy' : 'wilt';
    } else if (kind === 'oyaji') {
      mood = reacting && water ? 'angry' : 'sleep';
    } else {
      // パクパク君：口を開けている拍は水が欲しい。来れば飲み、来なければ悲しむ。閉じている拍に来るとかみつく
      const open = stage.mouth[name][state.beat];
      if (!reacting) mood = open ? 'open' : 'wait';
      else if (open) mood = water ? 'drink' : 'sad';
      else mood = water ? 'bite' : 'wait';
    }
    const wanted = stage.kind === 'seq' ? expectedAt(stage, state.beat)[name] : kind === 'flower';
    const pictures = { flower: flowerIcon, oyaji: oyajiIcon, dog: (m) => dogIcon(state.dogForm, m) };
    const picture = pictures[kind](mood);
    const goals = { flower: '水がほしい', oyaji: '水はきらい', dog: wanted ? '口：あーん' : '口：むっ' };
    const goal = goals[kind];
    const ok = water === wanted;
    let say = '';
    if (reacting && arriving(half)) {
      if (kind === 'flower' && water) say = '<span class="say pop">ポン！</span>';
      if (kind === 'oyaji' && water) say = '<span class="say pop mad">こらっ！</span>';
      if (kind === 'oyaji' && !water) say = '<span class="say pop">ぐー…</span>';
      if (kind === 'dog' && water) say = wanted ? '<span class="say pop">ゴクゴク！</span>' : '<span class="say pop mad">ガブッ！</span>';
      if (kind === 'dog' && !water && wanted) say = '<span class="say pop sad">くぅん…</span>';
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
      `<div class="${classes.join(' ')}" data-outlet="${name}" style="left:${layout().outletX}px;top:${rowTop(index)}px;${grow}">${picture}<span class="label"><span class="name">${outletLabel(stage, name)}</span><span class="sub">${goal}</span></span>${mark}${say}</div>`,
    );
    pins.push(pinHtml(stage, { outlet: name }, Boolean(water)));
  });

  state.board.parts.forEach((part) => {
    const half = levels ? 2 * levels.parts[part.id] : 0;
    const wet = reached(half) && Boolean(live?.gates[part.id]);
    const classes = [
      'box',
      'part',
      wet ? 'on' : '',
      arriving(half) ? 'working' : '',
      problemParts.includes(part.id) ? 'problem' : '',
      part.type === 'DFF' && state.kakon ? 'kakon' : '',
    ];
    // 水を受けた仕掛けは、ひとこと言う（水をたどって見せている間だけ）
    let say = '';
    if (levels && reached(half) && live) {
      const inputs = partInputs(part, live);
      const line = gateLine(part.type, inputs);
      const boom = part.type === 'XOR' && inputs.every(Boolean);
      if (line) say = `<span class="say ${arriving(half) ? 'pop' : ''} ${boom ? 'boom' : ''}">${line}</span>`;
      if (boom && arriving(half)) classes.push('collide');
    }
    boxes.push(
      `<div class="${classes.join(' ')}" data-part="${part.id}" style="left:${part.x}px;top:${part.y}px">${partIcon(part, live)}<span class="label"><span class="name">${part.type}</span><span class="sub">${PART_NAMES[part.type]}</span></span>${say}</div>`,
    );
    pinsOf(part.type).forEach((pin) => pins.push(pinHtml(stage, { part: part.id, pin }, false)));
    pins.push(pinHtml(stage, { part: part.id, pin: 'out' }, wet));
  });

  const paths = wirePaths(stage, state.board);
  const wires = state.board.wires
    .map((wire, i) => {
      const { d } = paths[i];
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
  const L = layoutOf(stage);
  garden.innerHTML = `<svg id="wires" width="${L.width}" height="${L.height}" viewBox="0 0 ${L.width} ${L.height}">${wires}</svg>${boxes.join('')}${pins.join('')}`;
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
  $('#speed').textContent = `速さ：${currentSpeed().label}`;
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

const SECTION_NAMES = { comb: '組み合わせ回路編', seq: '順序回路編（パクパク君）' };

function renderStageList() {
  $('#stage-list').innerHTML = ALL_STAGES.map((stage, i) => {
    const section = i === 0 || ALL_STAGES[i - 1].kind !== stage.kind ? `<li class="section">${SECTION_NAMES[stage.kind]}</li>` : '';
    const progress = state.progress.stages[stage.no];
    const locked = !UNLOCK_ALL_STAGES && i > 0 && !state.progress.stages[ALL_STAGES[i - 1].no]?.cleared;
    const stars = progress?.stars ?? 0;
    const label = `${stage.no}. ${stage.title}`;
    const status = locked ? '（まだ開かない）' : '★'.repeat(stars) + '☆'.repeat(3 - stars);
    return `${section}<li><button data-stage="${i}" ${locked ? 'disabled' : ''}>${label}　${status}</button></li>`;
  }).join('');
}

// ---------- キャラの紹介カード ----------

function characterIcon(key) {
  if (key === 'faucet') return faucetIcon(true);
  if (key === 'fog') return hostIcon();
  if (key === 'dog') return dogIcon('puppy', 'open');
  if (key === 'flower') return flowerIcon('bloom');
  if (key === 'oyaji') return oyajiIcon('sleep');
  if (key === 'clock') return timeIcon('morning');
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
    ? `<table class="water-table"><thead><tr><th>${(character.tableHead ?? ['入口', '出口'])[0]}</th><th></th><th>${(character.tableHead ?? ['入口', '出口'])[1]}</th></tr></thead><tbody>${character.table
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
  const dogs = state.progress.dogs;
  $('#dog-zukan-count').textContent = `${dogs.length} / ${ALL_DOG_FORMS.length}`;
  $('#dog-zukan-list').innerHTML = ALL_DOG_FORMS.map((form) => {
    const found = dogs.includes(form.id);
    return `<li class="${found ? '' : 'unknown'}">${dogIcon(found ? form.id : 'puppy', 'wait')}<span>${found ? form.title : '？？？'}</span></li>`;
  }).join('');
  $('#calm').checked = calm();
  $('#calm').disabled = REDUCED_MOTION;
}

// ---------- ドラッグ・タップ ----------

const readEnd = (el) => JSON.parse(decodeURIComponent(el.dataset.end));

function gardenPoint(event) {
  const rect = garden.getBoundingClientRect();
  const scale = rect.width / layout().width;
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
  drag.scale = garden.getBoundingClientRect().width / layout().width;
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
    else commit(movePart(state.board, drag.id, drag.pos.x, drag.pos.y, layout()));
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
      const L = layout();
      commit(addPart(state.board, drag.type, p.x - L.partWidth / 2, p.y - L.partHeight / 2, L));
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
    const stage = currentStage();
    const name = outletEl.dataset.outlet;
    drag = { kind: 'card', key: stage.kind === 'seq' ? stage.outputs[name] : currentTime().outputs[name] };
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

$('#schedule').addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-time]');
  if (!row || state.judging) return;
  stopReveal();
  showTime(Number(row.dataset.time));
  state.run = null;
  state.marks = null;
  render();
});
$('#schedule-title').addEventListener('click', () => showCard('clock'));

// ---------- ボタン ----------

$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#judge').addEventListener('click', judge);
$('#speed').addEventListener('click', cycleSpeed);
$('#timeline').addEventListener('click', (event) => {
  const cell = event.target.closest('[data-beat]');
  if (cell) showBeat(Number(cell.dataset.beat));
});
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
