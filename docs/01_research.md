# 01. リサーチ報告：小説・漫画のSNSプロモーション（2026年9月時点）

本書は、個人が Web 上（特に SNS）で小説・漫画を宣伝する際の環境・課題・既存ツール・API/規約状況を整理したものです。ニッチ選定（02）と仕様（03）の根拠になります。

> 調査方法：Web 検索を中心に、各プラットフォームの公式発表・開発者向けドキュメントの要約、クリエイターのエッセイ・相談投稿、ツール比較記事を横断的に確認。一次資料の一部（syosetu.com / kakuyomu.jp / note.com など）は調査環境から直接取得できなかったため、検索スニペットと複数の二次情報で裏取りした。**「要確認」** と記した項目は実装前に一次資料で再確認すること。

---

## 1. 市場・利用環境のスナップショット

### 1.1 主要 SNS の規模（日本）

| SNS | 規模（2026 時点） | クリエイターにとっての位置づけ |
|---|---|---|
| X | 国内 MAU 約 6,700〜6,800 万（2025-05 X Japan 発表ベース） | 依然として最大の宣伝チャネル。ただし外部リンク冷遇・凍結判定の厳格化・AI 学習規約で信頼が低下 |
| Threads | 国内 1,500〜1,735 万規模、世界 MAA 5 億突破（2026-06）。日本は利用時間が前年比 130% 超 | 成長中。返信数・会話の質がアルゴリズムの最重要指標。画像には必ず説明テキストが必要 |
| Bluesky | 世界 4,500 万（2026-06）。公開直後は DL の約 55% が日本 | 「ブルスカ移住」（2025-12 トレンド入り）以降、イラスト・漫画・小説クラスタの受け皿。カスタムフィードで創作系を追える |
| Misskey.io | 52 万ユーザー超（2024-05）。2026-08 に再び急増 | クリエイター寄り（Skeb がスポンサー）。一次創作専用の misskey.design も存在 |
| TikTok / YouTube Shorts | — | 漫画の縦型ショート動画が伸びる。TikTok は日本独自の漫画家支援プログラム「#漫画と出会えるハッシュタグ」を実施 |

### 1.2 起きている構造変化

1. **X の外部リンク冷遇**：リンク付きポストのリーチは 30〜50% 減という観測が多数。「本文に画像＋テキスト、URL はリプ欄」が定石化。
2. **X からの多拠点化**：2024 後半の AI 学習規約、2025-12 の画像編集騒動を機に、創作クラスタが Bluesky / Misskey / Threads を併用。**同じ告知を 2〜4 か所に、文字数・リンク・タグの作法を変えて出す手間**が新たに発生。
3. **X の自動化検知の厳格化（2026）**：ブラウザ自動操作や、短時間の同一リンク連投は一発で BOT 判定・凍結のリスク。複数アカウントでの同一内容拡散も凍結事例あり。
4. **X API の従量課金化（2026-02〜）**：Free / Basic / Pro が廃止され Pay-Per-Use に。**投稿 1 件 $0.015、URL を含む投稿は 1 件 $0.20**（複数の料金解説記事で一致。要確認）。新規開発者には $10 バウチャー。旧 Basic は 2026-06-01、旧 Pro は 2026-09-01 で強制移行。→ 個人開発ツールが X 投稿を「無料で内包」するのは困難。既存の国産ツール（ポストメッシュ）も X だけ月 30 件制限で吸収している。
5. **生成 AI への感度**：小説家になろうは 2026-06-09 から AI 利用区分（直接使用／間接利用／補助的利用／不使用）の申告を義務化。創作クラスタでは AI 生成画像への反発が強い一方、テキスト補助は「使い方次第」。宣伝ツールは **AI 画像を生成しない・AI 文章補助はオプトイン** が安全。

---

## 2. 作品プラットフォーム側の API・規約状況

