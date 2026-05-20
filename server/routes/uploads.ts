import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR_NAME = "uploads";
const uploadDir = path.join(__dirname, "..", UPLOADS_DIR_NAME);

// Уверяваме се, че директорията съществува
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генерираме уникално име и оправяме енкодинга за кирилица
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp",
  // Videos
  "video/mp4", "video/webm", "video/x-msvideo",
  // Audio
  "audio/mpeg", "audio/wav", "audio/ogg",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  // Text
  "text/plain"
];

const fileFilter = (req: any, file: any, cb: any) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Неподдържан файлов формат. Разрешени са снимки, видеа, документи, архиви, аудио и текст."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB
  }
});

export default function uploadsRoutes() {
  const router = Router();

  router.post("/", (req, res) => {
    upload.array("files")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "Файлът е твърде голям. Максималният размер е 500 MB." });
        }
        return res.status(400).json({ error: `Грешка при качване: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        const files = (req.files as Express.Multer.File[]) || [];
        const results = files.map(file => {
          // Решаваме проблема с кодирането на кирилица (multer използва latin1 по подразбиране)
          const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          
          return {
            id: crypto.randomBytes(16).toString('hex'), // Генерираме временно ID за фронтенда
            name: safeName,
            size: file.size,
            type: file.mimetype,
            path: file.filename,
            url: `/${UPLOADS_DIR_NAME}/${file.filename}`
          };
        });

        res.json(results);
      } catch (err: any) {
        res.status(500).json({ error: "Грешка при обработка на файловете." });
      }
    });
  });

  return router;
}
