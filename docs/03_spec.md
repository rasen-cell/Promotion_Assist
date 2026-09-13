# 03. 仕様書：Promotion Assist（仮）

Web 小説・Web 漫画作家向けの SNS 告知アシスタント。本書は MVP〜v1 の機能仕様・非機能要件・アーキテクチャ・データモデル・外部 API 連携・ロードマップを定義する。

- 版：0.1（企画段階）
- 対象読者：開発者本人（個人開発）、将来の協力者
- 根拠：`01_research.md`（調査）、`02_niche_and_proposal.md`（ニッチ選定）

---

## 1. 目的とスコープ

### 1.1 目的
作家が「作品を更新した」あと、複数 SNS への告知に費やす時間を 10〜15 分から 30 秒に短縮し、告知の質（見た目・タイミング・頻度）を安定させる。

### 1.2 スコープ（MVP）
- 作品：小説家になろう（API）、カクヨム・その他（URL 共有／手入力）
- SNS：Bluesky、Misskey（自動投稿）、X（Web Intent）。Threads は開発モードで検証し、審査通過後に一般提供
- 告知：テンプレート生成、SNS 別変換、宣伝画像生成、即時投稿／予約投稿、1 日 1 回ガード
- 計測：なろう API 日次スナップショット（Pro）

### 1.3 スコープ外
- 作品本文の投稿・同期、スクレイピング、ブラウザ自動操作
- エンゲージメント自動化（自動フォロー・いいね・リプ）
- AI 画像生成
- チーム機能、複数人運用

---

## 2. 用語

| 用語 | 意味 |
|---|---|
| 作品（Work） | 告知対象の連載・単発作品。外部サイトの ID/URL を持つ |
| 更新（Episode） | 作品の新しい話・巻・ページ。更新検知または手動登録で生成 |
| 告知（Announcement） | 1 回の更新に対する告知単位。SNS ごとの派生投稿（Post）を持つ |
| 投稿（Post） | 特定 SNS 向けの本文・添付・リンク配置が確定したもの。状態を持つ |
| 連携（Connection） | 利用者の SNS アカウントとの認可情報 |
| ガード | スパム／規約違反を避けるための自動制約 |

---

## 3. ユーザーストーリー（MVP 優先度順）

| ID | ストーリー | 優先 |
|---|---|---|
| US-01 | 作家として、ncode を入れるだけで作品情報（題名・あらすじ・話数・URL）が登録される | 必須 |
| US-02 | 作家として、なろうで新話を公開したら 15 分以内に告知の下書きが用意されている | 必須 |
| US-03 | 作家として、Bluesky と Misskey に「送る」ボタン 1 回で告知を投稿できる | 必須 |
| US-04 | 作家として、X には X の作法（画像＋本文、URL はリプ）で投稿でき、自分の X アカウントで開いた投稿画面から 1 クリックで送れる | 必須 |
| US-05 | 作家として、冒頭抜粋の縦書きカード画像が自動で付く | 必須 |
| US-06 | 作家として、毎回同じ文面にならないよう言い回しが変わる | 必須 |
| US-07 | 作家として、うっかり 1 日に何度も告知しないよう止めてもらえる | 必須 |
| US-08 | 作家として、カクヨムの話を公開したらスマホの共有メニューからこのアプリに送るだけで下書きができる | 高 |
| US-09 | 作家として、推奨時間帯に予約投稿できる | 高 |
| US-10 | 作家として、告知後にブクマ・ポイントがどう動いたか見える（なろう） | 高（Pro） |
| US-11 | 漫画家として、ページ画像を放り込むと各 SNS 用のセットになる | 中（v1） |
| US-12 | 同人作家として、イベント情報を入れると告知の一連が予約される | 中（v1） |
| US-13 | Kindle 作家として、アソシエイトリンク付きの告知を出せる | 中（v1） |
| US-14 | 作家として、AI に言い回し案を出してもらえるが、使うかは自分で選べる | 低（v1、既定オフ） |

---

## 4. 機能要件

### 4.1 アカウント・認証
- FR-4.1.1 メールのマジックリンク、または Google でログイン（パスワードを持たない）。
- FR-4.1.2 パスキー（WebAuthn）は v1 で追加。
- FR-4.1.3 退会時は連携トークン・作品・投稿履歴を完全削除（30 日猶予の論理削除の後に物理削除）。