| プラットフォーム | 公式 API / フィード | 自動化・解析の扱い | 備考 |
|---|---|---|---|
| 小説家になろう | **なろう小説 API**（無料、JSON/YAML、gzip 対応、ncode 指定で作品情報取得）。新着 Atom（api.syosetu.com/allnovel.Atom）、作者マイページ Atom | 規約で「API 以外の自動アクセス・データ収集」を禁止。**API 経由なら可**。IP ごとに 80,000 req/日・400MB/日 の上限（現在は休止中だが復活前提の設計＝キャッシュ必須） | 18 禁系は novel18api。作品に表紙画像の概念がなく、リンクカードは味気ない |
| カクヨム | 公式 API なし。作品ページ・エピソード管理画面に公式 X/Facebook 共有ボタン | 規約で解析（スクレイピング）行為を禁止。運営は API を「前向きに検討」と回答した過去あり | 2025-08 の規約改定は Google/Apple 登録に伴う外部連携ルール明確化 |
| アルファポリス / エブリスタ / ノベルアップ+ / pixiv 小説 | 公式 API なし（要確認） | 一般的に自動取得は規約リスク | pixiv は 2023-04 に X 同時投稿機能を廃止。期間限定で「pixiv 小説画像メーカー」（自作小説からシェア画像生成）を提供した実績＝**シェア画像需要の裏付け** |
| Kindle インディーズマンガ / KDP | API なし。アソシエイト／インフルエンサーリンク | — | 2025 年は毎月 2,000 万円以上を作家に分配。2026 から 6 話目以降の有料販売が本格化。作家自身が SNS で読者を連れてくる前提 |
| Web 漫画（ジャンプルーキー等） | 各社 RSS はまちまち | — | 読者側の更新アンテナ（Web漫画アンテナ、デイコミ）は充実。**作者側の告知支援は空白** |

---

## 3. SNS 側の API・規約状況（投稿用）

| SNS | 認証 | 投稿仕様 | 制限・費用 | 備考 |
|---|---|---|---|---|
| Bluesky（AT Protocol） | OAuth（2024-09 から新規は OAuth 推奨、App Password も可） | 300 書記素、画像 4 枚、動画 60 秒（≤50MB）、リンクカードは **アプリ側で OGP を取得しサムネ blob を自前でアップロード** | 5,000 pt/時（投稿 3 pt）。**無料** | 公式予約投稿なし。TOKIMEKI（2025-12）や MultiPost、GAS ラボ製ツールなどサードパーティが担う。定期投稿 bot は公式に容認。自動いいね・自動リプはオプトイン以外 NG |
| Threads API | Meta OAuth（threads_basic, threads_content_publish 等） | 500 文字、画像・動画・カルーセル | **API 経由は 250 投稿/24h**。無料。開発モードなら自分のアカウントには審査不要、他人に提供するには App Review | アプリ内に公式予約投稿あり（最大 75 日先）。アルゴリズムは返信重視・画像には説明文必須 |
| Misskey | MiAuth / アクセストークン（サーバーごと） | 3,000 文字（io）、複数ファイル、CW、チャンネル | 無料 | Python/JS のクライアントライブラリあり。サーバー選択制 |
| Mastodon | OAuth | 500 文字（既定）、メディア 4 | 無料 | 創作クラスタの一部（pawoo 等） |
| X | OAuth 2.0（Developer Portal） | 280（全角は 2 カウント＝実質 140）、画像 4 | **投稿 $0.015／URL 付き $0.20**（要確認）。前払いクレジット | 代替：Web Intent（`x.com/intent/post?text=...`）は無料・手動ワンクリック。ブラウザ自動化は凍結リスクが最も高い |

---

## 4. 既存ツール・サービスの棚卸し

### 4.1 汎用 SNS 予約投稿ツール（レッドオーシャン）

| ツール | 価格 | 対応 | 所感 |
|---|---|---|---|
| SocialDog | 月 3,000 円台〜 | X 中心 | 国産最大手。企業向け。作品告知の文脈は無い |
| Buffer | 無料 3ch / $6/ch | X, Threads, Bluesky, Mastodon 他 | 新興 SNS 対応が早い。英語 UI |
| ポストメッシュ | 月 2,200 円〜 | X(月30件), Threads, Instagram, TikTok, YouTube, FB | AI エージェント連携。X 制限が従量課金の影響を示す |
| MultiPost | 無料 | X, Threads, Bluesky, Instagram。ツリー投稿予約 | 個人開発。無料で強い。作品・更新の概念は無い |
| Typefully / Hootsuite / Statusbrew | 有料 | 各種 | 海外・企業向け |
| TOKIMEKI（Bluesky クライアント） | 無料 | Bluesky | 予約投稿を 2025-12 に追加 |
| GAS ラボ Bluesky 予約ツール | 有料教材 | Bluesky | スプレッドシート運用 |

→ **「複数 SNS に予約投稿する」だけの機能は既に無料で手に入る。** ここで戦わない。

### 4.2 創作者向けの単機能ツール（点在・手作業前提）

