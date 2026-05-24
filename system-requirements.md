# System Requirements

## Operating system

Đã test trên:

```text
Windows 10/11
```

CodeGraph hỗ trợ Windows, macOS, Linux.

> [!NOTE]
> `9base-code-intel` hiện có path Windows hardcoded trong docs/config. Trên OS khác cần sửa path.

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
| `C:/Users/Tung Admin/.gemini/antigravity/code_intel_mcp.mjs` | MCP server |
| `C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite` | SQLite DB |
| `C:/Users/Tung Admin/.gemini/antigravity/test_code_intel_mcp.mjs` | test script |
| `C:/Users/Tung Admin/.gemini/antigravity-ide/mcp_config.json` | Antigravity MCP config |
| `C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra` | project path |

## MCP config

Server config:

```json
"9base-code-intel": {
  "command": "node",
  "args": [
    "c:/Users/Tung Admin/.gemini/antigravity/code_intel_mcp.mjs"
  ],
  "env": {
    "CODE_INTEL_ROOT": "c:/Users/Tung Admin/.gemini/antigravity",
    "CODE_INTEL_PROJECT_PATH": "c:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra",
    "CODE_INTEL_DB_PATH": "c:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite",
    "CODE_INTEL_CODEGRAPH_CMD": "npx"
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
