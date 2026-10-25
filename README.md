# 論理回路まなびゲーム

中学生が、ミニゲームを遊ぶうちに「1と0」「論理ゲート」「組み合わせ回路」「順序回路」を理解できるようにするゲームです。
1は水が流れている、0は水がない、に例えます。

## 仕様

- 仕様書は Claude Docs にあります（ユーザー体験・操作性の2つに分けています）。
  - 仕様書：https://claude.ai/artifact/VDcrhkTJNjbqCRtpBfMGcE
  - 操作性仕様書：https://claude.ai/artifact/DFN5ifVBnQG4MT9XAdqHM4

## 進み具合

- [x] 回路の評価と正解判定（`src/logic.js`）
- [x] 組み合わせ回路編 ステージ1〜8の定義（`src/stages.js`）
- [ ] 画面（水路・仕掛けの配置、ドラッグ操作、予定表）
- [ ] 順序回路編

## 開発

依存パッケージはありません（Node.js 18 以上）。

```sh
npm test
```
