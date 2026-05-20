import express from "express";
import cors from "cors";
import { initDatabase, runReminderJob } from "./database.js";

// ─── Маршрути ───────────────────────────────────────────────────────
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import messageRoutes from "./routes/messages.js";
import notificationRoutes from "./routes/notifications.js";
import readStatusRoutes from "./routes/read-statuses.js";
import auditRoutes from "./routes/audit.js";
import uploadRoutes from "./routes/uploads.js";
import metadataRoutes from "./routes/metadata.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = "uploads";
const uploadDir = path.join(__dirname, UPLOADS_DIR);

// ─── Стартиране ─────────────────────────────────────────────────────
async function main() {
  const app = express();
  const PORT = 3001;

  app.use(cors());
  app.use(express.json());

  const db = await initDatabase();

  // Стартиране на периодична задача за напомняния (на всеки 30 секунди)
  setInterval(() => {
    runReminderJob(db);
  }, 30000);

  // ─── Регистрация на маршрути ────────────────────────────────────
  app.use("/api/auth", authRoutes(db));
  app.use("/api/users", userRoutes(db));
  app.use("/api/messages", messageRoutes(db));
  app.use("/api/notifications", notificationRoutes(db));
  app.use("/api/read-statuses", readStatusRoutes(db));
  app.use("/api/audit-log", auditRoutes(db));
  app.use("/api/uploads", uploadRoutes());
  app.use("/api/metadata", metadataRoutes(db));

  // Статични файлове за качените прикачени файлове
  app.use(`/${UPLOADS_DIR}`, express.static(uploadDir));

  app.listen(PORT, () => {
    console.log(`🚀 Сървърът работи на http://localhost:${PORT}`);
  });
}

main().catch(console.error);
