# arXiv crawler

## Reuirements

- Node.js
- clasp (See https://github.com/google/clasp)

## Run

```terminal
$ clasp login  # if needed
$ clasp create --rootDir ./src --type sheets
$ npm i
$ npm run deploy
```

ブラウザでプロジェクトを開き，「ファイル」→「プロジェクトのプロパティ」→「スクリプトのプロパティ」へ行き，
プロパティ名を`SLACK_URL`とし，値にSlackのWebhook URLを入れる．
後は動かすだけ．

## Lint

```terminal
$ npm run lint
$ npm run lint:fix  # fix
```
