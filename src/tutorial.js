// ステージごとのチュートリアル。手順は上から順に、できたら印が付く。
// done には、今の盤面の様子（faucets、board、cleared）を渡す。
export const TUTORIALS = {
  1: [
    {
      text: '蛇口Aをタップして開けよう。水が流れてくるよ。',
      done: (s) => s.faucets.A,
    },
    {
      text: '蛇口Aの右の丸をタップし、次に花の丸をタップすると水路がつながるよ。',
      done: (s) => s.board.wires.length > 0,
    },
    {
      text: '準備完了（実行）を押して、水やりを確かめよう。',
      done: (s) => s.cleared,
    },
  ],
  2: [
    {
      text: '仕掛け箱から天野君を庭へドラッグして置こう。',
      done: (s) => s.board.parts.some((part) => part.type === 'NOT'),
    },
    {
      text: '蛇口Aを開けたり閉めたりして、おやじと花の変わり方を見てみよう。',
      done: (s) => s.faucets.A,
    },
    {
      text: '蛇口Aと天野君の左の丸、天野君の右の丸と出口の丸をつなごう。',
      done: (s) => s.board.wires.length >= 2,
    },
    {
      text: '準備完了（実行）で確かめよう。',
      done: (s) => s.cleared,
    },
  ],
};
