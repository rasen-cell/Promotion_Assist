# ロケット設計局（プロトタイプ）

制約に基づいて部品を組み合わせ、飛行計画を入力して打ち上げる、パズル寄りのロケット設計ゲームです。ブラウザだけで動きます（ビルド不要・依存なし）。

```
npm test      # 単体テスト（物理・制約・全ミッションの参考解が成功すること）
npm run e2e   # ブラウザ通しテスト（Playwright + Chromium）
npm run dev   # http://localhost:8081 で起動
```

- 設計資料: [docs/design.md](docs/design.md)
- 構成: `src/parts.js`（部品カタログ）、`src/missions.js`（ミッション）、`src/vehicle.js`（組み立て・制約・性能見積もり）、`src/sim.js`（打ち上げシミュレーション）、`src/planet.js`（大気・軌道計算）、`src/ui-*.js` と `app.js`（画面）
- 進行状況と設計はブラウザの localStorage に保存されます。
