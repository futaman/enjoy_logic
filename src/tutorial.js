// ステージごとのチュートリアル。手順は上から順に、できたら印が付く。
// done には、今の盤面の様子（board、cleared、timesSeen：見た予定表の時間、beat：順序回路編で見ている拍）を渡す。
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
      text: '花だんは全部つなぐのがルール。おやじの寝ている花だんにも水路をつなごう。でも、水の来る水路をつなぐと…？',
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
  5: [
    {
      text: '上の予定表を見よう。朝と夜の2回、水を流すよ。予定表の「夜」をタップして、夜の庭も見てみよう。',
      done: (s) => s.timesSeen.length >= 2,
    },
    {
      text: '朝と夜で、蛇口とおやじのいる花だんが入れかわる。水路は1つだけ。どちらの時間もうまくいくようにつなごう。',
      done: (s) => s.board.wires.length >= 3,
    },
    {
      text: '「準備完了（実行）」で、朝 → 夜の順に水を流して確かめよう。',
      done: (s) => s.cleared,
    },
  ],
  13: [
    {
      text: '上のタイムラインを見よう。パクパク君が「あーん」と口を開ける拍と、蛇口Aが開く拍は同じ。マスをタップすると、その拍の庭が見られるよ。',
      done: (s) => s.beat > 0,
    },
    {
      text: '蛇口Aとパクパク君をつないで、「準備完了（実行）」で1拍ずつ確かめよう。',
      done: (s) => s.cleared,
    },
  ],
  16: [
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
};
