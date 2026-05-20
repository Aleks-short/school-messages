PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password      TEXT    NOT NULL,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('admin','director','teacher','student')),
  registration_status TEXT NOT NULL DEFAULT 'approved' CHECK(registration_status IN ('pending','approved','rejected')),
  registration_review_note TEXT,
  registration_reviewed_at TEXT,
  school        TEXT    NOT NULL,
  class         TEXT,
  pending_class TEXT,
  avatar        TEXT,
  subject       TEXT,
  pending_subject TEXT,
  class_number  INTEGER,
  teacher_type  TEXT    CHECK(teacher_type IN ('class','regular')),
  pending_teacher_type TEXT CHECK(pending_teacher_type IN ('class','regular')),
  management_position TEXT CHECK(management_position IN ('director')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  content         TEXT    NOT NULL,
  category        TEXT    NOT NULL CHECK(category IN ('system','general','administrative','academic','personal')),
  status          TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  importance      TEXT    NOT NULL DEFAULT 'normal' CHECK(importance IN ('low','normal','high')),
  target_audience TEXT    NOT NULL DEFAULT 'all',
  author_id       INTEGER NOT NULL,
  links           TEXT,
  comments_enabled INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id  INTEGER,
  comment_id  INTEGER,
  name        TEXT    NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  type        TEXT    NOT NULL,
  path        TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id  INTEGER NOT NULL,
  author_id   INTEGER NOT NULL,
  content     TEXT    NOT NULL,
  links       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS read_statuses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id  INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  read_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  confirmed   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  type          TEXT    NOT NULL CHECK(type IN ('new_message','edited_message','reminder','new_comment')),
  message_id    INTEGER NOT NULL,
  message_title TEXT    NOT NULL,
  text          TEXT    NOT NULL,
  read          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS school_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(school, name)
);

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id        INTEGER PRIMARY KEY,
  new_message    INTEGER NOT NULL DEFAULT 1,
  edited_message INTEGER NOT NULL DEFAULT 1,
  new_comment    INTEGER NOT NULL DEFAULT 1,
  reminder       INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_edits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id      INTEGER NOT NULL,
  edited_by       INTEGER NOT NULL,
  changes         TEXT    NOT NULL,
  edited_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (edited_by)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  action            TEXT    NOT NULL,
  performed_by      INTEGER NOT NULL,
  target_type       TEXT    NOT NULL CHECK(target_type IN ('message','user','setting','class','comment','draft','archive')),
  target_id         TEXT    NOT NULL,
  details           TEXT,
  target_data       TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (performed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS personal_archives (
  user_id      INTEGER NOT NULL,
  message_id   INTEGER NOT NULL,
  archived_at  TEXT NOT NULL DEFAULT (datetime('now')),
  snapshot     TEXT,
  PRIMARY KEY (user_id, message_id),
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
