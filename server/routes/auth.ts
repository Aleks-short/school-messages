import { Router } from "express";
import type { Database } from "sql.js";
import { queryOne, execute } from "../database.js";
import { signToken, verifyToken } from "../auth_utils.js";
import bcrypt from "bcryptjs";

export default function authRoutes(db: Database): Router {
  const router = Router();

  // ─── GET /api/auth/me ─────────────────────────────────────────────
  router.get("/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Невалидна сесия." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Сесията е изтекла." });
    }

    const user = queryOne(db,
      `SELECT id, email, first_name, last_name, role, registration_status, registration_review_note, registration_reviewed_at, school, class, avatar, subject, pending_subject, teacher_type, management_position
       FROM users WHERE id = ?`,
      [decoded.id]
    );

    if (!user) return res.status(404).json({ error: "Потребителят не е намерен." });

    res.json(mapUser(user));
  });

  // ─── POST /api/auth/login ─────────────────────────────────────────
  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Имейл и парола са задължителни." });
    }

    const user = queryOne(db,
      `SELECT id, email, password, first_name, last_name, role, registration_status, registration_review_note, registration_reviewed_at, school, class, avatar, subject, pending_subject, teacher_type, management_position
       FROM users WHERE email = ?`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: "Грешен имейл или парола." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Fallback for plain text passwords if they exist (unlikely in this project)
      if (password === user.password) {
         // handle
      } else {
         return res.status(401).json({ error: "Грешен имейл или парола." });
      }
    }

    const mappedUser = mapUser(user);
    const token = signToken({ id: Number(mappedUser.id) });

    // Одит: регистриране на успешен вход
    execute(db,
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details)
       VALUES ('Вход в системата', ?, 'user', ?, ?)`,
      [user.id, String(user.id), `${user.first_name} ${user.last_name} влезе в системата`]
    );

    res.json({ user: mappedUser, token });
  });

  return router;
}

function mapUser(user: any) {
  return {
    id: String(user.id),
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    registrationStatus: user.registration_status,
    registrationReviewNote: user.registration_review_note ?? undefined,
    registrationReviewedAt: user.registration_reviewed_at ?? undefined,
    school: user.school,
    class: user.class ?? undefined,
    avatar: user.avatar ?? undefined,
    subject: user.subject ?? undefined,
    pendingSubject: user.pending_subject ?? undefined,
    teacherType: user.teacher_type ?? undefined,
    managementPosition: user.management_position ?? undefined,
  };
}
