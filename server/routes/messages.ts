import { Router } from "express";
import type { Database } from "sql.js";
import { queryAll, queryOne, execute, formatSQLiteDate } from "../database.js";
import { getUserFromRequest } from "../auth_utils.js";

const UPLOADS_FOLDER = "uploads";
const UPLOADS_PREFIX = `/${UPLOADS_FOLDER}/`;
const cleanPath = (p: string) => p.replace(new RegExp(`^/?${UPLOADS_FOLDER}/`), "");

export default function messageRoutes(db: Database): Router {
  const router = Router();

  const isGlobalAdmin = (user: any) => user?.role === 'admin' && !user?.school;
  const isDirector = (user: any) => user?.role === 'director' && !!user?.school;
  const isPersonalAudience = (targetAudience: string) => targetAudience.startsWith('user:') || targetAudience.startsWith('users:');

  // ─── GET /api/messages ────────────────────────────────────────────
  router.get("/", (req, res) => {
    const { status, category, importance, audience, authorId, search } = req.query;

    const user = getUserFromRequest(db, req);

    let sql = `SELECT m.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school, u.class AS author_class, u.teacher_type AS author_teacher_type, u.subject AS author_subject FROM messages m JOIN users u ON m.author_id = u.id WHERE 1=1`;
    const params: any[] = [];

    if (status) { sql += " AND m.status = ?"; params.push(status); }
    if (category) { sql += " AND m.category = ?"; params.push(category); }
    if (importance) { sql += " AND m.importance = ?"; params.push(importance); }
    if (authorId) { sql += " AND m.author_id = ?"; params.push(Number(authorId)); }
    if (search) { sql += " AND (m.title LIKE ? OR m.content LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

    if (user && user.role !== 'admin') {
      // ПРИНЦИП НА ПЪЛНО РАЗДЕЛЕНИЕ НА УЧИЛИЩАТА:
      // Всеки потребител вижда само съобщения от своето училище ИЛИ глобални съобщения от админ
      sql += ` AND (u.school = ? OR (u.role = 'admin' AND (u.school IS NULL OR u.school = '')))`;
      params.push(user.school);

      // Филтриране по аудитория
      // Авторите винаги виждат своите съобщения
      // Всички виждат 'all'
      // Другите се филтрират по роля или клас
      sql += ` AND (m.author_id = ? 
                 OR m.target_audience = 'all' 
                 OR (m.target_audience = 'students' AND ?) 
                 OR (m.target_audience = 'teachers' AND ?) 
                 OR (m.target_audience = 'director' AND ?) 
                 OR (m.target_audience = 'class:' || ?)
                 OR (m.target_audience = ?)
                 OR (m.target_audience LIKE 'subject:%' AND ? = 1 AND INSTR(?, SUBSTR(m.target_audience, 9)) > 0)
                 OR (m.target_audience = 'user:' || ?) OR (m.target_audience LIKE 'users:%' AND INSTR(',' || REPLACE(m.target_audience, 'users:', '') || ',', ',' || ? || ',') > 0))`;
      params.push(
        user.id,
        user.role === 'student' ? 1 : 0,
        user.role === 'teacher' ? 1 : 0,
        ['director'].includes(user.role) ? 1 : 0,
        user.class || '___NONE___',
        user.class || '___NONE___',
        user.role === 'teacher' ? 1 : 0,
        user.subject || '',
        user.id,
        user.id
      );
    } else if (user && user.role === 'admin' && user.school) {
      // Администратор, който е избрал конкретно училище
      sql += " AND u.school = ?";
      params.push(user.school);
    } else if (!user && audience) {
      sql += " AND m.target_audience = ?"; params.push(audience);
    }

    sql += " ORDER BY m.created_at DESC";

    const rows = queryAll(db, sql, params);
    const result = rows.map((m) => enrichMessage(db, m));
    res.json(result);
  });

  // ─── GET /api/messages/:id ────────────────────────────────────────
  router.get("/:id", (req, res) => {
    const user = getUserFromRequest(db, req);
    const msgId = Number(req.params.id);

    let sql = `SELECT m.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school, u.class AS author_class, u.teacher_type AS author_teacher_type, u.subject AS author_subject
               FROM messages m JOIN users u ON m.author_id = u.id 
               WHERE m.id = ?`;
    const params: any[] = [msgId];

    if (user && user.role !== 'admin') {
      // ПРИНЦИП НА ПЪЛНО РАЗДЕЛЕНИЕ НА УЧИЛИЩАТА:
      // Всеки потребител вижда само съобщения от своето училище ИЛИ глобални съобщения от админ
      sql += ` AND (u.school = ? OR (u.role = 'admin' AND (u.school IS NULL OR u.school = '')))`;
      params.push(user.school);

      sql += ` AND (m.author_id = ? 
                 OR m.target_audience = 'all' 
                 OR (m.target_audience = 'students' AND ?) 
                 OR (m.target_audience = 'teachers' AND ?) 
                 OR (m.target_audience = 'director' AND ?) 
                 OR (m.target_audience = 'class:' || ?)
                 OR (m.target_audience = ?)
                 OR (m.target_audience LIKE 'subject:%' AND ? = 1 AND INSTR(?, SUBSTR(m.target_audience, 9)) > 0)
                 OR (m.target_audience = 'user:' || ?) OR (m.target_audience LIKE 'users:%' AND INSTR(',' || REPLACE(m.target_audience, 'users:', '') || ',', ',' || ? || ',') > 0))`;
      params.push(
        user.id,
        user.role === 'student' ? 1 : 0,
        user.role === 'teacher' ? 1 : 0,
        ['director'].includes(user.role) ? 1 : 0,
        user.class || '___NONE___',
        user.class || '___NONE___',
        user.role === 'teacher' ? 1 : 0,
        user.subject || '',
        user.id,
        user.id
      );
    }

    const row = queryOne(db, sql, params);

    if (!row) return res.status(404).json({ error: "Съобщението не е намерено или нямате достъп до него." });
    res.json(enrichMessage(db, row));
  });

  // ─── POST /api/messages ───────────────────────────────────────────
  router.post("/", (req, res) => {
    const { title, content, category, status, importance, targetAudience, target_audience, authorId, commentsEnabled } = req.body;

    // Проверка за задължителни полета (title и content могат да са празни низове)
    if (title === undefined || title === null || !category || authorId === undefined || authorId === null) {
      return res.status(400).json({ error: "Липсват задължителни полета: category или authorId." });
    }

    const finalTargetAudience = targetAudience || target_audience || "all";
    const finalAuthorId = Number(authorId);

    // Только директор может писать администратору
    if (finalTargetAudience === 'admin') {
      const user = getUserFromRequest(db, req);
      if (user?.role !== 'director') {
        return res.status(403).json({ error: "Само директорът може да изпраща съобщения до администратор." });
      }
    }

    const result = execute(db,
      `INSERT INTO messages (title, content, category, status, importance, target_audience, author_id, links, comments_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        content || "",
        category,
        status ?? "draft",
        importance ?? "normal",
        finalTargetAudience,
        finalAuthorId,
        req.body.links ? JSON.stringify(req.body.links) : null,
        commentsEnabled !== undefined ? (commentsEnabled ? 1 : 0) : 1
      ]
    );

    const messageId = result.lastId;

    // Свързване на прикачените файлове
    const attachmentsList = req.body.attachments || [];
    for (const att of attachmentsList) {
      const attPath = cleanPath(att.path || att.url || "");
      execute(db,
        `INSERT INTO attachments (message_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
        [messageId, att.name, att.size, att.type, attPath]
      );
    }

    // Одит: публикуване или чернова
    if (status === 'published') {
      const catRow = category ? queryOne(db, 'SELECT label FROM message_categories WHERE key = ?', [category]) : null;
      const catLabel = catRow ? catRow.label : (category || 'Общи');
      const msgRow = queryOne(db, "SELECT * FROM messages WHERE id = ?", [messageId]);
      const enriched = msgRow ? enrichMessage(db, msgRow) : null;
      execute(db,
        `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Публикуване на съобщение', finalAuthorId, 'message', String(messageId), `Заглавие: "${title}" | Категория: ${catLabel} | Важност: ${importance || 'нормално'}`, enriched ? JSON.stringify(enriched) : null]
      );
    }

    // Уведомления при публикуване
    if (status === "published") {
      notifyUsersAboutMessage(db, messageId, finalAuthorId, title, category, importance || "normal", finalTargetAudience);
    }

    res.status(201).json({ id: String(messageId), message: "Съобщението е създадено." });
  });

  // ─── PUT /api/messages/:id ────────────────────────────────────────
  router.put("/:id", (req, res) => {
    const { title, content, category, status, importance, targetAudience, target_audience, commentsEnabled, editedBy, changes } = req.body;

    // Проверка за валидно ID (може да идва с 'm' префикс от фронтенда понякога, но тук очакваме число)
    const rawId = req.params.id;
    const cleanId = rawId.startsWith('m') ? Number(rawId.substring(1)) : Number(rawId);

    const existing = queryOne(db, "SELECT * FROM messages WHERE id = ?", [cleanId]);
    if (!existing) return res.status(404).json({ error: "Съобщението не е намерено." });

    const finalTargetAudience = targetAudience || target_audience || existing.target_audience;

    execute(db,
      `UPDATE messages SET title = ?, content = ?, category = ?, status = ?, importance = ?, target_audience = ?, links = ?, comments_enabled = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        title ?? existing.title,
        content ?? existing.content,
        category ?? existing.category,
        status ?? existing.status,
        importance ?? existing.importance,
        finalTargetAudience,
        req.body.links ? JSON.stringify(req.body.links) : existing.links,
        commentsEnabled !== undefined ? (commentsEnabled ? 1 : 0) : existing.comments_enabled,
        cleanId,
      ]
    );

    // Запис в историята на редакциите само ако съобщението вече е било публикувано
    if (existing.status === "published") {
      const editorId = req.headers['x-user-id'] || existing.author_id; // Вземаме ID на редактора
      const editChanges = JSON.stringify({
        title: title !== existing.title,
        content: content !== existing.content,
        category: category !== existing.category,
        importance: importance !== existing.importance,
        targetAudience: finalTargetAudience !== existing.target_audience
      });
      execute(db,
        `INSERT INTO message_edits (message_id, edited_by, changes) VALUES (?, ?, ?)`,
        [cleanId, Number(editorId), editChanges]
      );
    }

    // Обновяване на прикачените файлове
    if (req.body.attachments) {
      // За простота: изтриваме старите и добавяме новите
      execute(db, "DELETE FROM attachments WHERE message_id = ?", [cleanId]);
      for (const att of req.body.attachments) {
        const attPath = cleanPath(att.path || att.url || "");
        execute(db,
          `INSERT INTO attachments (message_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
          [cleanId, att.name, att.size, att.type, attPath]
        );
      }
    }

    // Ако съобщението се публикува сега, го маркираме като прочетено за автора
    if (status === "published" || existing.status === "published") {
      execute(db,
        "INSERT OR IGNORE INTO read_statuses (message_id, user_id) VALUES (?, ?)",
        [cleanId, existing.author_id]
      );

      const isNewPublication = status === "published" && existing.status !== "published";
      const isEditOfPublished = status === "published" && existing.status === "published";

      if (isNewPublication || isEditOfPublished) {
        notifyUsersAboutMessage(
          db,
          cleanId,
          existing.author_id,
          title ?? existing.title,
          category ?? existing.category,
          importance ?? existing.importance,
          finalTargetAudience,
          isEditOfPublished
        );
      }
    }

    res.json({ message: "Съобщението е обновено." });
  });

  // ─── DELETE /api/messages/:id ─────────────────────────────────────
  router.delete("/:id", (req, res) => {
    const msgId = Number(req.params.id);
    const currentUser = getUserFromRequest(db, req);
    if (!currentUser) return res.status(401).json({ error: "Неавторизиран достъп." });

    // Check message exists first
    const existing = queryOne(db, "SELECT m.*, u.school AS author_school FROM messages m JOIN users u ON m.author_id = u.id WHERE m.id = ?", [msgId]);
    if (!existing) return res.status(404).json({ error: "Съобщението не е намерено." });

    const canDeleteAsGlobalAdmin = isGlobalAdmin(currentUser);
    const canDeleteAsDirector = isDirector(currentUser)
      && existing.author_school === currentUser.school
      && existing.category !== 'personal'
      && !isPersonalAudience(existing.target_audience);
    const canDeleteAsAuthor = Number(existing.author_id) === Number(currentUser.id);

    if (!canDeleteAsGlobalAdmin && !canDeleteAsDirector && !canDeleteAsAuthor) {
      return res.status(403).json({ error: "Нямате право да изтриете това съобщение." });
    }

    execute(db,
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
       VALUES ('Изтриване на съобщение', ?, 'message', ?, ?, ?)`,
      [currentUser.id, String(msgId), `Изтрито съобщение "${existing.title}"`, JSON.stringify(enrichMessage(db, existing))]
    );

    deleteMessageWithRelations(db, msgId);

    res.json({ message: "Съобщението и всички свързани данни са изтрити." });
  });

  // ─── POST /api/messages/delete-multiple ───────────────────────────
  router.post("/delete-multiple", (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Невалидни данни. Очаква се масив от ID-та." });

    for (const id of ids) {
      deleteMessageWithRelations(db, Number(id));
    }

    res.json({ message: `${ids.length} съобщения бяха изтрити успешно.` });
  });

  function deleteMessageWithRelations(db: Database, msgId: number) {
    // 1. Delete attachments belonging to comments of this message
    const commentIds = queryAll(db, "SELECT id FROM comments WHERE message_id = ?", [msgId]).map((r: any) => r.id);
    if (commentIds.length > 0) {
      commentIds.forEach((cid: number) => {
        execute(db, "DELETE FROM attachments WHERE comment_id = ?", [cid]);
      });
    }

    // 2. Delete attachments directly attached to the message
    execute(db, "DELETE FROM attachments WHERE message_id = ?", [msgId]);

    // 3. Delete comments
    execute(db, "DELETE FROM comments WHERE message_id = ?", [msgId]);

    // 4. Delete read statuses
    execute(db, "DELETE FROM read_statuses WHERE message_id = ?", [msgId]);

    // 5. Delete notifications
    execute(db, "DELETE FROM notifications WHERE message_id = ?", [msgId]);

    // 6. Delete edit history
    execute(db, "DELETE FROM message_edits WHERE message_id = ?", [msgId]);

    // 7. Finally delete the message itself
    execute(db, "DELETE FROM messages WHERE id = ?", [msgId]);
  }

  // ─── POST /api/messages/:id/comments ──────────────────────────────
  router.post("/:id/comments", (req, res) => {
    const { authorId, content, attachments, links } = req.body;
    if (!content && (!attachments || attachments.length === 0) && (!links || links.length === 0)) return res.status(400).json({ error: "Липсва съдържание, файлове или връзки." });

    const msg = queryOne(db, "SELECT * FROM messages WHERE id = ?", [Number(req.params.id)]);
    if (!msg) return res.status(404).json({ error: "Съобщението не е намерено." });
    if (!msg.comments_enabled) return res.status(403).json({ error: "Коментарите за това съобщение са изключени." });

    // Check for authorId after message existence and comments_enabled check
    if (!authorId) {
      return res.status(400).json({ error: "Липсва задължително поле: authorId." });
    }

    const commenter = queryOne(db, "SELECT first_name, last_name FROM users WHERE id = ?", [authorId]);
    const commenterName = commenter ? `${commenter.first_name} ${commenter.last_name}` : 'Някой';

    const result = execute(db,
      `INSERT INTO comments (message_id, author_id, content, links) VALUES (?, ?, ?, ?)`,
      [Number(req.params.id), authorId, content, links ? JSON.stringify(links) : null]
    );

    const commentId = result.lastId;

    // Свързване на прикачените файлове към коментара
    const attachmentsList = req.body.attachments || [];
    for (const att of attachmentsList) {
      execute(db,
        `INSERT INTO attachments (comment_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
        [commentId, att.name, att.size, att.type, cleanPath(att.path || att.url || "")]
      );
    }

    // Одит: регистриране на добавен коментар
    execute(db,
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
       VALUES ('Добавен коментар', ?, 'comment', ?, ?, ?)`,
      [authorId, String(commentId), `${commenterName} коментира съобщение "${msg.title}"`, JSON.stringify({ messageId: String(msg.id), authorId, content, authorName: commenterName, attachments, links })]
    );

    // Уведомление до автора на съобщението (ако не е той самият)
    if (msg.author_id !== authorId) {
      const settings = queryOne(db, "SELECT new_comment FROM notification_settings WHERE user_id = ?", [msg.author_id]);
      if (!settings || settings.new_comment === 1) {
        execute(db,
          `INSERT INTO notifications (user_id, type, message_id, message_title, text) VALUES (?, 'new_comment', ?, ?, ?)`,
          [msg.author_id, msg.id, msg.title, `${commenterName} коментира вашето съобщение`]
        );
      }
    }

    // Уведомление при отговор (споменаване с @Име Фамилия,)
    const mentionMatch = content.match(/^@([^,]+),\s/);
    if (mentionMatch) {
      const mentionedName = mentionMatch[1];
      const mentionedUser = queryOne(db, "SELECT id FROM users WHERE first_name || ' ' || last_name = ?", [mentionedName]);
      if (mentionedUser && mentionedUser.id !== authorId && mentionedUser.id !== msg.author_id) {
        const settings = queryOne(db, "SELECT new_comment FROM notification_settings WHERE user_id = ?", [mentionedUser.id]);
        if (!settings || settings.new_comment === 1) {
          execute(db,
            `INSERT INTO notifications (user_id, type, message_id, message_title, text) VALUES (?, 'new_comment', ?, ?, ?)`,
            [mentionedUser.id, msg.id, msg.title, `${commenterName} отговори на ваш коментар`]
          );
        }
      }
    }

    res.status(201).json({ id: String(result.lastId), message: "Коментарът е добавен." });
  });

  // ─── DELETE /api/comments/:id ─────────────────────────────────────
  router.delete("/comments/:id", (req, res) => {
    const currentUser = getUserFromRequest(db, req);
    const commentToDelete = queryOne(db, "SELECT c.*, m.title AS msg_title FROM comments c JOIN messages m ON c.message_id = m.id WHERE c.id = ?", [Number(req.params.id)]);
    const result = execute(db, "DELETE FROM comments WHERE id = ?", [Number(req.params.id)]);
    if (result.changes === 0) return res.status(404).json({ error: "Коментарът не е намерен." });

    // Одит: регистриране на изтрит коментар
    if (currentUser && commentToDelete) {
      execute(db,
        `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
         VALUES ('Изтрит коментар', ?, 'comment', ?, ?, ?)`,
        [currentUser.id, String(req.params.id), `Изтрит коментар от съобщение "${commentToDelete.msg_title}"`, JSON.stringify({ messageId: String(commentToDelete.message_id), content: commentToDelete.content })]
      );
    }

    res.json({ message: "Коментарът е изтрит." });
  });

  // ─── PUT /api/comments/:id ────────────────────────────────────────
  router.put("/comments/:id", (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Липсва съдържание." });

    const result = execute(db, "UPDATE comments SET content = ? WHERE id = ?", [content, Number(req.params.id)]);
    if (result.changes === 0) return res.status(404).json({ error: "Коментарът не е намерен." });
    res.json({ message: "Коментарът е обновен." });
  });

  // ─── POST /api/messages/:id/read ──────────────────────────────────
  router.post("/:id/read", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });

    const msgId = Number(req.params.id);
    const msg = queryOne(db, "SELECT * FROM messages WHERE id = ?", [msgId]);
    if (!msg) return res.status(404).json({ error: "Съобщението не е намерено." });

    execute(db, "INSERT OR IGNORE INTO read_statuses (message_id, user_id) VALUES (?, ?)", [msgId, user.id]);

    // Одитен журнал: Потвърждаване на важни съобщения
    if (msg.importance === 'high') {
      execute(db,
        `INSERT INTO audit_log (action, performed_by, target_type, target_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        ['Потвърждаване на важно съобщение', user.id, 'message', String(msgId), `Потребител ${user.first_name} ${user.last_name} потвърди, че е прочел "${msg.title}"`]
      );
    }

    res.json({ message: "Маркирано като прочетено." });
  });

  // ─── Personal Archive Routes ───────────────────────────────────────

  router.get("/archives/:userId", (req, res) => {
    const userId = Number(req.params.userId);
    const rows = queryAll(db, `
      SELECT pa.snapshot, pa.archived_at
      FROM personal_archives pa
      WHERE pa.user_id = ?
      ORDER BY pa.archived_at DESC
    `, [userId]);

    res.json(rows.map(row => {
      const snapshot = row.snapshot ? JSON.parse(row.snapshot) : null;
      if (snapshot) {
        return {
          ...snapshot,
          archivedAt: formatSQLiteDate(row.archived_at),
          isSnapshot: true
        };
      }
      return null;
    }).filter(Boolean));
  });

  router.post("/:id/archive", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });

    const msgId = Number(req.params.id);
    const force = req.query.force === 'true';

    // Проверка дали вече е архивирано
    const existing = queryOne(db, "SELECT * FROM personal_archives WHERE user_id = ? AND message_id = ?", [user.id, msgId]);
    if (existing && !force) {
      return res.status(409).json({
        error: "Това съобщение вече е архивирано.",
        alreadyArchived: true
      });
    }

    // Вземане на пълното състояние на съобщението
    const msgRow = queryOne(db, `
      SELECT m.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school, u.class AS author_class, u.teacher_type AS author_teacher_type, u.subject AS author_subject 
      FROM messages m JOIN users u ON m.author_id = u.id 
      WHERE m.id = ?
    `, [msgId]);

    if (!msgRow) return res.status(404).json({ error: "Съобщението не е намерено." });

    const enriched = enrichMessage(db, msgRow);
    const snapshot = JSON.stringify(enriched);

    execute(db,
      "INSERT OR REPLACE INTO personal_archives (user_id, message_id, snapshot, archived_at) VALUES (?, ?, ?, datetime('now'))",
      [user.id, msgId, snapshot]
    );



    res.json({ message: "Съобщението е архивирано успешно (моментна снимка)." });
  });

  router.delete("/:id/archive", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });

    const msgId = Number(req.params.id);
    execute(db, "DELETE FROM personal_archives WHERE user_id = ? AND message_id = ?", [user.id, msgId]);
    res.json({ message: "Съобщението е възстановено от архива." });
  });

  router.post("/bulk-archive", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });

    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Невалидни данни." });

    for (const id of ids) {
      const msgId = Number(id);
      const msgRow = queryOne(db, `
        SELECT m.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school, u.class AS author_class, u.teacher_type AS author_teacher_type, u.subject AS author_subject 
        FROM messages m JOIN users u ON m.author_id = u.id 
        WHERE m.id = ?
      `, [msgId]);

      if (msgRow) {
        const enriched = enrichMessage(db, msgRow);
        const snapshot = JSON.stringify(enriched);
        execute(db,
          "INSERT OR REPLACE INTO personal_archives (user_id, message_id, snapshot, archived_at) VALUES (?, ?, ?, datetime('now'))",
          [user.id, msgId, snapshot]
        );
      }
    }
    res.json({ message: `${ids.length} съобщения са архивирани.` });
  });

  return router;
}

// ─── Помощна функция – изпращане на уведомления ─────────────────────

function notifyUsersAboutMessage(db: Database, messageId: number, authorId: number, title: string, category: string, importance: string, targetAudience: string, isEdit: boolean = false) {
  // Вземане на името на автора и неговото училище
  const author = queryOne(db, "SELECT first_name, last_name, school, role FROM users WHERE id = ?", [authorId]);
  if (!author) return;

  const authorName = `${author.first_name} ${author.last_name}`;
  const isGlobalAdmin = author.role === 'admin' && !author.school;

  const categoryLabels: Record<string, string> = {
    system: 'Системно съобщение',
    general: 'Общо съобщение',
    administrative: 'Административно съобщение',
    academic: 'Учебно съобщение',
    personal: 'Лично съобщение',
  };
  const categoryLabel = categoryLabels[category] || category;

  const importanceLabels: Record<string, string> = {
    low: 'ниска',
    normal: 'нормална',
    high: 'висока',
  };
  const importanceLabel = importanceLabels[importance] || importance;

  const actionText = isEdit ? "редактира" : "изпрати";
  const notificationText = `${authorName} Ви ${actionText} съобщение с категория ${categoryLabel} и ${importanceLabel} важност`;
  const type = isEdit ? 'edited_message' : 'new_message';

  const users = queryAll(db, "SELECT id, role, class, school FROM users WHERE id != ?", [authorId]);

  for (const user of users) {
    // ПРИНЦИП НА ПЪЛНО РАЗДЕЛЕНИЕ НА УЧИЛИЩАТА:
    // Изпращаме уведомления само на хора от същото училище, 
    // ОСВЕН ако авторът не е глобален админ.
    if (!isGlobalAdmin && user.school !== author.school) continue;

    // Проверка на настройките на потребителя
    const settings = queryOne(db, "SELECT * FROM notification_settings WHERE user_id = ?", [user.id]);
    if (settings) {
      if (type === 'new_message' && settings.new_message === 0) continue;
      if (type === 'edited_message' && settings.edited_message === 0) continue;
    }

    let shouldNotify = false;

    if (targetAudience === 'all') shouldNotify = true;
    else if (targetAudience === 'admin' && user.role === 'admin') shouldNotify = true;
    else if (targetAudience === 'students' && user.role === 'student') shouldNotify = true;
    else if (targetAudience === 'teachers' && user.role === 'teacher') shouldNotify = true;
    else if (targetAudience === 'director' && ['admin', 'director'].includes(user.role)) shouldNotify = true;
    else if (targetAudience === user.class) shouldNotify = true;
    else if (targetAudience === `class:${user.class}`) shouldNotify = true;
    else if (targetAudience.startsWith('subject:') && user.role === 'teacher') {
      const targetSubj = targetAudience.replace('subject:', '');
      if (user.class && user.class.includes(targetSubj)) shouldNotify = true; // For class teachers by subject
      if (user.subject && user.subject.split(', ').includes(targetSubj)) shouldNotify = true;
    }
    else if (targetAudience === `user:${user.id}`) shouldNotify = true;
    else if (targetAudience.startsWith('users:')) {
      const userIds = targetAudience.replace('users:', '').split(',');
      if (userIds.includes(user.id.toString())) shouldNotify = true;
    }

    if (shouldNotify) {
      execute(db,
        `INSERT INTO notifications (user_id, type, message_id, message_title, text) VALUES (?, ?, ?, ?, ?)`,
        [user.id, type, messageId, title, notificationText]
      );
    }
  }
}

// ─── Помощна функция – обогатяване на съобщение ─────────────────────

function enrichMessage(db: Database, row: any) {
  const attachments = queryAll(db, "SELECT * FROM attachments WHERE message_id = ?", [row.id]);
  const comments = queryAll(db,
    `SELECT c.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school, u.class AS author_class, u.teacher_type AS author_teacher_type, u.subject AS author_subject
     FROM comments c JOIN users u ON c.author_id = u.id
     WHERE c.message_id = ? ORDER BY c.created_at`,
    [row.id]
  );
  const edits = queryAll(db,
    `SELECT e.*, u.first_name, u.last_name FROM message_edits e JOIN users u ON e.edited_by = u.id WHERE e.message_id = ? ORDER BY e.edited_at DESC`,
    [row.id]
  );

  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    category: row.category,
    status: row.status,
    importance: row.importance,
    targetAudience: row.target_audience,
    authorId: String(row.author_id),
    authorName: row.author_name,
    authorRole: row.author_role,
    authorSchool: row.author_school,
    authorClass: row.author_class,
    authorTeacherType: row.author_teacher_type,
    authorSubject: row.author_subject,
    commentsEnabled: !!row.comments_enabled,
    createdAt: formatSQLiteDate(row.created_at),
    updatedAt: formatSQLiteDate(row.updated_at),
    links: row.links ? JSON.parse(row.links) : [],
    attachments: attachments.map((a) => ({
      id: String(a.id),
      name: a.name,
      size: a.size,
      type: a.type,
      url: `${UPLOADS_PREFIX}${cleanPath(a.path)}`
    })),
    comments: comments.map((c) => {
      const cAttachments = queryAll(db, "SELECT * FROM attachments WHERE comment_id = ?", [c.id]);
      return {
        id: String(c.id),
        messageId: String(c.message_id),
        authorId: String(c.author_id),
        authorName: c.author_name,
        authorRole: c.author_role,
        authorSchool: c.author_school,
        authorClass: c.author_class,
        authorTeacherType: c.author_teacher_type,
        authorSubject: c.author_subject,
        content: c.content,
        createdAt: formatSQLiteDate(c.created_at),
        links: c.links ? JSON.parse(c.links) : [],
        attachments: cAttachments.map(ca => ({
          id: String(ca.id),
          name: ca.name,
          size: ca.size,
          type: ca.type,
          url: `${UPLOADS_PREFIX}${cleanPath(ca.path)}`
        }))
      };
    }),
    editHistory: edits.map((e: any) => ({
      editedAt: formatSQLiteDate(e.edited_at),
      editedBy: String(e.edited_by),
      editedByName: `${e.first_name} ${e.last_name}`,
      changes: e.changes,
    })),
    targetUser: (() => {
      const ta = String(row.target_audience || "");
      if (ta.startsWith('user:')) {
        const userId = ta.replace('user:', '');
        const u = queryAll(db, "SELECT first_name, last_name, role, school, class, class_number, teacher_type, subject FROM users WHERE id = ?", [userId])[0] as any;
        if (u) {
          return {
            id: userId,
            firstName: u.first_name,
            lastName: u.last_name,
            role: u.role,
            school: u.school,
            class: u.class,
            classNumber: u.class_number,
            teacherType: u.teacher_type,
            subject: u.subject
          };
        }
      }
      return null;
    })(),
    targetUsers: (() => {
      const ta = String(row.target_audience || "");
      if (ta.startsWith('users:')) {
        const userIds = ta.replace('users:', '').split(',');
        const placeholders = userIds.map(() => '?').join(',');
        const users = queryAll(db, `SELECT id, first_name, last_name, role, school, class, class_number, teacher_type, subject FROM users WHERE id IN (${placeholders})`, userIds) as any[];
        return users.map(u => ({
          id: String(u.id),
          firstName: u.first_name,
          lastName: u.last_name,
          role: u.role,
          school: u.school,
          class: u.class,
          classNumber: u.class_number,
          teacherType: u.teacher_type,
          subject: u.subject
        }));
      }
      return undefined;
    })()
  };
}