### 4.2 SNS 連携（Connection）
| SNS | 方式 | 保存するもの | 備考 |
|---|---|---|---|
| Bluesky | AT Protocol OAuth（推奨）。フォールバックとして App Password | DID、handle、PDS、リフレッシュトークン（暗号化） | 自前 PDS 利用者にも対応（PDS 解決） |
| Misskey | MiAuth（サーバー URL を入力） | サーバー URL、トークン（暗号化）、権限 `write:notes`, `write:drive` | サーバーごとの文字数上限を `meta` API から取得 |
| Threads | Meta OAuth。権限 `threads_basic`, `threads_content_publish`（v1 で `threads_manage_insights`） | 長期トークン（60 日、要更新） | 開発モード中はテスター登録者のみ。App Review 後に一般提供 |
| Mastodon | OAuth（サーバー URL 入力） | トークン（暗号化） | v1 |
| X（Web Intent） | 連携不要 | なし | 本文と画像は利用者がブラウザで確認して送信。画像はクリップボード／ダウンロードで補助 |
| X（BYOK） | 利用者の Developer Portal で発行した OAuth 2.0 クライアント／トークン | クライアント ID・シークレット・トークン（暗号化） | 費用は利用者負担であることを明示。v1 |

- FR-4.2.1 連携は「投稿テスト」（下書きを自分だけに見える形で作る、または削除可能なテスト投稿）で疎通確認できる。
- FR-4.2.2 トークン失効時は投稿を保留にし、メール／アプリ内で再連携を促す。自動リトライは 3 回まで。

### 4.3 作品登録（Work）
- FR-4.3.1 なろう：ncode（例 `n1234ab`）を入力すると、なろう小説 API から `title, story(あらすじ), writer, general_all_no(話数), general_lastup, noveltype, end, keyword, isr15/isbl/isgl, novelupdated_at` を取得して自動入力。18 禁系（ノクターン／ムーンライト／ミッドナイト）は `novel18api` を使用し、告知時に「R18 注意」の任意付記を選べる。
- FR-4.3.2 カクヨム・アルファポリス・エブリスタ・ノベルアップ+・pixiv・Web 漫画各サイト・Kindle：作品 URL と題名・あらすじを手入力。URL 共有（Web Share Target）で受け取った場合は、その 1 ページの OGP（`og:title`, `og:description`, `og:image`）を **1 回だけ取得** して初期値に使う（取得は利用者の操作起点のみ。定期巡回はしない。robots.txt を尊重し失敗時は手入力）。
- FR-4.3.3 作品ごとに設定：ジャンル、既定タグセット、告知テンプレート、投稿先 SNS、推奨時間帯、ガード（1 日の上限）、画像テンプレート、更新検知の有効／無効。
- FR-4.3.4 種別：`novel` / `manga` / `book`（Kindle 等）。種別で既定テンプレートと画像テンプレートが変わる。

### 4.4 更新検知（Episode 生成）
- FR-4.4.1 なろう：ワーカーが 10〜15 分間隔で、有効な作品を ncode 最大 500 件ずつ束ねて API 照会。`general_all_no` の増加、または `general_lastup` の前進を検知したら Episode を生成し告知下書きを作る。1 回の検知で複数話が増えていた場合は「第 N〜M 話」として 1 告知にまとめる。
- FR-4.4.2 なろう Atom（作者マイページ Atom）は補助手段として v1 で検討（要確認：提供状況）。
- FR-4.4.3 その他サイト：作者の共有操作（Web Share Target / ブックマークレット / 手動「更新を登録」ボタン）で Episode を生成。話数・話題名は手入力（前回値＋1 を初期値）。
- FR-4.4.4 誤検知対策：既存話の改稿による `novelupdated_at` 更新は「更新」とみなさない（`general_all_no` と `general_lastup` を主キーにする）。
- FR-4.4.5 検知から下書き生成までのレイテンシ目標：15 分以内（Pro は 10 分間隔、Free は手動または 60 分間隔）。

### 4.5 告知ジェネレーター
#### 4.5.1 テンプレート
- Mustache 風の変数：`{{title}} {{ep_no}} {{ep_title}} {{url}} {{ep_url}} {{site}} {{writer}} {{tags}} {{catch}} {{hook}} {{total_eps}} {{event_name}} {{space}}`
- 種類：`update`（更新）、`new`（新作）、`complete`（完結）、`milestone`（〇話／ブクマ〇件）、`event_*`（イベント）、`book_*`（Kindle）。
- 作品ごとに複数テンプレートを持ち、**ローテーション**（最近使ったものを避ける）＋**言い回しプール**（冒頭句・結び句・絵文字の候補から擬似乱数で選択、ただし同一告知内の SNS 間では統一）。
- `{{hook}}`：更新話の冒頭 1〜2 文（なろうは本文取得不可のため、作者が話ごとに入力する「ひとこと」欄。空なら省略）。

