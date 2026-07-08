# GitHub PR Review MCP

プライベートGitHubリポジトリのPull Requestコメントを収集するMCPサーバーです。

## できること

- PRのコメント群を一括収集
  - issueコメント
  - reviewコメント
  - reviewサマリー
- 未返信のreviewコメントを抽出

## 前提

- Node.js 18+
- GitHub Personal Access Token
  - プライベートリポジトリを扱うため `repo` 権限が必要

## セットアップ

```bash
npm install
npm run build
```

`.env` を作成して設定してください（`dotenv` で自動読み込みされます）。

```bash
cp .env.example .env
```

`.env` 例:

```bash
GITHUB_TOKEN=ghp_xxx
TEST_REPOSITORY=owner/repo
TEST_PULL_NUMBER=123
# TEST_INCLUDE_RESOLVED_REPLIES=true
# GITHUB_API_BASE_URL=https://github.example.com/api/v3
```

## 起動

```bash
npm start
```

開発時は以下で直接起動できます。

```bash
npm run dev
```

## 実動作テスト

このブランチ内だけで動作確認を完結する場合は、`.env` の `TEST_REPOSITORY` と `TEST_PULL_NUMBER` を設定したうえで、以下を実行してください。

```bash
npm run test:collect
```

引数で明示指定することもできます。

```bash
npm run test:collect -- owner/repo 123
```

第3引数で `includeResolvedReplies` を指定できます。

```bash
npm run test:collect -- owner/repo 123 false
```

このコマンドはローカルでMCPサーバーを起動し、`collect_pr_feedback` を実行して結果JSONを表示します。

## MCPクライアント設定例

```json
{
  "mcpServers": {
    "github-pr-review": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_tool/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

## 提供ツール

### 1) `collect_pr_feedback`

PRのコメント情報をまとめて取得します。

- 入力
  - `repository`: `owner/repo`
  - `pullNumber`: PR番号
  - `includeResolvedReplies` (任意, default: `true`): 返信コメントを含めるか
- 出力
  - PRメタ情報
  - issueコメント一覧
  - reviewコメント一覧
  - 未返信reviewコメント一覧
  - review一覧

## 運用イメージ

1. `collect_pr_feedback` で現状コメントを収集
2. 未返信コメントや修正要望を整理して、ローカルで修正を進める
3. 修正内容をPRブランチへ修正単位でコミットする
