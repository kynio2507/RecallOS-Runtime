# Logs & Issues

## Cấu trúc Log

`9base-code-intel` có hai loại log:

### 1. Internal Events (SQLite)

Bảng `internal_events` trong `code_intel.sqlite` ghi lại các sự kiện nội bộ MCP:

| Column | Type | Ý nghĩa |
|---|---|---|
| `id` | TEXT (UUID) | Unique ID |
| `level` | TEXT | `info` / `warn` / `error` |
| `event` | TEXT | Tên sự kiện |
| `detail` | TEXT | Chi tiết rút gọn (truncated ≤ 500 chars) |
| `created_at` | TEXT | ISO 8601 timestamp |

#### Các event thường gặp

| Event | Level | Ý nghĩa |
|---|---|---|
| `server_start` | info | MCP server khởi động |
| `schema_init` | info | DB schema được tạo lần đầu |
| `schema_migrate` | info | DB schema migration chạy |
| `query` | info | `code_intel_query` được gọi |
| `remember` | info | `code_intel_remember` lưu item |
| `decision` | info | `code_intel_decision` lưu decision |
| `bug` | info | `code_intel_bug` lưu bug |
| `codegraph_call` | info | CodeGraph CLI được gọi |
| `codegraph_error` | error | CodeGraph CLI lỗi |
| `db_error` | error | Lỗi SQLite |
| `unknown_tool` | warn | Tool name không khớp |

#### Truy vấn log

```sql
-- 30 event gần nhất
SELECT level, event, detail, created_at
FROM internal_events
ORDER BY created_at DESC
LIMIT 30;

-- Chỉ xem error
SELECT * FROM internal_events
WHERE level = 'error'
ORDER BY created_at DESC;

-- Đếm theo event type
SELECT event, COUNT(*) as count
FROM internal_events
GROUP BY event
ORDER BY count DESC;
```

### 2. Stderr (Runtime)

MCP server in ra `stderr` khi có lỗi nghiêm trọng không thể lưu vào DB:

```text
[9base-code-intel] FATAL: cannot open DB ...
[9base-code-intel] WARN: CodeGraph not available
```

Antigravity thường không hiển thị stderr trực tiếp.
Xem bằng cách chạy server thủ công:

```powershell
node "C:/Users/Tung Admin/.gemini/antigravity/code_intel_mcp.mjs" 2>&1
```

---

## Known Issues

### KI-001: `node:sqlite` ExperimentalWarning

**Loại:** Historical issue — đã xử lý.

**Triệu chứng cũ:**

```text
ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

**Nguyên nhân:** Phiên bản cũ dùng `node:sqlite` built-in.

**Fix:** Đã migrate sang `better-sqlite3`.

**Trạng thái:** ✅ Đã sửa trong `1.0.0-local`.

---

### KI-002: CodeGraph gọi qua `npx` — chậm lần đầu

**Triệu chứng:** Lần đầu gọi `code_intel_query` với CodeGraph, phản hồi chậm 5–30s.

**Nguyên nhân:** `npx -y @colbymchenry/codegraph` cần download package nếu không có cache.

**Impact:** UX chậm lần đầu, sau đó bình thường.

**Fix plan:** Bundle hoặc pre-install CodeGraph. Xem [roadmap.md](roadmap.md).

**Workaround:** Chạy một lần trước:

```powershell
npx -y @colbymchenry/codegraph status .
```

---

### KI-003: Hardcoded Windows paths

**Triệu chứng:** Server không chạy trên macOS/Linux.

**Nguyên nhân:** Path trong `code_intel_mcp.mjs` hardcode `C:/Users/Tung Admin/...`

**Impact:** Không dùng được trên máy khác hoặc OS khác.

**Fix plan:** Đọc path từ env var hoặc config file.

**Workaround:** Sửa thủ công path trong file `.mjs` khi cần deploy sang máy khác.

---

### KI-004: CodeGraph `affected` command không ổn định

**Triệu chứng:** Đôi khi `code_intel_query` với `includeImpact: true` trả về kết quả trống.

**Nguyên nhân:** CodeGraph CLI `affected` command phụ thuộc vào index chất lượng.

**Impact:** Impact analysis không đáng tin cậy 100%.

**Fix plan:** Migrate sang CodeGraph MCP `callers/callees` khi ổn định hơn.

**Workaround:** Dùng `includeImpact: false` + dùng `codegraph` MCP tool trực tiếp.

---

### KI-005: `knowledge_items` không có full-text search

**Triệu chứng:** Query text dài tìm sai item hoặc bỏ sót.

**Nguyên nhân:** Ranking algorithm dùng `LIKE` thủ công, không có FTS5.

**Impact:** Recall thấp cho query phức tạp.

**Fix plan:** Thêm SQLite FTS5 virtual table cho `knowledge_items`.

**Workaround:** Truyền `symbols` cụ thể để cải thiện ranking.

---

### KI-006: `triggerCompression` từng ghi memory cho tất cả enabled agents

**Loại:** Bug đã sửa (historical).

**Root cause:** Logic `triggerCompression` không filter theo `agent_id`, ghi chung vào memory của tất cả agent đang enabled.

**Fix:** Thêm filter `WHERE agent_id = ?` trước khi ghi.

**Trạng thái:** ✅ Đã sửa.

---

### KI-007: API messages từng trả `agent_id` thay vì `agentId`

**Loại:** Bug đã sửa (historical).

**Root cause:** Field naming không nhất quán giữa DB và API response layer.

**Fix:** Chuẩn hóa sang `agentId` (camelCase) trong API layer.

**Trạng thái:** ✅ Đã sửa.

---

### KI-008: Dashboard từng hiển thị nhiều chấm working cùng lúc

**Loại:** Bug đã sửa (historical).

**Root cause:** State `isWorking` không được reset khi agent timeout.

**Fix:** Thêm timeout/cleanup cho `isWorking` state.

**Trạng thái:** ✅ Đã sửa.

---

### KI-009: Placeholder custom tool cần `encodeURIComponent`

**Loại:** Bug đã sửa (historical).

**Root cause:** URL template cho custom tool không encode parameter, vỡ URL khi có ký tự đặc biệt.

**Fix:** Wrap placeholder value bằng `encodeURIComponent`.

**Trạng thái:** ✅ Đã sửa.

---

## Cách ghi Issue mới

Khi phát hiện vấn đề mới, thêm vào section trên theo format:

```markdown
### KI-XXX: [Tên ngắn]

**Triệu chứng:** ...
**Nguyên nhân:** ...
**Impact:** ...
**Fix plan:** ...
**Workaround:** ...
```

Đồng thời lưu vào DB:

```json
{
  "type": "bug",
  "title": "KI-XXX: [Tên ngắn]",
  "rootCause": "...",
  "fix": "...",
  "symbols": ["symbol liên quan"],
  "files": ["file liên quan"]
}
```

---

## Changelog

| Version | Thay đổi |
|---|---|
| `1.0.0-local` | MCP SDK stdio transport; `better-sqlite3`; schema v2; 21 knowledge items; full webapp knowledge map; CodeGraph OK |
| `0.2.0` | Thêm `code_intel_decision`, `code_intel_bug`; schema v1; CodeGraph hybrid query |
| `0.1.0` | MVP: `code_intel_query`, `code_intel_remember`, `code_intel_status`; SQLite DB |