#### 4.5.2 SNS 別変換ルール
| 項目 | X | Bluesky | Threads | Misskey | Mastodon |
|---|---|---|---|---|---|
| 文字数 | 280（全角 2 カウント → 実質 140） | 300 書記素 | 500 | サーバー設定（io は 3,000） | 500（既定） |
| 本文の URL | **入れない**（リプに置く）。既定 ON、作品ごとに変更可 | 本文に置かず、リンクカード（external embed）で表示 | 本文末尾に置く | 本文末尾（サーバー側でプレビュー生成） | 本文末尾 |
| 画像 | 最大 4 | 最大 4（各 ≤1MB、alt 必須） | 1 または カルーセル | 複数 | 4 |
| リンクカード | X 側が自動生成（画像添付時は表示されない） | **自前で** `thumb` を生成・アップロード | Threads 側が自動生成 | 自動 | 自動 |
| タグ | 作品設定の X 用タグセット（既定 2〜3 個） | Bluesky 用（`#創作` 等、facet を付与） | 1 個推奨（Threads はタグ 1 個制限。要確認） | サーバー文化に合わせ任意 | 任意 |
| 切り詰め | あらすじ → 結び句 → 冒頭句の順に削る。URL・話数・題名は削らない | 同左 | 同左 | 不要 | 同左 |
| 改行 | 4 行以内 | 4 行以内 | 自由 | 自由 | 自由 |
| CW/ラベル | なし | R18 は `sexual` 等の self-label を付与可 | なし | R18 は CW 必須（サーバー規約に従う） | CW 可 |

- FR-4.5.3 X のリプ用テキスト（URL＋一言）を同時生成し、Web Intent では「本文を送ったら次にこれを送る」の 2 段階 UI にする。
- FR-4.5.4 生成結果はすべて編集可能。SNS ごとに個別編集した内容は、以後の再生成で上書きしない（`edited` フラグ）。
- FR-4.5.5 文字数カウンタは各 SNS の方式（X の加重、Bluesky の書記素）で表示。

### 4.6 宣伝画像生成
- FR-4.6.1 テンプレート：
  - `vertical_excerpt`：縦書き冒頭カード（本文抜粋 120〜220 字、題名、作者名、話数、サイト名）。
  - `episode_banner`：横書きバナー（題名／第 N 話「話題名」／更新日）。
  - `synopsis_card`：あらすじカード。
  - `oshinagaki`：お品書き（v1）。
  - `manga_first_page`：漫画 1 ページ目に「続きはリプ欄」帯を合成（v1、任意）。
- FR-4.6.2 出力サイズ：1200×630（リンクカード／OGP）、1080×1350（4:5）、1080×1920（縦長）。PNG。
- FR-4.6.3 レンダリングは **ブラウザ内**（HTML/CSS `writing-mode: vertical-rl` → `html-to-image` 系で PNG 化）。サーバーでのヘッドレスブラウザは持たない。予約投稿時は予約確定時点でレンダリングし、オブジェクトストレージに保存。
- FR-4.6.4 フォント：Shippori Mincho / BIZ UDMincho / Noto Sans JP（いずれも OFL）。自前配信（サブセット化）。
- FR-4.6.5 配色・装飾は数種類のプリセット＋作品ごとのアクセントカラー。ロゴやサイト名の表記は各サイトのガイドラインに従う（商標を紛らわしく使わない）。
- FR-4.6.6 本文抜粋は作者が貼り付けた文章のみを使う（サイトから自動取得しない）。
- FR-4.6.7 alt テキストを自動生成（題名・話数・「冒頭抜粋」の旨）し、編集可能。

### 4.7 投稿・予約・推奨時間
- FR-4.7.1 状態遷移：`draft → scheduled → sending → sent | failed | skipped(guard)`。
- FR-4.7.2 予約は利用者のタイムゾーン（既定 Asia/Tokyo）。分単位。
- FR-4.7.3 推奨時間の提示（作品種別・サイト別のヒューリスティック。設定で変更可）：
  - なろう：更新直後、または次の読者ピーク（7:00 / 12:15 / 21:00）に丸める。ランキング更新時刻（朝 6:19〔火曜 6:49〕、昼 12:49 / 13:19、夜 19:49 / 20:19）の直前は避ける提案を出す（要検証）。
  - Threads：1 日 1 投稿を推奨し、既に当日投稿済みなら翌日の同時刻を提案。
  - 効果測定の蓄積後は、作品ごとに反応が良かった時間帯を優先（v1）。
