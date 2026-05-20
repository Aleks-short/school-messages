import { Router } from "express";
import type { Database } from "sql.js";
import { queryAll, queryOne, formatSQLiteDate } from "../database.js";
import { getUserFromRequest } from "../auth_utils.js";

export default function auditRoutes(db: Database): Router {
  const router = Router();

  // ─── GET /api/audit-log ───────────────────────────────────────────
  router.get("/", (req, res) => {
    const { targetType, limit } = req.query;
    const currentUser = getUserFromRequest(db, req);
    if (!currentUser) return res.status(401).json({ error: "Неавторизиран достъп." });

    let sql = `
      SELECT al.*, u.first_name || ' ' || u.last_name AS performed_by_name, u.school AS performed_by_school
      FROM audit_log al JOIN users u ON al.performed_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    const isGlobalAdmin = currentUser.role === 'admin' && !currentUser.school;
    if (!isGlobalAdmin) {
      sql += " AND u.school = ?";
      params.push(currentUser.school);
    }

    if (targetType) {
      sql += " AND al.target_type = ?";
      params.push(targetType);
    }

    sql += " ORDER BY al.created_at DESC, al.id ASC";

    if (limit) {
      sql += " LIMIT ?";
      params.push(Number(limit));
    }

    const rows = queryAll(db, sql, params).filter((row) => !isNoopMessageEditAudit(row));

    res.json(rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      performedBy: String(r.performed_by),
      performedByName: r.performed_by_name,
      performedBySchool: r.performed_by_school ?? undefined,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      targetData: getAuditTargetData(db, r),
      createdAt: formatSQLiteDate(r.created_at),
    })));
  });

  // ─── DELETE /api/audit-log/:id ────────────────────────────────────
  router.delete("/:id", (req, res) => {
    const { id } = req.params;
    const currentUser = getUserFromRequest(db, req);
    if (!currentUser) return res.status(401).json({ error: "Неавторизиран достъп." });

    db.run("DELETE FROM audit_log WHERE id = ?", [id]);
    res.json({ message: "Записът е изтрит." });
  });

  return router;
}

function isNoopMessageEditAudit(row: any) {
  if (row.action !== 'Редакция на съобщение' || row.target_type !== 'message' || !row.target_data) return false;
  try {
    const parsed = JSON.parse(row.target_data);
    const changes = parsed?.changes;
    return changes && Object.keys(changes).length === 0;
  } catch {
    return false;
  }
}

function getAuditTargetData(db: Database, row: any) {
  if (row.target_type === 'comment') return getCommentAuditTargetData(db, row);
  if (row.target_type !== 'message') return row.target_data;

  const messageExists = Boolean(queryOne(db, "SELECT id FROM messages WHERE id = ?", [Number(row.target_id)]));
  if (row.target_data) {
    try {
      return JSON.stringify({ ...JSON.parse(row.target_data), messageExists });
    } catch {
      return row.target_data;
    }
  }

  return getMessageSnapshotData(db, row, messageExists);
}

function getCommentAuditTargetData(db: Database, row: any) {
  const comment = queryOne(db,
    `SELECT c.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school, m.title AS message_title
     FROM comments c
     JOIN users u ON c.author_id = u.id
     JOIN messages m ON c.message_id = m.id
     WHERE c.id = ?`,
    [Number(row.target_id)]
  );
  const commentExists = Boolean(comment);
  const messageExists = comment ? Boolean(queryOne(db, "SELECT id FROM messages WHERE id = ?", [Number(comment.message_id)])) : false;

  if (row.target_data) {
    try {
      const parsed = JSON.parse(row.target_data);
      const snapshotMessageExists = parsed.messageId
        ? Boolean(queryOne(db, "SELECT id FROM messages WHERE id = ?", [Number(parsed.messageId)]))
        : messageExists;
      return JSON.stringify({ ...parsed, commentExists, messageExists: snapshotMessageExists });
    } catch {
      return row.target_data;
    }
  }

  if (!comment) return null;

  return JSON.stringify({
    commentExists,
    messageExists,
    id: String(comment.id),
    messageId: String(comment.message_id),
    messageTitle: comment.message_title,
    authorId: String(comment.author_id),
    authorName: comment.author_name,
    authorRole: comment.author_role,
    authorSchool: comment.author_school,
    content: comment.content,
    links: comment.links ? JSON.parse(comment.links) : [],
    createdAt: formatSQLiteDate(comment.created_at),
  });
}

function getMessageSnapshotData(db: Database, row: any, messageExists: boolean) {
  if (row.target_type !== 'message') return null;

  const message = queryOne(db,
    `SELECT m.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school
     FROM messages m JOIN users u ON m.author_id = u.id
     WHERE m.id = ?`,
    [Number(row.target_id)]
  );

  if (!message) return null;

  return JSON.stringify({
    messageExists,
    id: String(message.id),
    title: message.title,
    content: message.content,
    category: message.category,
    status: message.status,
    importance: message.importance,
    targetAudience: message.target_audience,
    authorId: String(message.author_id),
    authorName: message.author_name,
    authorRole: message.author_role,
    authorSchool: message.author_school,
    createdAt: formatSQLiteDate(message.created_at),
    updatedAt: formatSQLiteDate(message.updated_at),
  });
}
