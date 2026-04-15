import { Router } from "express";
import type { Database } from "sql.js";
import { queryAll, formatSQLiteDate } from "../database.js";
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

    sql += " ORDER BY al.created_at DESC";

    if (limit) {
      sql += " LIMIT ?";
      params.push(Number(limit));
    }

    const rows = queryAll(db, sql, params);

    res.json(rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      performedBy: String(r.performed_by),
      performedByName: r.performed_by_name,
      performedBySchool: r.performed_by_school ?? undefined,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      targetData: r.target_data,
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