- FR-4.7.4 送信は SNS ごとに独立。ひとつ失敗しても他は送る。失敗は理由付きで表示（文字数超過、トークン失効、レート制限、メディアサイズ）。
- FR-4.7.5 X Web Intent：`https://x.com/intent/post?text=<urlencoded>` を新規タブで開く。画像は Intent で添付できないため、直前に「画像をコピー／保存」ボタンを出し、貼り付け手順を案内する。送信後に利用者が「送った」を押すと `sent` に記録（投稿 URL は任意入力）。
- FR-4.7.6 X BYOK（v1）：`POST /2/tweets` と `media/upload` を利用者のクレジットで実行。URL 付き投稿の追加料金（$0.20/件）を送信前に表示。

### 4.8 ガードレール
- FR-4.8.1 作品×SNS ごとに「1 日 1 回」（既定）。超過時は `skipped(guard)` にし、翌日の推奨時間へ繰り越す提案。
- FR-4.8.2 直近 7 日以内に **同一本文** を同一 SNS に送らない（言い回しローテーションで回避、それでも一致すれば警告）。
- FR-4.8.3 短時間の連続送信を避けるため、複数 SNS への送信は 5〜40 秒のランダム間隔を挟む。
- FR-4.8.4 タグは SNS ごとに上限（X 3 / Bluesky 3 / Threads 1）を既定とし、超過時は警告。
- FR-4.8.5 エンゲージメント操作（いいね・フォロー・リプ）の API は実装しない。
- FR-4.8.6 利用規約に「本人のアカウントから本人の意思で投稿するツールであり、スパム目的の利用を禁止する」旨を明記。

### 4.9 効果測定（Pro、なろう中心）
- FR-4.9.1 日次スナップショット（03:00 JST）：`global_point, weekly_point, monthly_point, fav_novel_cnt, impression_cnt, review_cnt, general_all_no, all_hyoka_cnt`。保持 400 日。
- FR-4.9.2 グラフに告知イベント（SNS 別）をマーカー表示。「告知前後 24h の差分」を簡易表示。因果ではなく相関である旨を UI に明記。
- FR-4.9.3 SNS 側の反応（v1）：Bluesky `getPostThread`（like/repost/reply 数）、Threads Insights、Misskey リアクション数を投稿単位で取得し一覧。
- FR-4.9.4 カクヨム等はスナップショットを取れないため、作者が数値を手入力できる簡易フォーム（任意）。

### 4.10 漫画モード（v1）
- FR-4.10.1 入力：ページ画像（PNG/JPG、順序付き）。ブラウザ内で処理。
- FR-4.10.2 出力セット：
  - X：4 枚ずつのグループ（1〜4p を本文、5p 以降はリプのツリー）。推奨は長辺 ≤ 2048px、PNG は 5MB 以下、写真的な原稿は JPEG 品質 85〜90。
  - Bluesky：4 枚まで（各 ≤1MB に自動再エンコード、alt 付与）。
  - Threads：縦長 1 枚（複数ページを縦結合、幅 1080px）または カルーセル。
  - Misskey：全ページ添付（サーバー上限に従う）。
- FR-4.10.3 1 ページ目オプション：「続きはリプ欄」「全 N ページ」帯の合成。位置・色を選択。
- FR-4.10.4 ページ画像は投稿完了後に既定 7 日で自動削除（保存しない方針を明記）。

### 4.11 イベント告知パック（v1）
- FR-4.11.1 入力：イベント名、日付、会場、スペース番号、頒布物（題名・価格・新刊／既刊・サンプル画像）、通販リンク。
- FR-4.11.2 生成：お品書き画像（縦長 1000×2000 前後と 1200×630）、スペース案内画像、告知下書き 5 本（1 か月前／1 週間前／前日／当日朝／お礼＋通販）。予約は一括登録。
- FR-4.11.3 イベントごとのタグ（例：`#コミティア` `#COMITIA` は公式表記に従う）は作者が選択。

### 4.12 Kindle リンク（v1）
- FR-4.12.1 アソシエイト ID を登録し、ASIN からリンクを生成。無料キャンペーン期間を入力すると「開始／残り 1 日／終了」の告知を予約。
- FR-4.12.2 Amazon のリンク表記ルール（アソシエイトである旨の表示）をテンプレートに含める。

