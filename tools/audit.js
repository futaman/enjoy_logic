// ステージがパズルとして成り立っているかを総当たりで確かめ、結果を表示する。
//   node tools/audit.js
// 見ること：
//   1. 解けるか（仕掛け箱の仕掛けを全部使って、予定表の全部の時間でうまくいく回路があるか）
//   2. 仕掛け箱の仕掛けが全部要るか（1つ抜く、またはそれまでに出てきた別の仕掛けに替えると解けないか）
import { ALL_STAGES as COMBINATIONAL_STAGES } from '../src/stages.js';
import { describe, expandTray, findSolution, knownGates, shortcuts } from './solver.js';

let failed = 0;
COMBINATIONAL_STAGES.forEach((stage, index) => {
  const solution = findSolution(stage, expandTray(stage.tray));
  const found = solution ? shortcuts(stage, knownGates(COMBINATIONAL_STAGES, index)) : [];
  const ok = solution && found.length === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ステージ${stage.no} ${stage.title}（${stage.times.length}回、仕掛け箱 ${JSON.stringify(stage.tray)}）`);
  if (!solution) console.log('    解けない');
  for (const shortcut of found) console.log(`    ${shortcut.type}を${shortcut.change}と解ける: ${describe(shortcut.solution)}`);
});
console.log(failed ? `\n${failed} ステージに問題があります` : '\n全部のステージで、仕掛け箱の仕掛けが全部要ります');
process.exitCode = failed ? 1 : 0;
