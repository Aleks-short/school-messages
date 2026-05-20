import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Database } from "sql.js";
import { execute, queryAll, queryOne } from "../database.js";
import { getUserFromRequest } from "../auth_utils.js";

export default function metadataRoutes(db: Database): Router {
  const router = Router();

  const isGlobalAdmin = (user: any) => user?.role === 'admin' && !user?.school;
  const isDirector = (user: any) => user?.role === 'director' && !!user?.school;

  router.get('/categories', (_req, res) => {
    const rows = queryAll(db, 'SELECT id, key, label FROM message_categories ORDER BY label COLLATE NOCASE');
    res.json(rows.map((row) => ({ id: String(row.id), key: row.key, label: row.label })));
  });

  router.post('/categories', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!isGlobalAdmin(user)) return res.status(403).json({ error: 'Нямате достъп до настройките на категориите.' });

    const { key, label } = req.body;
    if (!key || !label) return res.status(400).json({ error: 'Ключът и етикетът са задължителни.' });

    const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, '_');
    const result = execute(db, 'INSERT INTO message_categories (key, label) VALUES (?, ?)', [normalizedKey, String(label).trim()]);
    res.status(201).json({ id: String(result.lastId) });
  });

  router.put('/categories/:id', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!isGlobalAdmin(user)) return res.status(403).json({ error: 'Нямате достъп до настройките на категориите.' });

    const existing = queryOne(db, 'SELECT * FROM message_categories WHERE id = ?', [Number(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Категорията не е намерена.' });

    const nextKey = req.body.key ? String(req.body.key).trim().toLowerCase().replace(/\s+/g, '_') : existing.key;
    const nextLabel = req.body.label ? String(req.body.label).trim() : existing.label;
    execute(db, 'UPDATE message_categories SET key = ?, label = ? WHERE id = ?', [nextKey, nextLabel, Number(req.params.id)]);
    execute(db, 'UPDATE messages SET category = ? WHERE category = ?', [nextKey, existing.key]);
    res.json({ message: 'Категорията е обновена.' });
  });

  router.delete('/categories/:id', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!isGlobalAdmin(user)) return res.status(403).json({ error: 'Нямате достъп до настройките на категориите.' });

    const existing = queryOne(db, 'SELECT * FROM message_categories WHERE id = ?', [Number(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Категорията не е намерена.' });
    if (['system', 'general', 'administrative', 'academic', 'personal'].includes(existing.key)) {
      return res.status(400).json({ error: 'Базовите категории не могат да се изтриват.' });
    }

    const usage = queryOne(db, 'SELECT COUNT(*) AS count FROM messages WHERE category = ?', [existing.key]);
    if (Number(usage?.count || 0) > 0) {
      return res.status(400).json({ error: 'Категорията не може да бъде изтрита, защото вече се използва в съобщения.' });
    }

    execute(db, 'DELETE FROM message_categories WHERE id = ?', [Number(req.params.id)]);
    res.json({ message: 'Категорията е изтрита.' });
  });

  router.get('/classes', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: 'Неавторизиран достъп.' });

    const requestedSchool = typeof req.query.school === 'string' ? req.query.school : '';
    const school = isGlobalAdmin(user) ? requestedSchool : user.school;

    let rows;
    if (school) {
      rows = queryAll(db, 'SELECT id, school, name FROM school_classes WHERE school = ? ORDER BY name COLLATE NOCASE', [school]);
    } else {
      rows = queryAll(db, 'SELECT id, school, name FROM school_classes ORDER BY school COLLATE NOCASE, name COLLATE NOCASE');
    }
    res.json(rows.map((row) => ({ id: String(row.id), school: row.school, name: row.name })));
  });

  router.post('/classes', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user || (!isGlobalAdmin(user) && !isDirector(user))) return res.status(403).json({ error: 'Нямате право да създавате класове.' });

    const school = isGlobalAdmin(user) ? String(req.body.school || '').trim() : user.school;
    const name = String(req.body.name || '').trim();
    if (!school || !name) return res.status(400).json({ error: 'Училището и името на класа са задължителни.' });

    const result = execute(db, 'INSERT INTO school_classes (school, name) VALUES (?, ?)', [school, name]);

    // Одит: административна промяна при създаване на клас
    execute(db,
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
       VALUES ('Административна промяна', ?, 'class', ?, ?, ?)`,
      [user.id, String(result.lastId), `Създаден клас "${name}" за ${school}`, JSON.stringify({ id: String(result.lastId), name, school })]
    );

    res.status(201).json({ id: String(result.lastId) });
  });

  // ─── GET /classes/:id/preview ───────────────────────────────────────
  // Връща информация за потребителите, които ще бъдат засегнати при изтриване
  router.get('/classes/:id/preview', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user || (!isGlobalAdmin(user) && !isDirector(user))) return res.status(403).json({ error: 'Нямате право.' });

    const existing = queryOne(db, 'SELECT * FROM school_classes WHERE id = ?', [Number(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Класът не е намерен.' });
    if (isDirector(user) && existing.school !== user.school) return res.status(403).json({ error: 'Нямате право.' });

    // Ученици от този клас
    const students = queryAll(db,
      `SELECT id, first_name, last_name, email FROM users WHERE school = ? AND class = ? AND role = 'student'`,
      [existing.school, existing.name]
    );

    // Класни ръководители (teacher_type = 'class' и клас = текущия)
    const classTeachers = queryAll(db,
      `SELECT id, first_name, last_name, email FROM users WHERE school = ? AND class = ? AND role = 'teacher' AND teacher_type = 'class'`,
      [existing.school, existing.name]
    );

    // Брой съобщения от учениците
    const studentIds = students.map((s: any) => s.id);
    let messagesCount = 0;
    let commentsCount = 0;
    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',');
      const msgResult = queryOne(db, `SELECT COUNT(*) AS cnt FROM messages WHERE author_id IN (${placeholders})`, studentIds);
      messagesCount = Number(msgResult?.cnt || 0);
      const cmtResult = queryOne(db, `SELECT COUNT(*) AS cnt FROM comments WHERE author_id IN (${placeholders})`, studentIds);
      commentsCount = Number(cmtResult?.cnt || 0);
    }

    res.json({
      className: existing.name,
      school: existing.school,
      studentsCount: students.length,
      students: students.map((s: any) => ({ id: String(s.id), name: `${s.first_name} ${s.last_name}`, email: s.email })),
      classTeachersCount: classTeachers.length,
      classTeachers: classTeachers.map((t: any) => ({ id: String(t.id), name: `${t.first_name} ${t.last_name}`, email: t.email })),
      messagesCount,
      commentsCount,
    });
  });

  // ─── DELETE /classes/:id ──────────────────────────────────────────────
  // Каскадно изтриване: премахва всички ученици и свързаните им данни.
  // Класните ръководители НЕ се изтриват – стават редовни учители без клас.
  router.delete('/classes/:id', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user || (!isGlobalAdmin(user) && !isDirector(user))) return res.status(403).json({ error: 'Нямате право да изтривате класове.' });

    const existing = queryOne(db, 'SELECT * FROM school_classes WHERE id = ?', [Number(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Класът не е намерен.' });
    if (isDirector(user) && existing.school !== user.school) return res.status(403).json({ error: 'Нямате право да изтривате класове от друго училище.' });

    const className = existing.name;
    const school = existing.school;

    // 1) Намираме всички ученици от този клас
    const students = queryAll(db,
      `SELECT id, first_name, last_name FROM users WHERE school = ? AND class = ? AND role = 'student'`,
      [school, className]
    );
    const studentIds = students.map((s: any) => s.id);

    // 2) Каскадно изтриване на данните на всеки ученик
    for (const studentId of studentIds) {
      // Прикачени файлове към съобщения на ученика
      execute(db, `DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE author_id = ?)`, [studentId]);
      // Прикачени файлове към коментари на ученика
      execute(db, `DELETE FROM attachments WHERE comment_id IN (SELECT id FROM comments WHERE author_id = ?)`, [studentId]);
      // Редакции на съобщения
      execute(db, `DELETE FROM message_edits WHERE message_id IN (SELECT id FROM messages WHERE author_id = ?)`, [studentId]);
      execute(db, `DELETE FROM message_edits WHERE edited_by = ?`, [studentId]);
      // Коментари (от ученика)
      execute(db, `DELETE FROM comments WHERE author_id = ?`, [studentId]);
      // Read-статуси
      execute(db, `DELETE FROM read_statuses WHERE user_id = ?`, [studentId]);
      execute(db, `DELETE FROM read_statuses WHERE message_id IN (SELECT id FROM messages WHERE author_id = ?)`, [studentId]);
      // Уведомления
      execute(db, `DELETE FROM notifications WHERE user_id = ?`, [studentId]);
      execute(db, `DELETE FROM notifications WHERE message_id IN (SELECT id FROM messages WHERE author_id = ?)`, [studentId]);
      // Лични архиви
      execute(db, `DELETE FROM personal_archives WHERE user_id = ?`, [studentId]);
      execute(db, `DELETE FROM personal_archives WHERE message_id IN (SELECT id FROM messages WHERE author_id = ?)`, [studentId]);
      // Настройки за уведомления
      execute(db, `DELETE FROM notification_settings WHERE user_id = ?`, [studentId]);
      // Журнал (записи извършени от ученика)
      execute(db, `DELETE FROM audit_log WHERE performed_by = ?`, [studentId]);
      // Съобщения (самите съобщения на ученика)
      execute(db, `DELETE FROM messages WHERE author_id = ?`, [studentId]);
      // Накрая — потребителският профил
      execute(db, `DELETE FROM users WHERE id = ?`, [studentId]);
    }

    // 3) Класните ръководители → стават редовни учители без клас
    const classTeachers = queryAll(db,
      `SELECT id, first_name, last_name FROM users WHERE school = ? AND class = ? AND role = 'teacher' AND teacher_type = 'class'`,
      [school, className]
    );
    for (const teacher of classTeachers) {
      execute(db, `UPDATE users SET teacher_type = 'regular', class = NULL, pending_teacher_type = NULL, pending_class = NULL WHERE id = ?`, [teacher.id]);
    }

    // 4) Обикновени учители, които просто имат този клас зададен — премахваме класа
    execute(db, `UPDATE users SET class = NULL WHERE school = ? AND class = ? AND role = 'teacher' AND teacher_type != 'class'`, [school, className]);

    // 5) Изтриване на самия клас
    execute(db, 'DELETE FROM school_classes WHERE id = ?', [Number(req.params.id)]);

    // 6) Одит
    const deletedStudentNames = students.map((s: any) => `${s.first_name} ${s.last_name}`).join(', ');
    const demotedTeacherNames = classTeachers.map((t: any) => `${t.first_name} ${t.last_name}`).join(', ');
    const detailParts = [`Изтрит клас "${className}" от ${school}`];
    if (students.length > 0) detailParts.push(`Изтрити ${students.length} ученика: ${deletedStudentNames}`);
    if (classTeachers.length > 0) detailParts.push(`Класни ръководители преназначени: ${demotedTeacherNames}`);

    execute(db,
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
       VALUES ('Административна промяна', ?, 'class', ?, ?, ?)`,
      [user.id, String(req.params.id), detailParts.join('. '), JSON.stringify({ id: String(req.params.id), name: className, school })]
    );

    res.json({
      message: 'Класът е изтрит.',
      deletedStudents: students.length,
      demotedTeachers: classTeachers.length,
    });
  });

  router.get('/system-info', (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user || (!isGlobalAdmin(user) && !isDirector(user))) return res.status(403).json({ error: 'Нямате достъп.' });

    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      // metadata.ts is in server/routes/
      const dbPath = path.join(__dirname, "..", "data", "school.db");
      
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const sizeInKB = Math.round(stats.size / 1024);
        res.json({ dbSizeKB: sizeInKB });
      } else {
        res.json({ dbSizeKB: 0 });
      }
    } catch (e) {
      console.error('System info error:', e);
      res.status(500).json({ error: 'Грешка при четене на информация за системата.' });
    }
  });

  return router;
}