### 4.13 AI 文章補助（v1、既定オフ）
- FR-4.13.1 利用者が明示的に有効化。対象：キャッチコピー案、言い回しバリエーション、あらすじの短縮。
- FR-4.13.2 生成物は必ず編集画面に入り、自動送信しない。生成に使った入力（あらすじ・ひとこと）は学習に使われない API 設定を選ぶ。
- FR-4.13.3 作品本文をモデルに送らない（あらすじと作者入力のみ）。

---

## 5. 画面一覧（MVP）

| 画面 | 主要要素 |
|---|---|
| ダッシュボード | 直近の更新検知、送信待ち告知、今日のガード状況、連携の健全性 |
| 作品一覧／作品詳細 | 作品情報、テンプレート、タグセット、投稿先、更新検知トグル、履歴 |
| 作品登録 | ncode 入力／URL 共有受け口／手入力フォーム |
| 告知エディタ | 左：共通入力（ひとこと・タグ・画像テンプレ）、右：SNS 別プレビュー（文字数・リンク配置・画像）。送る／予約する |
| 画像スタジオ | テンプレ選択、抜粋入力、色、プレビュー、PNG 出力 |
| 予約カレンダー | 週表示、ドラッグで時刻変更、ガード警告 |
| 連携設定 | 各 SNS の接続／テスト／解除 |
| 効果測定（Pro） | ポイント・ブクマ推移＋告知マーカー |
| 設定 | タイムゾーン、通知（メール）、AI 補助の有効化、退会 |

モバイル前提（作家の多くはスマホで更新・告知する）。PWA としてホーム画面追加と Web Share Target を提供。

---

## 6. 非機能要件

| 項目 | 要件 |
|---|---|
| 可用性 | 更新検知ワーカーの停止を 30 分以内に検知しアラート（ヘルスチェック） |
| 性能 | 告知エディタの初期表示 1.5 秒以内（4G）。画像レンダリング 3 秒以内（端末側） |
| セキュリティ | トークンは AES-256-GCM で暗号化（鍵は環境変数／KMS）。OAuth の state/PKCE。CSRF 対策。監査ログ（送信・連携変更） |
| プライバシー | 本文抜粋・ページ画像は投稿後に自動削除（既定 7 日）。第三者提供なし。 |
| 規約順守 | なろう API のレート設計、Bluesky/Threads/Misskey の開発者規約、X 自動化ルール。禁止機能を実装しない |
| 運用コスト | 月 0〜3,000 円（サーバーレス）。ユーザー 1,000 人規模まで構成変更なしで運用 |
| 国際化 | UI は日本語のみ（MVP）。文字コード・書記素の扱いを正しく |
| アクセシビリティ | 生成画像に alt を必ず付与。キーボード操作可 |

---

## 7. アーキテクチャ

### 7.1 構成（推奨）
```
[Browser / PWA]  Next.js (App Router) + TypeScript
   ├─ 画像レンダリング（HTML/CSS → PNG、ブラウザ内）
   ├─ Web Share Target（/share）でカクヨム等の URL を受信
   └─ 各 SNS OAuth のリダイレクト受け口
        │
[Edge/API]  Cloudflare Workers（Hono）または Next.js Route Handlers
   ├─ 認証（Auth.js：メールマジックリンク／Google）
   ├─ 作品・告知・投稿 CRUD
   ├─ SNS アダプタ（bluesky / misskey / threads / mastodon / x-byok / x-intent）
   └─ 暗号化ユーティリティ
        │
[Jobs]  Cloudflare Cron Triggers + Queues
   ├─ narou-poller（10〜15 分）：ncode を束ねて API 照会 → Episode 生成
   ├─ scheduler（1 分）：scheduled → sending → 送信
   ├─ snapshot（日次 03:00 JST）：なろう指標の記録
   └─ token-refresher（日次）：Threads 長期トークン更新、Bluesky リフレッシュ
        │
[Data]  D1（SQLite）または Neon（Postgres）＋ Drizzle ORM
[Object] R2（生成画像・一時ページ画像、ライフサイクルで自動削除）
[Mail]  Resend など（マジックリンク・失敗通知）
[Pay]   Stripe（Pro）
```

代替：Vercel + Neon + Upstash QStash でも同等。Playwright を使わない前提なので Workers で完結できる。

### 7.2 SNS アダプタのインターフェース
```ts
interface SnsAdapter {
  id: 'bluesky' | 'misskey' | 'threads' | 'mastodon' | 'x-byok';
  limits(conn: Connection): Promise<{ maxChars: number; maxImages: number; maxImageBytes: number; countMode: 'grapheme' | 'weighted' | 'codepoint' }>;
  render(announcement: Announcement, work: Work, conn: Connection): PostDraft; // SNS 別変換
  publish(draft: PostDraft, conn: Connection): Promise<{ externalId: string; url?: string }>;
  fetchEngagement?(externalId: string, conn: Connection): Promise<Engagement>;
}
```

