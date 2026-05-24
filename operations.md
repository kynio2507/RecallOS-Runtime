# Operations

## Cài đặt lần đầu

### 1. Clone / mở package

Package `9base-code-intel` hiện là project độc lập tại:

```text
C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel
```

### 2. Cài dependency

Trong thư mục package:

```powershell
cd "C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel"
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
C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel/src/code_intel_mcp.mjs
```

Chạy thủ công nếu cần:

```powershell
node "C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel/src/code_intel_mcp.mjs"
```

Hoặc dùng npm script:

```powershell
npm run start
```

### 4. Đăng ký MCP server trong Antigravity

Thêm/cập nhật trong `mcp_config.json`:

```json
{
  "9base-code-intel": {
    "command": "node",
    "args": [
      "c:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel/src/code_intel_mcp.mjs"
    ],
    "env": {
      "CODE_INTEL_ROOT": "c:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel",
      "CODE_INTEL_PROJECT_PATH": "c:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra",
      "CODE_INTEL_DB_PATH": "c:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite",
      "CODE_INTEL_CODEGRAPH_CMD": "npx"
    }
  }
}
```

Env vars:

| Var | Ý nghĩa |
|---|---|
| `CODE_INTEL_ROOT` | thư mục package `9base-code-intel` |
| `CODE_INTEL_PROJECT_PATH` | repo cần index bằng CodeGraph |
| `CODE_INTEL_DB_PATH` | SQLite DB path |
| `CODE_INTEL_CODEGRAPH_CMD` | command gọi CodeGraph, mặc định `npx` |

> [!IMPORTANT]
> `code_intel.sqlite` chứa local knowledge/memory. Không commit DB vào Git.
> Repo đã có `.gitignore` chặn `*.sqlite`, `*.db`, `node_modules`, và env files.

### 5. Khởi tạo CodeGraph index

Chạy trong thư mục repo cần index:

```powershell
cd "C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra"
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
C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite
```

Không cần tạo thủ công. Schema version hiện tại: **2**.

---

## Test

### Test bằng npm script

```powershell
cd "C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel"
npm test
```

Kết quả đúng:

```text
PASS 9base-code-intel MCP tests
```

Script test lần lượt:

1. `code_intel_status` — kiểm tra DB, version, CodeGraph
2. `code_intel_query` — query hybrid knowledge
3. `code_intel_remember` — lưu và đọc lại note
4. `code_intel_decision` — lưu architecture decision
5. `code_intel_bug` — lưu bug/root cause/fix

### Test nhanh trong Antigravity

Gọi tool:

```text
code_intel_status
```

Kỳ vọng:

```text
Server: 9base-code-intel 1.0.0-local
MCP transport: SDK stdio
SQLite driver: better-sqlite3
CodeGraph [OK]
```

---

## Cập nhật CodeGraph index

Khi source code 9Base thay đổi nhiều, cần re-index:

```powershell
cd "C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra"
npx -y @colbymchenry/codegraph init -i .
```

---

## Xem DB trực tiếp

### Dùng Node.js

```powershell
node -e "const db=require('better-sqlite3')('C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite'); console.log(db.prepare('SELECT * FROM meta').all()); db.close()"
```

Xem knowledge items:

```powershell
node -e "const db=require('better-sqlite3')('C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite'); db.prepare('SELECT id,type,title,created_at FROM knowledge_items ORDER BY created_at DESC LIMIT 20').all().forEach(r=>console.log(r)); db.close()"
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
Copy-Item "C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite" `
          "C:/Users/Tung Admin/.gemini/antigravity/code_intel.sqlite.bak"
```

DB chỉ chứa knowledge/memory local, không chứa source code 9Base. Không commit DB vào Git.

---

## Git private repo

Khởi tạo repo local:

```powershell
cd "C:/Users/Tung Admin/.gemini/antigravity/scratch/9base-ai-infra/9base-code-intel"
git init
git add .
git commit -m "Initial commit for 9base-code-intel package"
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
| `code_intel_status` không trả | Kiểm tra MCP config, restart Antigravity |
| `CodeGraph: ERROR` | Chạy lại `codegraph init` trong repo |
| `knowledge_items = 0` | Kiểm tra `CODE_INTEL_DB_PATH` |
| CodeGraph chậm lần đầu | `npx` cần download, cần Internet |
| Test script fail | Xem log lỗi cụ thể, kiểm tra DB path |
| `spawnSync npx.cmd EINVAL` | Lỗi CodeGraph trên Windows, thường xảy ra khi path chứa space |
