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
## Memory Module

RecallOS Runtime includes a 4-layer agent memory module:

| Layer | Storage | Purpose |
|---|---|---|
| Raw Memory | PostgreSQL `memory_events` | Store important raw events |
| Active Memory | PostgreSQL `memory_facts` | Store compressed facts and profiles |
| Context Index | PostgreSQL + pgvector `memory_chunks` | Semantic search over memory chunks |
| Working Memory | In-process runtime state | Track current goal, task, open files, constraints, and pending questions |

Memory tools:

```text
recall_memory_status
recall_memory_write_event
recall_memory_upsert_fact
recall_memory_search
recall_memory_get_profile
recall_memory_summarize_session
recall_memory_link
```

PostgreSQL + pgvector quick start:

```powershell
docker run -d --name recallos-pg -p 5432:5432 -e POSTGRES_USER=recallos -e POSTGRES_PASSWORD=recallos -e POSTGRES_DB=recallos_memory pgvector/pgvector:pg17
```

Embedding uses an OpenAI-compatible endpoint:

```text
RECALLOS_EMBEDDING_ENDPOINT=https://your-router.example/v1/embeddings
RECALLOS_EMBEDDING_MODEL=your-embedding-model
RECALLOS_EMBEDDING_DIM=3072
```

Example event:

```json
{
  "actor": "main_agent",
  "event_type": "observation",
  "content": "RecallOS Memory stores raw events, active facts, vector context, and working memory.",
  "embed": true
}
```

Example fact:

```json
{
  "scope": "project",
  "key": "memory_architecture",
  "value": "4-layer memory: raw events, active facts, vector context, working state",
  "confidence": 1
}
```

## Multi Agent Operations

### Edit provider key

1. Open dashboard `/forgebase9`.
2. Click **Edit** on provider.
3. Paste raw API key or set `api_key_env_var`.
4. Click **Update provider**.
5. Run **Direct model test**.

### Delete provider

Click **Delete** on provider. This removes provider, related model catalog entries, and agent assignments for that provider.

### Verify direct model call

```powershell
npm run build
```

Then in dashboard use **Direct model test**. The request path is dashboard API -> RecallOS registry -> provider `/chat/completions`, not ForgeBase9 MCP.