| 領域 | 例 | ギャップ |
|---|---|---|
| 小説の宣伝画像 | 文庫ページメーカー（縦書き抜粋を画像化）、SS 名刺メーカー、段組小説ジェネレータ | 毎回コピペ・手動保存・手動添付。作品情報や話数との連動なし |
| 漫画の画像整形 | BUN≡KATSU（SNS 分割）、Canva 画像分割、save-editor 系 | 分割のみ。1 ページ目の訴求やプラットフォーム別の推奨サイズ、投稿までの一連は手作業 |
| 同人イベント告知 | Canva お品書きテンプレ、Web 用おしながきメーカー、縦長お品書きジェネレーター | お品書き画像は作れるが、「1 か月前・1 週間前・前日・当日・事後」の告知スケジュールは手動 |
| 漫画の動画化 | YOMcoma のかんたん動画作成 β | 自社サービス投稿前提 |
| なろう分析 | なろう分析記録（ブログ）、ランキング分析記事 | 分析結果は読めるが、自分の告知と PV/ブクマの関係を追う道具は無い |

### 4.3 見つからなかったもの（＝空白）

- 「作品を登録すると **更新を検知して、SNS ごとに最適化した告知（文＋画像＋リンク配置）を用意し、無料 API の SNS には自動投稿、X は安全な手動ワンクリック**」という **作家専用の告知オートメーション**。
- 告知の実施記録と、なろう API の日次スナップショット（ポイント・ブクマ）を突き合わせる **効果測定**。
- Bluesky のリンクカード用に **作品固有の画像を自動生成** して添える機能（なろう・カクヨムには表紙が無いため、既存ツールではリンクカードが素っ気ない）。

---

## 5. クリエイターの課題（一次情報からの抽出）

### 5.1 小説（なろう／カクヨム）

- **宣伝の作法が細かい**：#カクヨム タグは「更新日だけ・1 日 1 回・手動」が推奨。タグ乱用は逆効果。1 投稿あたり 10〜20PV 程度の観測。
- **タイミング知識が属人的**：なろうの日間ランキング更新は朝 6:19（火曜 6:49）、昼 12:49/13:19、夜 19:49/20:19 のパターン。読者ピークは 6〜8 時・12〜13 時・20〜23 時。新着一覧が混む 18〜19 時以降を狙うなど、経験則が散在。
- **コンテスト期間は告知が命**：カクヨムコンテスト 11 は応募 2025-12-01〜2026-02-02、読者選考 〜2026-02-09。期間中は継続的な告知が必要。
- **X 経由の発見が書籍化に直結する例**（『近畿地方のある場所について』など）があり、告知を止められない。
- **宣伝疲れ・罪悪感**：「宣伝ばかりで申し訳ない」「毎週同じ文面に飽きる」「書く時間が削られる」。

### 5.2 漫画（Web 連載・同人・Kindle インディーズ）

- **新人は出版社に宣伝してもらえず、自分でやるしかない**（打ち切り経験者の相談、編集からの SNS 宣伝要請への悩み、荒川弘氏の「発信しない選択」が話題になるほど負担が認知されている）。
- **フォーマットの最適化が面倒**：X は画像圧縮があり推奨サイズ・PNG/JPG 設定に気を使う。4 枚投稿・1 ページ目のフック・続きはリプ欄、Threads は縦長＋説明文、TikTok は縦動画。
- **移住後の多重投稿**：X・Bluesky・Misskey・Threads にそれぞれ手で貼る。文字数もタグ文化も違う。
- **イベント告知の定型作業**：お品書き、スペース番号、新刊情報、通販リンク。年に数回だが毎回ゼロから。

### 5.3 共通

- 告知は「作品を完成させた後の余力」で行うため、**5 分かかる作業は後回しになり、結局やらない**。
- 効果が分からないので、続けるモチベーションが保てない。
- 生成 AI の扱いに敏感。AI 画像は NG、AI 文章補助も「使ったことが分かる」と警戒される場合がある。

---

## 6. 調査から導かれる設計上の制約（要点）

1. **X は自動投稿の中核に置かない**：従量課金＋凍結リスク。Web Intent による手動ワンクリック、または利用者自身の API キー（BYOK）で対応。
2. **無料 API の SNS（Bluesky / Misskey / Threads / Mastodon）を自動化の主戦場にする**：ここは合法・無料・成長中。
3. **作品サイトはスクレイピングしない**：なろうはAPI/Atom、カクヨムほかは作者本人の共有操作（Web Share Target / ブックマークレット）で URL を受け取る。
4. **告知は 1 日 1 回・作品ごとにガード**：タグ文化とスパム判定の両方に配慮。
5. **画像は作るが AI では描かない**：本文抜粋の縦書きカード、話数バナー、お品書きなどテンプレート合成に限定。
6. **AI 文章補助はオプトイン・透明性重視**：既定ではテンプレート＋言い回しローテーションで十分。

