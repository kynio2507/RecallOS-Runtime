# User Guide

## Ai nên dùng tài liệu này?

Người dùng cơ bản muốn dùng `9base-code-intel` trong Antigravity để hỏi về codebase 9Base.

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

### `code_intel_query`

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

Dùng `code_intel_bug`:

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

Dùng `code_intel_decision`:

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
code_intel_status
```

Kết quả tốt:

- server `9base-code-intel 1.0.0-local`
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
