-- Migration 002: FTS5 full-text search for knowledge_items

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_items_fts USING fts5(
  title, content, symbols_json, files_json, tags_json,
  content=knowledge_items,
  content_rowid=rowid
);

-- Triggers to keep FTS5 in sync with knowledge_items

CREATE TRIGGER IF NOT EXISTS knowledge_items_ai AFTER INSERT ON knowledge_items BEGIN
  INSERT INTO knowledge_items_fts(rowid, title, content, symbols_json, files_json, tags_json)
  VALUES (NEW.rowid, NEW.title, NEW.content, NEW.symbols_json, NEW.files_json, NEW.tags_json);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_items_ad AFTER DELETE ON knowledge_items BEGIN
  INSERT INTO knowledge_items_fts(knowledge_items_fts, rowid, title, content, symbols_json, files_json, tags_json)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.symbols_json, OLD.files_json, OLD.tags_json);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_items_au AFTER UPDATE ON knowledge_items BEGIN
  INSERT INTO knowledge_items_fts(knowledge_items_fts, rowid, title, content, symbols_json, files_json, tags_json)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.symbols_json, OLD.files_json, OLD.tags_json);
  INSERT INTO knowledge_items_fts(rowid, title, content, symbols_json, files_json, tags_json)
  VALUES (NEW.rowid, NEW.title, NEW.content, NEW.symbols_json, NEW.files_json, NEW.tags_json);
END;

-- Populate FTS5 from existing data
INSERT INTO knowledge_items_fts(rowid, title, content, symbols_json, files_json, tags_json)
  SELECT rowid, title, content, symbols_json, files_json, tags_json FROM knowledge_items;