---

## 参考ソース（検索で確認した主なもの）

### X API・アルゴリズム
- https://sananeblog.com/x-api-pricing/
- https://qiita.com/neru-dev/items/64b0ec92402561e86816
- https://app-tatsujin.com/x-api-pricing-history-2023-2026-2/
- https://www.blotato.com/blog/twitter-api-pricing
- https://docs.x.com/x-api/getting-started/pricing
- https://devcommunity.x.com/t/announcing-the-launch-of-x-api-pay-per-use-pricing/256476
- https://opentweet.io/blog/x-api-cost-2026
- https://hashout.jp/sns/1127/
- https://note.com/nekobunka/n/nc55523a34dcc
- https://hashout.jp/sns/4107/
- https://panda-gy.com/frozen/2026/03/20/
- https://tweetan.net/4770/

### Bluesky / Threads / Misskey
- https://www.watch.impress.co.jp/docs/news/2120504.html
- https://www.userlocal.jp/press/20240216bs/
- https://nekoryman.hatenablog.com/entry/2025/12/24/234702
- https://note.com/aimslab/n/n4dfc51b5e375
- https://navi.1yen.jp/
- https://www.bluefeed.app/genre/creative
- https://www.blotato.com/blog/bluesky-api-pricing
- https://note.com/ichinosetaito/n/n38ae301b2e79
- https://about.fb.com/ja/news/2026/06/meta-launching-new-features-500-million-monthly-threads-users/
- https://addness.co.jp/media/threads-algorithms/
- https://wporz.com/threads-api-regist/
- https://realsound.jp/tech/2024/03/post-1588312.html
- https://indiegamesjp.dev/?p=7419
- https://vrc-ta-hub.com/event/detail/79/
- https://www.comnico.jp/we-love-social/sns-users

### 作品プラットフォーム API・規約
- https://dev.syosetu.com/man/api/
- https://syosetu.com/helpcenter/helppage/helppageid/183
- https://syosetu.com/bbstopic/top/topicid/8777/
- https://blog.syosetu.com/article/view/article_id/395/
- https://karupoimou.hatenablog.com/entry/2019/04/19/175638
- https://kakuyomu.jp/works/16818093084747819186/episodes/16818093084747929505
- https://kakuyomu.jp/info/entry/20250806_tos_update
- https://www.pixiv.net/info.php?id=9470
- https://www.pixiv.net/info.php?id=10383
- https://hon.jp/news/1.0/0/14431
- https://tinetu-soup.com/recommended-manga-posting-sites
- https://note.com/ashizawakamome/n/nd06b9c4e6582

### 既存ツール
- https://suitup.jp/blog/24316/
- https://post-mesh.com/
- https://note.com/ottaka18/n/nd136457e084a
- https://note.com/multipost_fs/n/n1ceaddd46607
- https://atasinti.chu.jp/dad3/archives/85065
- https://www.gas-laboratory.com/courses/bluesky-tree-posts
- https://note.com/akane_etc/n/n06e49a2ff957
- https://sscard.monokakitools.net/bunko.html
- https://amix-design.com/tl/tool-bnkt-sns/
- https://note.com/yomcoma/n/n880b3fb35559
- https://www.canva.com/ja_jp/create/oshinagaki/
- https://keen-yame-5657.jellybean.jp/dojin_tool/

### クリエイターの課題・ノウハウ
- https://kakuyomu.jp/works/4852201425154938510/episodes/1177354054880275399
- https://kakuyomu.jp/works/1177354054881008860/episodes/1177354054881538905
- https://ncode.syosetu.com/n3291ft/
- https://compass-note.hatenablog.com/entry/how-to-win-syosetu-com-ranking
- https://note.com/kind_swift9270/n/n17bd85160d3e
- https://mond.how/topics/h9bdq7hxbfeotko/n14u31v3jh41x1v
- https://kyoko-np.net/2025040101.html
- https://omocoro.jp/bros/kiji/390188/
- https://rizu.blog/x-manbazu/
- https://manga-whomor.com/column/xtwitterillustsize/
- https://newsroom.tiktok.com/ja-jp/hashtag-to-meet-manga
- https://www.kadokawa.co.jp/topics/15170/
