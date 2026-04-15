import initSqlJs, { type Database } from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { seed as seedLarge } from "./seed_large.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const DB_PATH = path.join(dataDir, "school.db");

let db: Database;

/** Зарежда или създава базата данни */
export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log("✅ Базата данни е заредена от файл.");
  } else {
    db = new SQL.Database();
    console.log("✅ Създадена е нова база данни.");
  }

  createTables(db);
  await seedData(db);
  saveDatabase();

  return db;
}

/** Записва текущото състояние на базата данни на диска */
export function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ─── Помощни функции за заявки ──────────────────────────────────────

/** Изпълнява SELECT и връща масив от обекти */
export function queryAll(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/** Изпълнява SELECT и връща един обект или null */
export function queryOne(db: Database, sql: string, params: any[] = []): any | null {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

/** Изпълнява INSERT/UPDATE/DELETE и връща lastInsertRowid и changes */
export function execute(db: Database, sql: string, params: any[] = []): { lastId: number; changes: number } {
  db.run(sql, params);
  const lastId = (db.exec("SELECT last_insert_rowid() AS id")[0]?.values[0]?.[0] as number) ?? 0;
  const changes = (db.exec("SELECT changes() AS c")[0]?.values[0]?.[0] as number) ?? 0;
  saveDatabase();
  return { lastId, changes };
}

/** Помощна функция за форматиране на SQLite дати като ISO-8601 UTC низове */
export function formatSQLiteDate(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString();
  // Ако вече е ISO, просто го връщаме
  if (dateStr.includes('T') && dateStr.endsWith('Z')) return dateStr;
  // SQLite формат: YYYY-MM-DD HH:MM:SS -> YYYY-MM-DDTHH:MM:SSZ
  return dateStr.replace(' ', 'T') + 'Z';
}

/** Работа по напомняния – проверява за непотвърдени важни съобщения */
export function runReminderJob(db: Database) {
  const now = new Date();
  // В SQLite datetime('now') е в UTC.
  const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];

  try {
    // 1. Всички публикувани съобщения с висока важност, публикувани преди > 2 мин
    const messages = queryAll(db, `
      SELECT * FROM messages 
      WHERE status = 'published' 
        AND importance = 'high' 
        AND created_at <= ?
    `, [twoMinutesAgo]);

    for (const m of messages) {
      const targetAudience = m.target_audience;
      const authorId = m.author_id;
      const author = queryOne(db, "SELECT school, role FROM users WHERE id = ?", [authorId]);
      if (!author) continue;
      const isGlobalAuthor = author.role === 'admin' && !author.school;

      // Вземаме всички потребители (освен автора)
      const users = queryAll(db, "SELECT id, role, class, school FROM users WHERE id != ?", [authorId]);

      for (const user of users) {
        // ПРИНЦИП НА ПЪЛНО РАЗДЕЛЕНИЕ НА УЧИЛИЩАТА:
        if (!isGlobalAuthor && user.school !== author.school) continue;
        // 2. Проверка дали потребителят е в целевата аудитория
        let isInAudience = false;
        const isStaff = ['admin', 'director', 'teacher'].includes(user.role);

        if (targetAudience === 'all') isInAudience = true;
        else if (targetAudience === 'staff' && isStaff) isInAudience = true;
        else if (targetAudience === 'students' && (user.role === 'student' || isStaff)) isInAudience = true;
        else if (targetAudience.startsWith('class_')) {
          if (user.class === targetAudience.replace('class_', '') || isStaff) isInAudience = true;
        }

        if (!isInAudience) continue;

        // 3. Проверка дали потребителят вече е потвърдил съобщението
        const readStatus = queryOne(db, "SELECT confirmed FROM read_statuses WHERE message_id = ? AND user_id = ?", [m.id, user.id]);
        if (readStatus && readStatus.confirmed === 1) continue;

        // 4. Проверка дали потребителят вече е получил напомняне за това съобщение
        const existingReminder = queryOne(db, "SELECT id FROM notifications WHERE user_id = ? AND message_id = ? AND type = 'reminder'", [user.id, m.id]);
        if (existingReminder) continue;

        // 5. Проверка на настройките на потребителя за напомняния
        const settings = queryOne(db, "SELECT reminder FROM notification_settings WHERE user_id = ?", [user.id]);
        if (settings && settings.reminder === 0) continue;

        // 6. Изпращане на напомняне
        execute(db, `
          INSERT INTO notifications (user_id, type, message_id, message_title, text)
          VALUES (?, 'reminder', ?, ?, ?)
        `, [user.id, m.id, m.title, `Напомняне: Все още не сте потвърдили важно съобщение: "${m.title}"`]);
      }
    }
  } catch (err) {
    console.error("❌ Грешка в Reminder Job:", err);
  }
}

function normalizeGlobalAdminSchool(db: Database) {
  try {
    // Older data used a synthetic school label for the global admin.
    db.run("UPDATE users SET school = '' WHERE role = 'admin' AND school = 'Всички училища'");
  } catch (migErr) {
    console.warn("⚠️ Грешка при нормализация на глобалния администратор:", migErr);
  }
}

function ensurePendingSubjectColumn(db: Database) {
  try {
    const columns = queryAll(db, "PRAGMA table_info(users)");
    const hasPendingSubject = columns.some((column) => column.name === 'pending_subject');
    if (!hasPendingSubject) {
      db.run("ALTER TABLE users ADD COLUMN pending_subject TEXT");
    }
  } catch (migErr) {
    console.warn("⚠️ Грешка при миграция на чакащите предмети:", migErr);
  }
}

function ensureFlexibleMessageCategorySchema(db: Database) {
  try {
    const tableSql = queryOne(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'")?.sql as string | undefined;
    if (!tableSql || !tableSql.includes("CHECK(category IN")) return;

    db.run("PRAGMA foreign_keys = OFF");
    db.run(`
      CREATE TABLE IF NOT EXISTS messages_new (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        title           TEXT    NOT NULL,
        content         TEXT    NOT NULL,
        category        TEXT    NOT NULL,
        status          TEXT    NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
        importance      TEXT    NOT NULL DEFAULT 'normal' CHECK(importance IN ('low','normal','high')),
        target_audience TEXT    NOT NULL DEFAULT 'all',
        author_id       INTEGER NOT NULL,
        links           TEXT,
        comments_enabled INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `);
    db.run(`
      INSERT INTO messages_new (id, title, content, category, status, importance, target_audience, author_id, links, comments_enabled, created_at, updated_at)
      SELECT id, title, content, category, status, importance, target_audience, author_id, links, comments_enabled, created_at, updated_at
      FROM messages
    `);
    db.run("DROP TABLE messages");
    db.run("ALTER TABLE messages_new RENAME TO messages");
    db.run("PRAGMA foreign_keys = ON");
  } catch (migErr) {
    console.warn("⚠️ Грешка при миграция на categories в messages:", migErr);
  }
}

function seedMetadataTables(db: Database) {
  try {
    const defaultCategories = [
      ['system', 'Системно съобщение'],
      ['general', 'Общо съобщение'],
      ['administrative', 'Административно съобщение'],
      ['academic', 'Учебно съобщение'],
      ['personal', 'Лично съобщение'],
    ];

    for (const [key, label] of defaultCategories) {
      db.run("INSERT OR IGNORE INTO message_categories (key, label) VALUES (?, ?)", [key, label]);
    }

    const existingClasses = queryAll(db, "SELECT school, class FROM users WHERE class IS NOT NULL AND trim(class) != ''");
    for (const row of existingClasses) {
      db.run("INSERT OR IGNORE INTO school_classes (school, name) VALUES (?, ?)", [row.school, row.class]);
    }
  } catch (migErr) {
    console.warn("⚠️ Грешка при инициализация на metadata таблиците:", migErr);
  }
}

function migrateAuditLogTargetTypes(db: Database) {
  try {
    const tableSql = queryOne(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'")?.sql as string | undefined;
    if (!tableSql) return;
    // Check if we have all current target types
    const requiredTypes = ['message', 'user', 'setting', 'class', 'comment', 'draft', 'archive'];
    const hasAll = requiredTypes.every(t => tableSql.includes(`'${t}'`));
    if (hasAll) return;

    db.run("PRAGMA foreign_keys = OFF");
    db.run(`
      CREATE TABLE IF NOT EXISTS audit_log_new (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        action            TEXT    NOT NULL,
        performed_by      INTEGER NOT NULL,
        target_type       TEXT    NOT NULL CHECK(target_type IN ('message','user','setting','class','comment','draft','archive')),
        target_id         TEXT    NOT NULL,
        details           TEXT,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (performed_by) REFERENCES users(id)
      )
    `);
    db.run(`
      INSERT INTO audit_log_new (id, action, performed_by, target_type, target_id, details, created_at)
      SELECT id, action, performed_by, target_type, target_id, details, created_at
      FROM audit_log
    `);
    db.run("DROP TABLE audit_log");
    db.run("ALTER TABLE audit_log_new RENAME TO audit_log");
    db.run("PRAGMA foreign_keys = ON");
    console.log("✅ Миграция на audit_log target_type завършена.");
  } catch (migErr) {
    console.warn("⚠️ Грешка при миграция на audit_log:", migErr);
  }
}

function ensurePendingTeacherTypeColumn(db: Database) {
  try {
    const columns = queryAll(db, "PRAGMA table_info(users)");
    const hasPendingType = columns.some((column) => column.name === 'pending_teacher_type');
    if (!hasPendingType) {
      db.run("ALTER TABLE users ADD COLUMN pending_teacher_type TEXT CHECK(pending_teacher_type IN ('class','regular'))");
      console.log("✅ Добавена колона pending_teacher_type в таблица users.");
    }
  } catch (migErr) {
    console.warn("⚠️ Грешка при миграция на pending_teacher_type:", migErr);
  }
}

function ensureAuditLogTargetDataColumn(db: Database) {
  try {
    const columns = queryAll(db, "PRAGMA table_info(audit_log)");
    const hasTargetData = columns.some((column) => column.name === 'target_data');
    if (!hasTargetData) {
      db.run("ALTER TABLE audit_log ADD COLUMN target_data TEXT");
      console.log("✅ Добавена колона target_data в таблица audit_log.");
    }
  } catch (migErr) {
    console.warn("⚠️ Грешка при миграция на target_data в audit_log:", migErr);
  }
}

// ─── Създаване на таблици ───────────────────────────────────────────
function createTables(db: Database) {
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    db.run(schemaSql);
    ensureFlexibleMessageCategorySchema(db);
    migrateAuditLogTargetTypes(db);
    normalizeGlobalAdminSchool(db);
    ensurePendingSubjectColumn(db);
    ensurePendingTeacherTypeColumn(db);
    ensureAuditLogTargetDataColumn(db);
    seedMetadataTables(db);

    console.log("✅ Схемата е приложена успешно.");
  } catch (err) {
    console.error("❌ Грешка при създаване на таблиците (schema.sql):", err);
  }
}

// ─── Начални данни (seed) ───────────────────────────────────────────

async function seedData(db: Database) {
  const results = db.exec("SELECT COUNT(*) as cnt FROM users");
  const count = results[0]?.values[0]?.[0] as number;
  if (count > 0) return; // Вече има данни

  console.log("🌱 Зареждане на начални данни (seed_large)...");

  try {
    await seedLarge(db);
  } catch (err) {
    console.error("❌ Грешка при зареждане на начални данни (seed_large.ts):", err);
  }

  console.log("🌱 Начални данни заредени успешно.");
}