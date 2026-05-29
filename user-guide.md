# User Guide

## Ai nên dùng tài liệu này?

Người dùng cơ bản muốn dùng `recallos-runtime` trong Antigravity để hỏi về codebase 9Base.

## Dùng khi nào?

Dùng tool này khi cần:

- hỏi vì sao bug từng xảy ra
- tìm file/symbol liên quan
- kiểm tra decision kiến trúc
- hỏi impact trước khi sửa code
- nhớ rule permission/memory/tool system

## Không dùng khi nào?

Không nên dùng cho:

- chạy app 9Base
- cấp permission trong 9Base
- thay thế test suite
- ingest log lớn
- roadmap/task management

## Tool quan trọng nhất

### `recall_kb_query`

Dùng cho hầu hết câu hỏi.

Ví dụ 1: bug memory

```json
{
  "question": "memory từng bị ghi chung vì sao và sửa ở đâu?",
  "symbols": ["triggerCompression"],
  "mode": "debug",
  "includeContext": false,
  "includeImpact": false
}
```

Kỳ vọng trả:

- bug history
- root cause
- file liên quan
- symbol liên quan

Ví dụ 2: permission

```json
{
  "question": "tool permission do ai cấp và rule liên quan là gì?",
  "symbols": ["standardPermissions"],
  "mode": "architecture",
  "includeContext": false,
  "includeImpact": false
}
```

Kỳ vọng trả:

- Admin cấp permission thủ công
- không cấp đồng loạt
- liên quan `standardPermissions`

Ví dụ 3: hỏi code context

```json
{
  "question": "handleMessage xử lý chat routing như thế nào?",
  "symbols": ["handleMessage"],
  "mode": "architecture",
  "includeContext": true,
  "includeImpact": false
}
```

## Lưu knowledge mới

### Lưu rule

```json
{
  "type": "rule",
  "title": "Tên rule",
  "content": "Nội dung rule",
  "symbols": ["symbol liên quan"],
  "files": ["path/file.ts"],
  "tags": ["rule", "area"]
}
```

### Lưu bug

Dùng `recall_kb_bug`:

```json
{
  "title": "Tên bug",
  "rootCause": "Nguyên nhân",
  "fix": "Cách sửa",
  "symbols": ["symbol"],
  "files": ["file"]
}
```

### Lưu decision

Dùng `recall_kb_decision`:

```json
{
  "title": "Tên decision",
  "decision": "Quyết định",
  "reason": "Lý do",
  "symbols": ["symbol"],
  "files": ["file"]
}
```

## Kiểm tra tool còn sống không

Gọi:

```text
recall_kb_status
```

Kết quả tốt:

- server `recallos-runtime 1.0.0-local`
- schema version `2`
- SQLite driver `better-sqlite3`
- CodeGraph index OK
- knowledge_items > 0

## Best practices

| Nên làm | Lý do |
|---|---|
| Gửi symbol cụ thể nếu biết | tăng độ chính xác |
| Dùng `mode: debug` cho bug | ưu tiên bug history |
| Dùng `includeContext: false` nếu chỉ cần memory | nhanh hơn |
| Lưu bug sau khi sửa | tránh lặp lỗi |
| Lưu decision khi đổi kiến trúc | agent sau hiểu lý do |

## Câu hỏi mẫu

```text
vì sao 9Base chỉ cho assistant trả lời user?
```

```text
memory phải tách theo agent_id vì sao?
```

```text
knowledge item bị stale thì xử lý thế nào?
```

```text
sửa handleMessage ảnh hưởng gì?
```

```text
permission rule được lưu ở đâu?
```
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

## Multi Agent Dashboard

Open `/forgebase9` from the sidebar label **Multi Agent**.

Use it to:

- add provider endpoint
- edit provider and re-enter API key
- delete provider
- add model IDs
- assign model per agent role
- test model directly through RecallOS

If direct model test says raw key is missing, click **Edit** on the provider, paste API key, then **Update provider**.
