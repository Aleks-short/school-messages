import { Router } from "express";
import type { Database } from "sql.js";
import { queryAll, queryOne, execute } from "../database.js";
import { getUserFromRequest } from "../auth_utils.js";
import bcrypt from "bcryptjs";

export default function userRoutes(db: Database): Router {
  const router = Router();

  const isGlobalAdmin = (user: any) => user?.role === 'admin' && !user?.school;
  const isDirector = (user: any) => user?.role === 'director' && !!user?.school;

  const canDirectorManageTarget = (manager: any, target: any) => {
    if (!isDirector(manager) || !target) return false;
    return target.school === manager.school && ['teacher', 'student'].includes(target.role);
  };

  const canManageTarget = (manager: any, target: any) => isGlobalAdmin(manager) || canDirectorManageTarget(manager, target);

  const addAuditEntry = (performedBy: number, targetId: number, details: string, action: string = 'Управление на потребител', targetData?: string) => {
    execute(db,
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
       VALUES (?, ?, 'user', ?, ?, ?)`,
      [action, performedBy, String(targetId), details, targetData || null]
    );
  };

  const notifyAboutRegistrationAttempt = (role: string, school: string, fullName: string) => {
    const admins = queryAll(db, "SELECT id FROM users WHERE role = 'admin' AND (school IS NULL OR school = '')");
    for (const admin of admins) {
      execute(db,
        `INSERT INTO notifications (user_id, type, message_id, message_title, text)
         VALUES (?, 'new_message', 0, ?, ?)`,
        [admin.id, 'Нова регистрация', `Нов опит за регистрация: ${fullName} (${role})${school ? ` - ${school}` : ''}`]
      );
    }

    if (['teacher', 'student'].includes(role) && school) {
      const directors = queryAll(db, "SELECT id FROM users WHERE role = 'director' AND school = ? AND registration_status = 'approved'", [school]);
      for (const director of directors) {
        execute(db,
          `INSERT INTO notifications (user_id, type, message_id, message_title, text)
           VALUES (?, 'new_message', 0, ?, ?)`,
          [director.id, 'Нова регистрация във Вашето училище', `Нов опит за регистрация: ${fullName} (${role})`]
        );
      }
    }
  };

  // ─── GET /api/users ───────────────────────────────────────────────
  router.get("/", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });

    let sql = `SELECT id, email, first_name, last_name, role, registration_status, registration_review_note, registration_reviewed_at, school, class, pending_class, avatar, subject, pending_subject, teacher_type, pending_teacher_type, management_position, class_number
       FROM users WHERE 1=1`;
    const params: any[] = [];

    if (user && !isGlobalAdmin(user)) {
      sql += " AND school = ?";
      params.push(user.school);
    }

    sql += " ORDER BY id";
    const rows = queryAll(db, sql, params);
    res.json(rows.map(mapUser));
  });

  // ─── POST /api/users ──────────────────────────────────────────────
  router.post("/", async (req, res) => {
    const { email, password, firstName, lastName, role, school, class: cls, subject, teacherType, managementPosition } = req.body;

    if (!email || !password || !firstName || !lastName || !role || !school) {
      return res.status(400).json({ error: "Липсват задължителни полета." });
    }

    // Проверка за дубликат
    const existing = queryOne(db, "SELECT id FROM users WHERE email = ?", [email]);
    
    // По-строга проверка за съществуващ потребител
    if (existing && existing.id) {
      return res.status(409).json({ error: "Потребител с този имейл вече съществува." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const registrationStatus = ['director', 'teacher', 'student'].includes(role) ? 'pending' : 'approved';
    const approvedSubject = role === 'teacher' ? null : (subject ?? null);
    const pendingSubject = role === 'teacher' ? (subject ?? null) : null;

    const result = execute(db,
      `INSERT INTO users (email, password, first_name, last_name, role, registration_status, school, class, subject, pending_subject, teacher_type, management_position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, firstName, lastName, role, registrationStatus, school, cls ?? null, approvedSubject, pendingSubject, teacherType ?? null, managementPosition ?? null]
    );

    const userId = result.lastId as number;

    // Одит: регистриране на профил (опит за регистрация)
    execute(db,
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Регистриране на профил', userId, 'user', String(userId), `Нов потребител: ${firstName} ${lastName} (${email}), Роля: ${role}`, JSON.stringify({ id: String(userId), firstName, lastName, email, role, school })]
    );

    if (registrationStatus === 'pending') {
      notifyAboutRegistrationAttempt(role, school, `${firstName} ${lastName}`);
    }

    res.status(201).json({
      id: String(userId),
      message: registrationStatus === 'pending' ? 'Регистрацията е изпратена за одобрение.' : 'Потребителят е създаден.',
      registrationStatus,
    });
  });

  // ─── PUT /api/users/:id ───────────────────────────────────────────
  router.put("/:id", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });

    const targetId = Number(req.params.id);
    const targetUser = queryOne(db, "SELECT id, role, school, subject, teacher_type, class FROM users WHERE id = ?", [targetId]);
    if (!targetUser) return res.status(404).json({ error: "Потребителят не е намерен." });

    const canManageUsers = canManageTarget(user, targetUser);

    // Потребителят може да променя само своя профил, освен ако не е глобален админ
    if (!canManageUsers && user.id !== targetId) {
      return res.status(403).json({ error: "Нямате право да променяте този профил." });
    }

    const { firstName, lastName, role, school, class: cls, pendingClass, subject, pendingSubject, teacherType, pendingTeacherType, managementPosition, registrationStatus, registrationReviewNote } = req.body;
    
    // Динамично изграждане на заявката за обновяване
    const updates: string[] = [];
    const params: any[] = [];
    const changeLog: string[] = [];

    if (firstName !== undefined) { updates.push("first_name = ?"); params.push(firstName); }
    if (lastName !== undefined) { updates.push("last_name = ?"); params.push(lastName); }
    
    // Управление на роли/статуси според правата на текущия потребител.
    if (canManageUsers) {
      if (role !== undefined) {
        if (isDirector(user) && !['teacher', 'student'].includes(role)) {
          return res.status(403).json({ error: "Директорът може да задава само роли Учител и Ученик." });
        }
        updates.push("role = ?");
        params.push(role);
        const roleBg: Record<string, string> = { admin: 'администратор', director: 'директор', teacher: 'учител', student: 'ученик' };
        changeLog.push(`роля: ${roleBg[role] || role}`);
      }

      if (school !== undefined && isGlobalAdmin(user)) {
        updates.push("school = ?");
        params.push(school);
        changeLog.push(`училище: ${school}`);
      }

      if (cls !== undefined) {
        updates.push("class = ?");
        params.push(cls);
      }

      if (managementPosition !== undefined && isGlobalAdmin(user)) {
        updates.push("management_position = ?");
        params.push(managementPosition);
      }

      if (registrationStatus !== undefined) {
        updates.push("registration_status = ?");
        params.push(registrationStatus);
        updates.push("registration_reviewed_at = datetime('now')");
        
        if (registrationStatus === 'rejected') {
          updates.push("pending_subject = NULL");
          updates.push("pending_teacher_type = NULL");
          updates.push("pending_class = NULL");
        }

        const actionLabel = registrationStatus === 'rejected' ? 'Отказване на регистрация' : 'Промяна на статус';
        const statusBg: Record<string, string> = { pending: 'чакащ', approved: 'одобрен', rejected: 'отхвърлен' };
        changeLog.push(`${actionLabel}: ${statusBg[registrationStatus] || registrationStatus}`);
      }

      if (registrationReviewNote !== undefined) {
        updates.push("registration_review_note = ?");
        params.push(registrationReviewNote || null);
      }

      if (subject !== undefined) {
        updates.push("subject = ?");
        params.push(subject || null);
        changeLog.push(`предмети: ${subject || 'изчистени'}`);
      }

      if (pendingSubject !== undefined) {
        updates.push("pending_subject = ?");
        params.push(pendingSubject || null);
      }

      if (pendingTeacherType !== undefined) {
        updates.push("pending_teacher_type = ?");
        params.push(pendingTeacherType || null);
      }

      if (pendingClass !== undefined) {
        updates.push("pending_class = ?");
        params.push(pendingClass || null);
      }
    }

    // Предмет и тип учител могат да се променят от самия потребител или от управляващия го админ/директор.
    if (user.id === targetId || canManageUsers) {
      if (subject !== undefined && !(canManageUsers && targetUser.role === 'teacher')) {
        updates.push("subject = ?");
        params.push(subject);
      }

      if (pendingSubject !== undefined && !canManageUsers) {
        updates.push("pending_subject = ?");
        params.push(pendingSubject || null);
      }

      if (!canManageUsers && subject !== undefined && targetUser.role === 'teacher') {
        if (subject !== targetUser.subject) {
          updates.push("pending_subject = ?");
          params.push(subject || null);
        } else {
          // If they are sending the same subject as approved, clear any pending request
          updates.push("pending_subject = NULL");
        }
      }

      if (teacherType !== undefined) {
        if (canManageUsers) {
          updates.push("teacher_type = ?");
          params.push(teacherType);
          // If admin approves, clear pending and apply pending class if present
          updates.push("pending_teacher_type = NULL");
          
          if (teacherType === 'class' && targetUser.pending_class) {
              updates.push("class = ?");
              params.push(targetUser.pending_class);
              updates.push("pending_class = NULL");
          } else if (teacherType === 'regular') {
              updates.push("class = NULL");
              updates.push("pending_class = NULL");
          }

          changeLog.push(`тип учител: ${teacherType === 'class' ? 'класен ръководител' : 'редовен учител'}`);
        } else if (targetUser.role === 'teacher') {
          // Teacher updating themselves -> goes to pending
          if (teacherType !== targetUser.teacher_type) {
            updates.push("pending_teacher_type = ?");
            params.push(teacherType);
            
            if (teacherType === 'regular') {
                updates.push("pending_class = NULL");
            }
            changeLog.push(`заявка за промяна на тип учител: ${teacherType === 'class' ? 'класен ръководител' : 'редовен учител'}`);
          } else {
            // Already same type, clear pending request
            updates.push("pending_teacher_type = NULL");
            updates.push("pending_class = NULL");
          }
        } else {
          updates.push("teacher_type = ?");
          params.push(teacherType);
        }
      }

      if (cls !== undefined && !canManageUsers) {
          if (cls !== targetUser.class) {
            updates.push("pending_class = ?");
            params.push(cls || null);
          } else {
            updates.push("pending_class = NULL");
          }
      }
    }

    if (updates.length === 0) {
      return res.json({ message: "Няма промени за запис." });
    }

    params.push(targetId);
    const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    const result = execute(db, sql, params);

    if (result.changes === 0) return res.status(404).json({ error: "Потребителят не е намерен." });

    if (changeLog.length > 0) {
      const isSelfUpdate = user.id === targetId;
      const isTeacherRequest = isSelfUpdate && teacherType !== undefined && targetUser.role === 'teacher';
      
      const actionTitle = isTeacherRequest 
        ? 'Заявка за смяна типа на учителя' 
        : (isSelfUpdate ? 'Промяна по профил' : 'Административна промяна');

      addAuditEntry(user.id, targetId, changeLog.join(', '), actionTitle);
    }

    res.json({ message: "Потребителят е обновен успешно." });
  });

  // ─── PUT /api/users/:id/password ──────────────────────────────────
  router.put("/:id/password", async (req, res) => {
    const user = getUserFromRequest(db, req);
    const targetId = Number(req.params.id);

    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });
    const targetUser = queryOne(db, "SELECT id, role, school FROM users WHERE id = ?", [targetId]);
    if (!targetUser) return res.status(404).json({ error: "Потребителят не е намерен." });

    const canManageUsers = canManageTarget(user, targetUser);

    if (!canManageUsers && user.id !== targetId) {
      return res.status(403).json({ error: "Нямате право да променяте тази парола." });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Паролата трябва да е поне 6 символа." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = execute(db, "UPDATE users SET password = ? WHERE id = ?", [hashedPassword, targetId]);
    if (result.changes === 0) return res.status(404).json({ error: "Потребителят не е намерен." });

    // Одит: регистриране на промяна на парола (ПРЕМАХНАТО ПО ЖЕЛАНИЕ НА ПОТРЕБИТЕЛЯ)
    // const targetInfo = queryOne(db, "SELECT first_name, last_name FROM users WHERE id = ?", [targetId]);
    // const targetName = targetInfo ? `${targetInfo.first_name} ${targetInfo.last_name}` : String(targetId);
    // addAuditEntry(user.id, targetId, `Промяна на парола за ${targetName}${user.id !== targetId ? ' (от администратор)' : ''}`);
    
    res.json({ message: "Паролата е променена успешно." });
  });

  // ─── DELETE /api/users/:id ────────────────────────────────────────
  router.delete("/:id", (req, res) => {
    const user = getUserFromRequest(db, req);
    if (!user) return res.status(401).json({ error: "Неавторизиран достъп." });

    const targetId = Number(req.params.id);
    if (user.id === targetId) {
      return res.status(400).json({ error: "Не можете да изтриете собствения си профил." });
    }

    const targetUser = queryOne(db, "SELECT first_name, last_name, email, school, role FROM users WHERE id = ?", [targetId]);
    if (!targetUser) return res.status(404).json({ error: "Потребителят не е намерен." });

    const canDelete = isGlobalAdmin(user) || canDirectorManageTarget(user, targetUser);
    if (!canDelete) {
      return res.status(403).json({ error: "Нямате право да изтривате този потребител." });
    }

    const result = execute(db, "DELETE FROM users WHERE id = ?", [targetId]);
    if (result.changes === 0) return res.status(404).json({ error: "Потребителят не е намерен." });

    addAuditEntry(user.id, targetId, `Изтрит потребител: ${targetUser.first_name} ${targetUser.last_name} (${targetUser.email})`, 'Административна промяна', JSON.stringify({
      id: String(targetId),
      firstName: targetUser.first_name,
      lastName: targetUser.last_name,
      email: targetUser.email,
      role: targetUser.role,
      school: targetUser.school
    }));
    res.json({ message: "Потребителят е изтрит успешно." });
  });

  return router;
}

// ─── Помощна функция ────────────────────────────────────────────────

function mapUser(row: any) {
  return {
    id: String(row.id),
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    registrationStatus: row.registration_status,
    registrationReviewNote: row.registration_review_note ?? undefined,
    registrationReviewedAt: row.registration_reviewed_at ?? undefined,
    school: row.school,
    class: row.class ?? undefined,
    pendingClass: row.pending_class ?? undefined,
    avatar: row.avatar ?? undefined,
    subject: row.subject ?? undefined,
    pendingSubject: row.pending_subject ?? undefined,
    teacherType: row.teacher_type ?? undefined,
    pendingTeacherType: row.pending_teacher_type ?? undefined,
    managementPosition: row.management_position ?? undefined,
    classNumber: row.class_number ?? undefined,
  };
}
