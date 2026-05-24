# System Requirements

## Operating system

Đã test trên:

```text
Windows 10/11
```

CodeGraph hỗ trợ Windows, macOS, Linux.

> [!NOTE]
> `recallos-runtime` hiện có path Windows hardcoded trong docs/config. Trên OS khác cần sửa path.

## Required software

| Requirement | Version/Status | Ghi chú |
|---|---|---|
| Node.js | v22+ (current LTS/modern) | chạy MCP server |
| npm/npx | required | dependency + gọi CodeGraph CLI |
| `better-sqlite3` | required | SQLite driver ổn định, thay `node:sqlite` |
| `@modelcontextprotocol/sdk` | required | MCP protocol transport SDK |
| `@colbymchenry/codegraph` | required | gọi qua `npx -y` |
| Antigravity | required | MCP client |
| PowerShell | required hiện tại | test/vận hành trên Windows |

## Required paths

| Path | Purpose |
|---|---|
| `/path/to/recallos-runtime/src/recallos_runtime_mcp.mjs` | MCP server |
| `/path/to/recallos-runtime/data/recallos_runtime.sqlite` | SQLite DB |
| `/path/to/recallos-runtime/test/test_recallos_runtime_mcp.mjs` | test script |
| `/path/to/antigravity-ide/mcp_config.json` | Antigravity MCP config |
| `/path/to/project` | project path |

## MCP config

Server config:

```json
"recallos-runtime": {
  "command": "node",
  "args": [
    "/path/to/recallos-runtime/src/recallos_runtime_mcp.mjs"
  ],
  "env": {
    "RECALLOS_ROOT": "/path/to/recallos-runtime",
    "RECALLOS_PROJECT_PATH": "/path/to/project",
    "RECALLOS_DB_PATH": "/path/to/recallos-runtime/data/recallos_runtime.sqlite",
    "RECALLOS_CODEGRAPH_CMD": "npx"
  }
}
```

## CodeGraph index requirement

Repo phải được init/index:

```powershell
npx -y @colbymchenry/codegraph init -i .
```

Kiểm tra:

```powershell
npx -y @colbymchenry/codegraph status .
```

Kỳ vọng:

```text
[OK] Index is up to date
Files: 46, Nodes: 312
```

## Network requirement

Lần đầu chạy `npx -y @colbymchenry/codegraph` cần Internet để download package.
Sau đó cache npm local, không cần Internet.

## Security notes

| Note | Meaning |
|---|---|
| Local-only | DB nằm local, không gửi data ra ngoài |
| No 9Base runtime changes | tool chạy ngoài app, không sửa runtime DB |
| Command execution | gọi `cmd.exe /c npx ...` cho CodeGraph |
| No auto permission grant | không cấp quyền 9Base tự động |
| Admin controls MCP config | user/admin quyết định bật server |
## CLI Help

RecallOS Runtime includes a CLI entrypoint:

```powershell
npm run help
node ./src/cli/recall.mjs --help
node ./src/cli/recall.mjs codegraph --help
node ./src/cli/recall.mjs kb --help
```

After linking/installing globally:

```powershell
recall --help
recall modules
recall codegraph --help
recall kb --help
recall mcp
```
