# Operations

## Cài đặt lần đầu

### 1. Clone / mở package

Package `recallos-runtime` hiện là project độc lập tại:

```text
/path/to/recallos-runtime
```

### 2. Cài dependency

Trong thư mục package:

```powershell
cd "/path/to/recallos-runtime"
npm install
```

Dependency chính:

```text
better-sqlite3
@modelcontextprotocol/sdk
zod
```

### 3. MCP server file

File server chính nằm ở:

```text
/path/to/recallos-runtime/src/recallos_runtime_mcp.mjs
```

Chạy thủ công nếu cần:

```powershell
node "/path/to/recallos-runtime/src/recallos_runtime_mcp.mjs"
```

Hoặc dùng npm script:

```powershell
npm run start
```

### 4. Đăng ký MCP server trong Antigravity

Thêm/cập nhật trong `mcp_config.json`:

```json
{
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
}
```

Env vars:

| Var | Ý nghĩa |
|---|---|
| `RECALLOS_ROOT` | thư mục package `recallos-runtime` |
| `RECALLOS_PROJECT_PATH` | repo cần index bằng CodeGraph |
| `RECALLOS_DB_PATH` | SQLite DB path |
| `RECALLOS_CODEGRAPH_CMD` | command gọi CodeGraph, mặc định `npx` |

> [!IMPORTANT]
> `recallos_runtime.sqlite` chứa local knowledge/memory. Không commit DB vào Git.
> Repo đã có `.gitignore` chặn `*.sqlite`, `*.db`, `node_modules`, và env files.

### 5. Khởi tạo CodeGraph index

Chạy trong thư mục repo cần index:

```powershell
cd "/path/to/project"
npx -y @colbymchenry/codegraph init -i .
```

Kiểm tra sau khi init:

```powershell
npx -y @colbymchenry/codegraph status .
```

Kết quả đúng:

```text
[OK] Index is up to date
```

### 6. SQLite DB

DB hiện dùng ngoài Git tại:

```text
/path/to/recallos-runtime/data/recallos_runtime.sqlite
```

Không cần tạo thủ công. Schema version hiện tại: **2**.

---

## Test

### Test bằng npm script

```powershell
cd "/path/to/recallos-runtime"
npm test
```

Kết quả đúng:

```text
PASS RecallOS Runtime MCP tests
```

Script test lần lượt:

1. `recall_kb_status` — kiểm tra DB, version, CodeGraph
2. `recall_kb_query` — query hybrid knowledge
3. `recall_kb_remember` — lưu và đọc lại note
4. `recall_kb_decision` — lưu architecture decision
5. `recall_kb_bug` — lưu bug/root cause/fix

### Test nhanh trong Antigravity

Gọi tool:

```text
recall_kb_status
```

Kỳ vọng:

```text
Server: recallos-runtime 1.0.0-local
MCP transport: SDK stdio
SQLite driver: better-sqlite3
CodeGraph [OK]
```

---

## Cập nhật CodeGraph index

Khi source code 9Base thay đổi nhiều, cần re-index:

```powershell
cd "/path/to/project"
npx -y @colbymchenry/codegraph init -i .
```

---

## Xem DB trực tiếp

### Dùng Node.js

```powershell
node -e "const db=require('better-sqlite3')('/path/to/recallos-runtime/data/recallos_runtime.sqlite'); console.log(db.prepare('SELECT * FROM meta').all()); db.close()"
```

Xem knowledge items:

```powershell
node -e "const db=require('better-sqlite3')('/path/to/recallos-runtime/data/recallos_runtime.sqlite'); db.prepare('SELECT id,type,title,created_at FROM knowledge_items ORDER BY created_at DESC LIMIT 20').all().forEach(r=>console.log(r)); db.close()"
```

---

## Restart MCP server

Antigravity quản lý vòng đời MCP server. Nếu tool không phản hồi:

1. Reload Antigravity / restart conversation
2. Server tự restart khi Antigravity gọi tool lần tiếp theo
3. Không cần tắt/bật thủ công

---

## Backup DB

```powershell
Copy-Item "/path/to/recallos-runtime/data/recallos_runtime.sqlite" `
          "/path/to/recallos-runtime/data/recallos_runtime.sqlite.bak"
```

DB chỉ chứa knowledge/memory local, không chứa source code 9Base. Không commit DB vào Git.

---

## Git private repo

Khởi tạo repo local:

```powershell
cd "/path/to/recallos-runtime"
git init
git add .
git commit -m "Initial commit for recallos-runtime package"
```

Khi tạo private repo trên GitHub, thêm remote:

```powershell
git remote add origin https://github.com/<username>/<repo>.git
git branch -M main
git push -u origin main
```

---

## Troubleshooting nhanh

| Triệu chứng | Kiểm tra |
|---|---|
| `recall_kb_status` không trả | Kiểm tra MCP config, restart Antigravity |
| `CodeGraph: ERROR` | Chạy lại `codegraph init` trong repo |
| `knowledge_items = 0` | Kiểm tra `RECALLOS_DB_PATH` |
| CodeGraph chậm lần đầu | `npx` cần download, cần Internet |
| Test script fail | Xem log lỗi cụ thể, kiểm tra DB path |
| `spawnSync npx.cmd EINVAL` | Lỗi CodeGraph trên Windows, thường xảy ra khi path chứa space |
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
