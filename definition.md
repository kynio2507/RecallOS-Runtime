# Định nghĩa RecallOS Runtime

## Định nghĩa ngắn

`recallos-runtime` là MCP server local giúp Antigravity hiểu codebase 9Base tốt hơn bằng cách kết hợp CodeGraph và SQLite knowledge memory.

## Vị trí trong hệ thống

```text
Antigravity
  ↓ MCP
recallos-runtime
  ├─ SQLite knowledge DB
  └─ CodeGraph CLI/index
        ↓
  9base-ai-infra source code
```

## Không phải là gì

| Không phải | Lý do |
|---|---|
| Không phải runtime 9Base | Không chạy trong webapp |
| Không phải AECOS | Chỉ dùng để hỗ trợ Antigravity |
| Không phải agent chính | Chỉ là MCP tool |
| Không phải permission system của 9Base | Chỉ nhớ rule/decision liên quan |
| Không phải log platform production | Chỉ có internal events cơ bản |

## Nguyên tắc thiết kế

| Nguyên tắc | Mô tả |
|---|---|
| Local-first | Dữ liệu nằm local trên máy dev |
| External to 9Base | Không nhúng vào runtime 9Base |
| Memory-aware | Có thể nhớ bug/decision/rule |
| CodeGraph-backed | Dùng graph/index để tìm code nhanh |
| MCP-native | Tương tác qua MCP tools |
| Minimal core | Không nhét roadmap/task/log platform vào core |

## Dữ liệu đang lưu

SQLite DB:

```text
/path/to/recallos-runtime/data/recallos_runtime.sqlite
```

Bảng chính:

| Bảng | Vai trò |
|---|---|
| `meta` | version/schema/project path |
| `knowledge_items` | rule, bug, decision, note |
| `symbol_summaries` | summary cho symbol/file |
| `runtime_events` | sự kiện runtime liên quan code |
| `internal_events` | log nội bộ MCP |

## Knowledge seed hiện có

| Loại | Nội dung |
|---|---|
| rule | AECOS không áp dụng vào 9Base runtime |
| rule | Chỉ agent có permission `assistant` trả lời user |
| rule | Admin cấp permission thủ công |
| decision | Memory tách biệt theo `agent_id` |
| decision | Tool permissions là quyền riêng, do Admin cấp thủ công |
| decision | `agtools.required_permission` map permission UI |
| bug | `triggerCompression` từng ghi memory cho tất cả enabled agents |
| bug | API messages từng trả `agent_id` thay vì `agentId` |
| bug | Dashboard từng hiện nhiều chấm working |
| bug | placeholder custom tool cần `encodeURIComponent` |

## Stability level

```text
production-grade local
```

Có nghĩa:

- dùng được hằng ngày trong Antigravity
- đã có test pass đầy đủ
- dùng `better-sqlite3` (stable, thay `node:sqlite` experimental)
- dùng `@modelcontextprotocol/sdk` cho MCP transport
- schema version 2, đã migrate
- CodeGraph gọi qua `npx` (ổn định)

## Định nghĩa cấu trúc knowledge

### Knowledge Item

`Knowledge Item` là đơn vị thông tin chính được lưu trong `knowledge_items`.

```json
{
  "id": "uuid",
  "type": "rule | bug | decision | note | runtime | symbol_summary",
  "title": "Tiêu đề ngắn",
  "content": "Nội dung chính",
  "symbols": ["symbol liên quan"],
  "files": ["path/file.ts"],
  "tags": ["tag"],
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

### Loại knowledge

| Type | Ý nghĩa | Khi dùng |
|---|---|---|
| `rule` | Quy tắc phải tuân thủ | permission, memory scope, architecture guardrail |
| `decision` | Quyết định kiến trúc | khi chọn một hướng và có lý do |
| `bug` | Bug history | khi đã biết root cause/fix |
| `note` | Ghi chú kỹ thuật | insight nhỏ, chưa đủ thành rule |
| `runtime` | Sự kiện runtime liên quan code | lỗi runtime đáng nhớ |
| `symbol_summary` | Summary cho symbol/file | cache hiểu biết về code |
| `architecture` | Bản đồ kiến trúc module | map toàn bộ hệ thống/subsystem |

### Field semantics

| Field | Quy ước |
|---|---|
| `title` | ngắn, searchable, chứa tên bug/rule/decision |
| `content` | mô tả đầy đủ, có root cause/fix nếu là bug |
| `symbols` | tên function/class/table/API liên quan |
| `files` | relative path từ repo root nếu có thể |
| `tags` | area + concern, ví dụ `permission`, `memory`, `api` |

## Định nghĩa cấu trúc log

`recallos-runtime` không phải log platform. Log chỉ phục vụ debug MCP server.

### Internal Event

`Internal Event` là log record trong bảng `internal_events`.

```json
{
  "id": "uuid",
  "level": "info | warn | error",
  "event": "event_name",
  "detail": "short detail <= 500 chars",
  "created_at": "ISO timestamp"
}
```

### Log levels

| Level | Ý nghĩa | Ví dụ |
|---|---|---|
| `info` | hoạt động bình thường | tool called, item saved |
| `warn` | bất thường nhưng chưa fail | unknown tool, missing optional input |
| `error` | lỗi thật | DB error, CodeGraph error |

### Log event naming

Quy ước:

```text
noun_verb hoặc subsystem_event
```

Ví dụ:

| Event | Ý nghĩa |
|---|---|
| `server_start` | server khởi động |
| `schema_init` | tạo schema lần đầu |
| `query` | query tool được gọi |
| `remember` | lưu knowledge |
| `decision` | lưu decision |
| `bug` | lưu bug |
| `codegraph_call` | gọi CodeGraph |
| `codegraph_error` | CodeGraph lỗi |
| `db_error` | SQLite lỗi |

## Định nghĩa boundary

| Boundary | Trong scope | Ngoài scope |
|---|---|---|
| Code Intel | query, remember, bug, decision, status | chạy 9Base app |
| Knowledge DB | local memory, rules, bugs, project facts | production data/secrets |
| Static docs | recallos-runtime design, tools, schema, operations, policy | app-runtime feature docs |
| Logs | MCP debug events | user activity audit |
| CodeGraph | context, symbols, impact | build/test runner |
| MCP | tool interface | UI app |

## Invariants

Các invariant cần giữ:

1. Không ghi gì vào 9Base runtime DB.
2. Không cấp permission trong 9Base.
3. Không thay đổi source code khi chỉ query.
4. Mọi knowledge có thể sống offline trong SQLite.
5. Query phải trả context rõ nguồn: memory hay CodeGraph.
6. Bug/decision quan trọng phải có symbol hoặc file nếu biết.