### 7.3 ディレクトリ構成（案）
```
apps/web            Next.js（UI・API）
packages/core       ドメインモデル・テンプレートエンジン・ガード
packages/adapters   SNS アダプタ（bluesky, misskey, threads, mastodon, x）
packages/renderers  画像テンプレート（React コンポーネント）
packages/sources    作品ソース（narou-api, share-target, manual）
workers/jobs        Cron / Queue コンシューマ
docs/               本ドキュメント
```

---

## 8. データモデル（主要テーブル）

```
users(id, email, tz, plan, created_at)
connections(id, user_id, provider, handle, server_url, did, secret_enc, expires_at, status)
works(id, user_id, kind[novel|manga|book], source[narou|kakuyomu|alphapolis|everystar|novelup|pixiv|kindle|other],
      external_id, url, title, synopsis, writer, tags_json, settings_json, detect_enabled, last_seen_eps, last_seen_lastup)
episodes(id, work_id, no_from, no_to, title, url, hook_text, detected_at, source[auto|share|manual])
templates(id, user_id, work_id?, kind[update|new|complete|milestone|event_*|book_*], body, weight, last_used_at)
announcements(id, work_id, episode_id?, kind, common_text, image_asset_id?, created_at)
posts(id, announcement_id, connection_id?, provider, body, media_json, link_mode[none|body|reply|card],
      scheduled_at, state, external_id, external_url, error, sent_at, edited)
assets(id, user_id, kind[card|banner|page|oshinagaki], r2_key, width, height, bytes, alt, expires_at)
metrics_snapshots(work_id, date, global_point, weekly_point, monthly_point, fav_cnt, impression_cnt, review_cnt, eps)
engagements(post_id, fetched_at, likes, reposts, replies, views)
events(id, user_id, name, date, venue, space, items_json, links_json)
guard_log(user_id, work_id, provider, date, count)
```

- `secret_enc` は AES-GCM。復号は送信ワーカー内のみ。
- `works.last_seen_eps / last_seen_lastup` が更新検知の比較基準。

---

## 9. 外部 API 連携の詳細

### 9.1 なろう小説 API（更新検知・スナップショット）
- エンドポイント：`https://api.syosetu.com/novelapi/api/`（18 禁は `https://api.syosetu.com/novel18api/api/`）
- 例：`?out=json&gzip=5&ncode=n1234ab-n5678cd-...&of=n-t-s-w-ga-gl-nu-gp-wp-mp-f-imp-r-e-nt`
  - `n` ncode, `t` title, `s` story, `w` writer, `ga` general_all_no, `gl` general_lastup, `nu` novelupdated_at, `gp` global_point, `wp` weekly_point, `mp` monthly_point, `f` fav_novel_cnt, `imp` impression_cnt, `r` review_cnt, `e` end, `nt` noveltype（略号は実装時に公式マニュアルで再確認）
- 1 リクエストあたり `lim` 上限 500。応答の先頭要素は `allcount`。
- レート設計：作品数 N に対し 1 日のリクエスト数 ≒ `ceil(N/500) × (1440/interval)`。N=5,000、interval=10 分でも約 1,440 req/日で上限（80,000）に対し十分な余裕。gzip 必須。応答は 10 分キャッシュ。
- 失敗時：指数バックオフ（最大 1 時間）。連続失敗で検知一時停止＋通知。
- User-Agent にサービス名と連絡先を含める。

### 9.2 Bluesky（AT Protocol）
- 認証：`@atproto/oauth-client-node`（推奨）／App Password（`com.atproto.server.createSession`）。
- 投稿：`com.atproto.repo.createRecord`（collection `app.bsky.feed.post`）。
  - 本文の URL・ハッシュタグは facets（`app.bsky.richtext.facet`）を付与。
  - リンクカード：`app.bsky.embed.external`。`thumb` は `com.atproto.repo.uploadBlob` で **自前生成のカード画像（≤1MB）** をアップロードして指定。`uri/title/description` は作品情報から。
  - 画像：`app.bsky.embed.images`（最大 4、各 ≤1MB、alt 必須）。画像とリンクカードは同時に使えないため、作品設定で「カード優先／画像優先」を選ぶ（既定：小説はカード、漫画は画像）。
