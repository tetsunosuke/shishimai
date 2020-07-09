# shishimai

某勤怠システム打刻アプリです。ダブルクリックだけで打刻ができるので、必要に応じてPC起動時などに自動実行すると良いと思います。

# 今後の予定

- headless chromeで動かせるように（理想的にはウィンドウ最小化、通知バーだけで処理）
- パスワード変更の自動化
- GitHub Actionsを使ってビルド、リリースファイル周りの作成

## リファクタリング的要素

- sharedObjectを使って変数周りをシンプルにする

# 注意

現時点のバージョンでは設定情報がないときだけ設定を保存できます

# 開発

clone後、npm install してください。

## ファイル構成

- src/main.js: メインプロセスとなるファイルです。electron周りを制御します
- lib/kinrou.js: 具体的な打刻周りの処理等を行います
- html/main.html: レンダラープロセスです。メインプロセスとメッセージをやりとりして表示します
- html/config.html: 設定周りをコントロールします。

## 開発中のelectron起動

```
$ npm run start
```

## デバッグをしたいとき

`debug` という変数で分岐を書くことができます。設定ファイルについてはローカルから読むように変更してあります。

```
$ npm run debug
```

## ビルド

- for mac

```
$ npm run build:mac
```

- for windows

```
$ npm run build:win
```
