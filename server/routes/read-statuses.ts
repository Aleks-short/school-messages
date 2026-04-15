import { Router } from "express";
import type { Database } from "sql.js";
import { queryAll, queryOne, execute, formatSQLiteDate } from "../database.js";

export default function readStatusRoutes(db: Database): Router {
  const router = Router();

  // ─── GET /api/read-statuses/user/:userId ─────────────────────────
  router.get("/user/:userId", (req, res) => {
    const rows = queryAll(db,
      `SELECT message_id, user_id, read_at, confirmed FROM read_statuses WHERE user_id = ?`,
      [Number(req.params.userId)]
    );

    res.json(rows.map((r) => ({
      messageId: String(r.message_id),
      userId: String(r.user_id),
      readAt: formatSQLiteDate(r.read_at),
      confirmed: !!r.confirmed,
    })));
  });

  // ─── GET /api/read-statuses/:messageId ────────────────────────────
  router.get("/:messageId", (req, res) => {
    const rows = queryAll(db,
      `SELECT rs.*, u.first_name || ' ' || u.last_name AS user_name
       FROM read_statuses rs JOIN users u ON rs.user_id = u.id
       WHERE rs.message_id = ? ORDER BY rs.read_at DESC`,
      [Number(req.params.messageId)]
    );

    res.json(rows.map((r) => ({
      messageId: String(r.message_id),
      userId: String(r.user_id),
      userName: r.user_name,
      readAt: formatSQLiteDate(r.read_at),
      confirmed: !!r.confirmed,
    })));
  });

  // ─── POST /api/read-statuses ──────────────────────────────────────
  router.post("/", (req, res) => {
    const { messageId, userId } = req.body;

    if (!messageId || !userId) {
      return res.status(400).json({ error: "messageId и userId са задължителни." });
    }

    // Проверка за дубликат
    const existing = queryOne(db,
      "SELECT id FROM read_statuses WHERE message_id = ? AND user_id = ?",
      [messageId, userId]
    );

    if (existing) {
      return res.status(200).json({ message: "Вече е маркирано като прочетено." });
    }

    execute(db,
      `INSERT INTO read_statuses (message_id, user_id) VALUES (?, ?)`,
      [messageId, userId]
    );

    res.status(201).json({ message: "Статусът за прочитане е записан." });
  });

  // ─── POST /api/read-statuses/mark-all ────────────────────────────
  router.post("/mark-all", (req, res) => {
    const { messageIds, userId } = req.body;

    if (!userId || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: "userId и messageIds са задължителни." });
    }

    for (const messageId of messageIds) {
      const existing = queryOne(db,
        "SELECT id FROM read_statuses WHERE message_id = ? AND user_id = ?",
        [messageId, userId]
      );
      if (!existing) {
        execute(db,
          `INSERT INTO read_statuses (message_id, user_id) VALUES (?, ?)`,
          [messageId, userId]
        );
      }
    }

    res.json({ message: "Всички съобщения са маркирани като прочетени." });
  });

  // ─── PUT /api/read-statuses/:messageId/:userId/confirm ────────────
  router.put("/:messageId/:userId/confirm", (req, res) => {
    const result = execute(db,
      `UPDATE read_statuses SET confirmed = 1 WHERE message_id = ? AND user_id = ?`,
      [Number(req.params.messageId), Number(req.params.userId)]
    );

    if (result.changes === 0) return res.status(404).json({ error: "Няма записан статус за прочитане." });
    res.json({ message: "Потвърдено." });
  });

  return router;
}