- 文字数：300 書記素（`Intl.Segmenter` で計測）。
- レート：5,000 pt/時（create 3 pt）。個人用途では問題にならないが、送信キューで秒間 1 件に抑える。
- ラベル：R18 作品は `com.atproto.label.defs#selfLabels` で `sexual` 等を付与可能。

### 9.3 Threads API
- 認証：Meta の OAuth。長期トークン（60 日）を日次ジョブで更新。
- 投稿：2 段階。`POST /{threads-user-id}/threads`（`media_type=TEXT|IMAGE|CAROUSEL`, `text`, `image_url`, `link_attachment` 等）でコンテナ作成 → `POST /{threads-user-id}/threads_publish`。画像は公開 URL が必要なため、R2 の署名付き／期限付き URL を使う。
- 制限：API 経由の投稿は 24 時間で 250 件（利用者アカウント単位）。本文 500 文字。
- 審査：開発モードでは開発者・テスターのみ。一般提供前に App Review（`threads_basic`, `threads_content_publish`）。プライバシーポリシー URL・デモ動画が必要。

### 9.4 Misskey
- 認証：MiAuth（`/miauth/{session}?name=...&permission=write:notes,write:drive`）。
- 投稿：`POST /api/notes/create`（`text`, `fileIds`, `cw`, `visibility`, `channelId?`）。ファイルは `POST /api/drive/files/create`。
- 文字数上限：`POST /api/meta` の `maxNoteTextLength`。

### 9.5 Mastodon（v1）
- OAuth → `POST /api/v1/statuses`（`status`, `media_ids`, `spoiler_text`）。メディアは `/api/v2/media`。

### 9.6 X
- Web Intent：`https://x.com/intent/post?text={encoded}`。ハッシュタグ・改行は本文に含める。画像は添付不可（案内で補助）。
- BYOK（v1）：OAuth 2.0 PKCE（`tweet.write users.read offline.access`）。`POST /2/tweets`、画像は `POST /2/media/upload`（要確認：2026 時点の v2 メディアアップロード仕様）。送信前に概算費用（$0.015、URL 付き $0.20）を表示。**同一 URL の短時間連投を避ける**ため、X 向けはガードを「12 時間に 1 回」で既定にする。

### 9.7 Web Share Target（カクヨム等）
- `manifest.json` の `share_target` に `/share`（POST, `url`, `title`, `text`）を登録。
- 受信後、ドメインで作品ソースを判定（`kakuyomu.jp/works/{id}/episodes/{eid}` など）。既登録の作品に紐づける。未登録なら作品登録フローへ。
- OGP 取得は 1 回のみ（利用者操作起点）。取得できない場合は手入力。

---

## 10. ジョブ設計

| ジョブ | 頻度 | 処理 | 冪等性 |
|---|---|---|---|
| narou-poller | 10 分（Pro）/ 60 分（Free） | 作品を束ねて照会 → 差分 → Episode/Announcement/Posts（draft）生成 → 通知 | `(work_id, no_to)` で一意 |
| scheduler | 1 分 | `scheduled_at <= now` の posts を `sending` に更新（楽観ロック）→ キュー投入 | 状態遷移で保証 |
| sender | キュー | ガード確認 → 復号 → アダプタ publish → `sent/failed` | 送信前に `external_id` の有無を確認 |
| snapshot | 日次 03:00 JST | なろう指標を記録 | `(work_id, date)` 一意 |
| token-refresher | 日次 | Threads 長期トークン更新、Bluesky セッション更新 | — |
| asset-gc | 日次 | 期限切れアセット削除 | — |

---

## 11. セキュリティ・法務

- OAuth の state/PKCE、リダイレクト URI の固定、トークンの暗号化保管、ログにトークンを出さない。
- 利用規約・プライバシーポリシー・特定商取引法に基づく表記（Pro 提供時）。
- 各 SNS の開発者規約に沿ったアプリ名・説明。X の Automation Rules、Bluesky の Community Guidelines、Meta Platform Terms を README で参照。
- 生成画像に使う本文抜粋は作者本人の著作物である前提。第三者の作品を登録しない旨を規約に明記。
- 未成年利用者を想定し、R18 作品の告知は年齢確認済みの SNS 側ラベル機能に委ねる。

---

## 12. ロードマップ

