import { Router } from "express";
import type { Database } from "sql.js";
import { queryAll, queryOne, execute, formatSQLiteDate } from "../database.js";

export default function notificationRoutes(db: Database): Router {
  const router = Router();

  // ─── GET /api/notifications/:userId ───────────────────────────────
  router.get("/:userId", (req, res) => {
    const rows = queryAll(db,
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
      [Number(req.params.userId)]
    );

    res.json(rows.map(mapNotification));
  });

  // ─── PUT /api/notifications/:id/read ──────────────────────────────
  router.put("/:id/read", (req, res) => {
    const result = execute(db, "UPDATE notifications SET read = 1 WHERE id = ?", [Number(req.params.id)]);
    if (result.changes === 0) return res.status(404).json({ error: "Уведомлението не е намерено." });
    res.json({ message: "Уведомлението е маркирано като прочетено." });
  });

  // ─── PUT /api/notifications/:userId/read-all ──────────────────────
  router.put("/:userId/read-all", (req, res) => {
    execute(db, "UPDATE notifications SET read = 1 WHERE user_id = ?", [Number(req.params.userId)]);
    res.json({ message: "Всички уведомления са маркирани като прочетени." });
  });

  // ─── PUT /api/notifications/:userId/read-by-message/:messageId ──────
  router.put("/:userId/read-by-message/:messageId", (req, res) => {
    execute(db, "UPDATE notifications SET read = 1 WHERE user_id = ? AND message_id = ?", [Number(req.params.userId), Number(req.params.messageId)]);
    res.json({ message: "Уведомленията за съобщението са маркирани като прочетени." });
  });

  // ─── DELETE /api/notifications/:id ────────────────────────────────
  router.delete("/:id", (req, res) => {
    const result = execute(db, "DELETE FROM notifications WHERE id = ?", [Number(req.params.id)]);
    if (result.changes === 0) return res.status(404).json({ error: "Уведомлението не е намерено." });
    res.json({ message: "Уведомлението е изтрито." });
  });

  // ─── POST /api/notifications/delete-multiple ──────────────────────
  router.post("/delete-multiple", (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Невалидни данни. Очаква се масив от ID-та." });

    for (const id of ids) {
      execute(db, "DELETE FROM notifications WHERE id = ?", [Number(id)]);
    }

    res.json({ message: `${ids.length} уведомления бяха изтрити успешно.` });
  });

  // ─── GET /api/notifications/settings/:userId ──────────────────────
  router.get("/settings/:userId", (req, res) => {
    const row = queryOne(db, "SELECT * FROM notification_settings WHERE user_id = ?", [Number(req.params.userId)]);
    if (!row) {
      // Create default settings if not exists
      execute(db, "INSERT INTO notification_settings (user_id) VALUES (?)", [Number(req.params.userId)]);
      return res.json({
        userId: String(req.params.userId),
        newMessage: true,
        editedMessage: true,
        newComment: true,
        reminder: true
      });
    }
    res.json({
      userId: String(row.user_id),
      newMessage: !!row.new_message,
      editedMessage: !!row.edited_message,
      newComment: !!row.new_comment,
      reminder: !!row.reminder
    });
  });

  // ─── PUT /api/notifications/settings/:userId ──────────────────────
  router.put("/settings/:userId", (req, res) => {
    const { newMessage, editedMessage, newComment, reminder } = req.body;
    execute(db, 
      `UPDATE notification_settings 
       SET new_message = ?, edited_message = ?, new_comment = ?, reminder = ?
       WHERE user_id = ?`,
      [newMessage ? 1 : 0, editedMessage ? 1 : 0, newComment ? 1 : 0, reminder ? 1 : 0, Number(req.params.userId)]
    );
    res.json({ message: "Настройките са запазени." });
  });

  return router;
}

// ─── Помощна функция ────────────────────────────────────────────────

function mapNotification(row: any) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type,
    messageId: String(row.message_id),
    messageTitle: row.message_title,
    text: row.text,
    read: !!row.read,
    createdAt: formatSQLiteDate(row.created_at),
  };
}
