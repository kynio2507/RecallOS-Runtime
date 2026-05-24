# Roadmap

## Trạng thái hiện tại: `production-grade local` (v1.0.0-local)

Hệ thống dùng được hằng ngày trong Antigravity với MCP server ổn định hơn, SQLite driver ổn định, test ghi/đọc đầy đủ hơn.

---

## Milestone 0.3.0 — Stability & Portability ✅ Done

**Mục tiêu:** Bỏ dependency thô và hardcode bắt buộc, chạy ổn định local.

| Task | Priority | Trạng thái |
|---|---|---|
| Migrate từ `node:sqlite` sang `better-sqlite3` | High | ✅ Done |
| Đọc project path từ env var / config file | High | ✅ Done |
| Pre-install hoặc bundle CodeGraph | Medium | ⚠️ Chưa — vẫn dùng `npx` |
| Viết `operations.md` đầy đủ hơn | Low | ✅ Done |

---

## Milestone 0.4.0 — Search Quality

**Mục tiêu:** Cải thiện recall và precision khi query.

| Task | Priority | Ghi chú |
|---|---|---|
| Thêm SQLite FTS5 cho `knowledge_items` | High | Thay thế LIKE ranking thủ công |
| Cải thiện ranking algorithm | Medium | Weighted scoring theo context |
| Hỗ trợ filter theo `type` trong query | Medium | VD: chỉ query `bug` |
| Hỗ trợ filter theo `tags` | Low | Tags-based retrieval |

---

## Milestone 0.5.0 — CodeGraph Integration

**Mục tiêu:** Tích hợp sâu hơn với CodeGraph, thay CLI bằng MCP.

| Task | Priority | Ghi chú |
|---|---|---|
| Migrate CodeGraph calls sang `codegraph` MCP tools | High | Dùng `callers`/`callees`/`context` từ MCP |
| Bỏ CLI adapter `cmd.exe /c npx ...` | Medium | Phụ thuộc task trên |
| Hỗ trợ impact analysis đáng tin cậy hơn | Medium | Dùng `codegraph_impact` MCP |
| Cache CodeGraph results ngắn hạn | Low | Tránh gọi lặp lại |

---

## Milestone 1.0.0 — Production-grade Core

**Mục tiêu:** Dùng được ổn định, có migration engine, có test đầy đủ.

| Task | Priority | Ghi chú |
|---|---|---|
| SQLite migration engine (schema versioning) | High | Hiện migrate thủ công |
| Test coverage đầy đủ tất cả tools | High | Hiện test cơ bản |
| Error handling và retry cho CodeGraph | High | Hiện lỗi silent |
| Structured error response chuẩn | Medium | Chuẩn hóa error format trả về |
| Config file thay vì hardcode | Medium | Phụ thuộc 0.3.0 |
| Logging structured hơn (JSON events) | Low | Hiện dùng text detail |

---

## Tính năng tiềm năng (Future)

> Chưa lên kế hoạch cụ thể. Ghi lại để đánh giá sau.

| Tính năng | Mô tả |
|---|---|
| Multi-repo support | Hỗ trợ nhiều repo cùng lúc |
| Knowledge export/import | Export DB sang JSON, import từ file |
| Symbol-level change tracking | Theo dõi khi symbol thay đổi qua git |
| Embedding-based semantic search | Thay LIKE bằng vector similarity |
| Web UI đơn giản | Xem knowledge items qua browser |
| Agent-aware memory scoping | Nhớ riêng theo agent context |

---

## Không nằm trong roadmap

| Tính năng | Lý do |
|---|---|
| Log platform production | Ngoài scope — chỉ là dev tool |
| Task/roadmap management | Ngoài scope — dùng tool khác |
| Chạy trong 9Base runtime | Ngoài scope — external tool only |
| Auth/multi-user | Ngoài scope — local single-user |

---

## Nguyên tắc ưu tiên

1. **Stability trước features** — v0.3.0 fix nền trước khi thêm tính năng
2. **CodeGraph MCP > CLI** — migrate dần sang MCP integration
3. **Minimal core** — không nhét tính năng không liên quan Knowledge Base + CodeGraphligence
4. **Local-first** — không thêm external service dependency không cần thiết
