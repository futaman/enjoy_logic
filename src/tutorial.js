// ステージごとのチュートリアル。手順は上から順に、できたら印が付く。
// done には、今の盤面の様子（beat、faucets、board、cleared）を渡す。
export const TUTORIALS = {
  1: [
    {
      text: '蛇口Aの右の丸から、花の左の丸まで指でなぞって水路を引こう（丸を1つずつタップしてもつながるよ）。',
      done: (s) => s.board.wires.length > 0,
    },
    {
      text: '水が花まで来たら、「準備完了（実行）」を押して水やりしよう。',
      done: (s) => s.cleared,
    },
  ],
  2: [
    {
      text: '出口は全部つなぐのがルール。おやじにも水路をつなごう。でも、水の来る水路をつなぐと…？',
      done: (s) => s.board.wires.length >= 2,
    },
    {
      text: '「準備完了（実行）」で確かめよう。',
      done: (s) => s.cleared,
    },
  ],
  3: [
    {
      text: '仕掛け箱から天野君を庭へドラッグして置こう（タップすると説明が出るよ）。',
      done: (s) => s.board.parts.some((part) => part.type === 'NOT'),
    },
    {
      text: '蛇口A → 天野君の左の丸、天野君の右の丸 → 花、とつなごう。',
      done: (s) => s.board.wires.length >= 2,
    },
    {
      text: '「準備完了（実行）」で確かめよう。',
      done: (s) => s.cleared,
    },
  ],
  15: [
    {
      text: '上のタイムラインを見よう。パクパク君が「あーん」と口を開ける拍と、蛇口Aが開く拍は同じ。マスをタップすると、その拍の庭が見られるよ。',
      done: (s) => s.beat > 0,
    },
    {
      text: '蛇口Aとパクパク君をつないで、「準備完了（実行）」で1拍ずつ確かめよう。',
      done: (s) => s.cleared,
    },
  ],
  18: [
    {
      text: 'ししおどしを置いて、蛇口A → ししおどし → パクパク君、とつなごう。',
      done: (s) => s.board.parts.some((part) => part.type === 'DFF') && s.board.wires.length >= 2,
    },
    {
      text: 'タイムラインのマスを順にタップして、水が1拍おくれて出てくるのを見てみよう。',
      done: (s) => s.beat >= 2,
    },
    {
      text: '「準備完了（実行）」で確かめよう。',
      done: (s) => s.cleared,
    },
  ],
  7: [
    {
      text: '黄色い取っ手の蛇口Bは、タップで開け閉めできるよ。回してみよう。',
      done: (s) => s.faucets.B,
    },
    {
      text: 'カタブツと天野君を置いてつなぎ、どう開ければ注文どおりになるか考えよう。',
      done: (s) => s.board.parts.length >= 2,
    },
    {
      text: '「準備完了（実行）」は、今の蛇口の開け方で確かめるよ。',
      done: (s) => s.cleared,
    },
  ],
};