| フェーズ | 期間目安 | 内容 | 完了条件 |
|---|---|---|---|
| P0 検証 | 2 週 | ヒアリング 10 名、LP＋ウェイトリスト、1 画面プロトタイプ（ncode → Bluesky 告知＋縦書きカード） | 10 名中 6 名以上が「使いたい」、ウェイトリスト 50 件 |
| P1 MVP | 6〜8 週 | 認証、なろう作品登録、更新検知、テンプレ生成、SNS 別変換、縦書きカード、Bluesky/Misskey 送信、X Intent、ガード、予約 | 自分＋協力者 5 名で 2 週間運用し、送信成功率 98% 以上 |
| P2 | 4〜6 週 | Threads（審査申請）、推奨時間、効果測定スナップショット、Web Share Target（カクヨム等）、Stripe/Pro | Pro 課金 10 件 |
| P3 | 6〜8 週 | 漫画モード、イベント告知パック、Kindle リンク、Mastodon、X BYOK | 漫画作家 20 名の利用 |
| P4 | 以降 | AI 補助（オプトイン）、SNS 反応取得、時間帯最適化、ショート動画（検討） | — |

---

## 13. 未確定事項・要確認リスト

| # | 項目 | 確認先 |
|---|---|---|
| 1 | なろう小説 API の `of` 略号一覧・現在のレート制限・User-Agent 要件 | dev.syosetu.com マニュアル |
| 2 | なろう「アプリ・Web サイト開発の注意点」ページの最新条件（表示義務・リンク規定） | syosetu.com ヘルプ 183 |
| 3 | 作者マイページ Atom の提供状況 | なろう公式ブログ／ヘルプ |
| 4 | カクヨムの規約における「利用者本人の共有操作からの OGP 取得」の可否 | kakuyomu.jp/legal/tos、必要なら問い合わせ |
| 5 | X API Pay-Per-Use の正式単価（投稿／URL 付き／メディア）と最低チャージ | docs.x.com pricing |
| 6 | X v2 メディアアップロードの現行仕様 | docs.x.com |
| 7 | Threads のタグ制限（1 投稿 1 タグ）と `link_attachment` の仕様 | developers.facebook.com/docs/threads |
| 8 | Bluesky OAuth のクライアントメタデータ要件（公開 URL 必須）、App Password の今後 | docs.bsky.app |
| 9 | Misskey サーバーごとの bot 表記ルール（`isBot` フラグの扱い） | 各サーバー規約 |
| 10 | フォントライセンス（OFL）の再配布・サブセット条件 | 各フォント LICENSE |
| 11 | Amazon アソシエイトのリンク表記・SNS 投稿ルール | アソシエイト規約 |

---

## 付録 A：テンプレート例

```
[update / 共通]
{{opening}}『{{title}}』第{{ep_no}}話「{{ep_title}}」を公開しました。
{{hook}}
{{closing}} {{tags}}

opening 候補: 「更新しました。」「今週分です。」「お待たせしました。」「新しい話ができました。」
closing 候補: 「続きはこちらから。」「読んでいただけたら嬉しいです。」「感想・ブクマ励みになります。」「今夜のお供にどうぞ。」
```

X 向け（URL なし、140 字以内）
```
更新しました。『{{title}}』第{{ep_no}}話「{{ep_title}}」
{{hook}}
続きはリプ欄から。 #narou #創作
```
X リプ用
```
第{{ep_no}}話はこちら → {{ep_url}}
```
Bluesky 向け（300 書記素、リンクカード）
```
更新しました。『{{title}}』第{{ep_no}}話「{{ep_title}}」
{{hook}}
感想・ブクマ励みになります。 #創作 #Web小説
（external embed: ep_url / thumb = 縦書きカード）
```

## 付録 B：タグセット初期値（利用者が編集）

| 用途 | X | Bluesky | Threads |
|---|---|---|---|
| なろう更新 | `#narou` `#小説家になろう` | `#創作` `#Web小説` | `#小説家になろう` |
| カクヨム更新 | `#カクヨム` | `#創作` `#Web小説` | `#カクヨム` |
| 漫画公開 | `#創作漫画` `#漫画が読めるハッシュタグ` | `#創作漫画` | `#漫画` |
| 同人イベント | イベント公式タグ | 同左 | 同左 |

## 付録 C：推奨時間帯の初期値（なろう、要検証）

| 窓 | 時刻 | 根拠 |
|---|---|---|
| 朝 | 7:00〜7:30 | 通勤通学前の読者ピーク。朝のランキング更新（6:19／火曜 6:49）後 |
| 昼 | 12:15〜12:40 | 昼休み。昼の更新（12:49／13:19）前に告知が乗る |
| 夜 | 20:30〜22:00 | 最大ピーク。夜の更新（19:49／20:19）後 |
