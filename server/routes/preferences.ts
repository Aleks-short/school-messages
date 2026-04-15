import { Router } from "express";
import type { Database } from "sql.js";
import { queryOne, execute } from "../database.js";
import { getUserFromRequest } from "../auth_utils.js";

export default function preferenceRoutes(db: Database): Router {
  const router = Router();

  // ─── GET /api/preferences/:userId ──────────────────────────────────
  router.get("/:userId", (req, res) => {
    const userId = Number(req.params.userId);
    const row = queryOne(db, "SELECT * FROM user_preferences WHERE user_id = ?", [userId]);
    
    if (!row) {
      // Create default preferences if they don't exist
      execute(db, "INSERT INTO user_preferences (user_id) VALUES (?)", [userId]);
      const newRow = queryOne(db, "SELECT * FROM user_preferences WHERE user_id = ?", [userId]);
      return res.json(mapPreferences(newRow));
    }
    
    res.json(mapPreferences(row));
  });

  // ─── PATCH /api/preferences/:userId ────────────────────────────────
  router.patch("/:userId", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });
    
    const userId = Number(req.params.userId);
    if (user.id !== userId) return res.status(403).json({ error: "Нямате право да променяте тези настройки." });

    const { theme, dashboardActivityPage } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (theme !== undefined) {
      updates.push("theme = ?");
      params.push(theme);
    }
    if (dashboardActivityPage !== undefined) {
      updates.push("dashboard_activity_page = ?");
      params.push(Number(dashboardActivityPage));
    }

    if (updates.length === 0) return res.json({ message: "Няма промени." });

    params.push(userId);
    const sql = `UPDATE user_preferences SET ${updates.join(", ")} WHERE user_id = ?`;
    
    // Ensure row exists before update
    const existing = queryOne(db, "SELECT user_id FROM user_preferences WHERE user_id = ?", [userId]);
    if (!existing) {
      execute(db, "INSERT INTO user_preferences (user_id) VALUES (?)", [userId]);
    }

    execute(db, sql, params);
    res.json({ message: "Настройките са обновени." });
  });

  return router;
}

function mapPreferences(row: any) {
  return {
    userId: String(row.user_id),
    theme: row.theme,
    dashboardActivityPage: row.dashboard_activity_page
  };
}
