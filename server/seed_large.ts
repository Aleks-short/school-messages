import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data", "school.db");

// --- Configuration ---
const SCHOOLS = [
  "СУ \"Христо Ботев\"",
  "Професионална гимназия по компютърни науки и математически анализи „Проф. Минко Балкански“"
];

const SUBJECTS = [
  "Математика",
  "Български език и литература",
  "История",
  "География",
  "Биология",
  "Физика",
  "Химия",
  "Информационни технологии",
  "Физкултура",
  "Философия",
  "Английски език",
  "Програмиране"
];

const CLASSES = ["8А", "9А", "10А", "11А"];
const STUDENTS_PER_CLASS = 26;
const TEACHERS_PER_SUBJECT = 2;
const DEFAULT_PASSWORD = "password123";

// --- Name Data ---
const MALE_FIRST_NAMES = ["Иван", "Петър", "Георги", "Димитър", "Николай", "Стефан", "Христо", "Йордан", "Тодор", "Стоян", "Васил", "Ангел", "Мартин", "Александър", "Виктор", "Калоян"];
const FEMALE_FIRST_NAMES = ["Мария", "Иванка", "Елена", "Йорданка", "Пенка", "Росица", "Петя", "Десислава", "Гергана", "Силвия", "Милена", "Надежда", "Теодора", "Радослава", "Виктория"];
const LAST_NAME_ROOTS = ["Петров", "Иванов", "Димитров", "Георгиев", "Николов", "Стоянов", "Колев", "Маринов", "Тодоров", "Ангелов", "Василев", "Младенов"];

function generateName(gender: 'male' | 'female') {
  const firstNames = gender === 'male' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastNameRoot = LAST_NAME_ROOTS[Math.floor(Math.random() * LAST_NAME_ROOTS.length)];

  let lastName = lastNameRoot;
  if (gender === 'female') {
    if (lastName.endsWith('ов')) lastName = lastName.replace('ов', 'ова');
    else if (lastName.endsWith('ев')) lastName = lastName.replace('ев', 'ева');
    else lastName += 'а';
  }

  return { firstName, lastName };
}

function getRandomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date: Date) {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z',
  'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
  'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'sht', 'ъ': 'a', 'ь': 'y', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ж': 'ZH', 'З': 'Z',
  'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P',
  'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'TS', 'Ч': 'CH',
  'Ш': 'SH', 'Щ': 'SHT', 'Ъ': 'A', 'Ь': 'Y', 'Ю': 'YU', 'Я': 'YA'
};

function transliterate(text: string): string {
  return text.split('').map(char => CYRILLIC_TO_LATIN[char] || char).join('').toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

const START_DATE = new Date("2026-01-01T00:00:00");
const END_DATE = new Date(); // Today

export async function seed(db: any) {
  console.log("🚀 Starting large-scale seeding...");

  // Clear existing data (optional but recommended for a clean seed as requested)
  console.log("🧹 Clearing existing data...");
  db.run("DELETE FROM read_statuses");
  db.run("DELETE FROM notifications");
  db.run("DELETE FROM notification_settings");
  db.run("DELETE FROM audit_log");
  db.run("DELETE FROM comments");
  db.run("DELETE FROM attachments");
  db.run("DELETE FROM messages");
  db.run("DELETE FROM users");

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // 1. Create Admin
  console.log("👤 Creating Admin...");
  db.run(`INSERT INTO users (email, password, first_name, last_name, role, school, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["admin@school.bg", hashedPassword, "Иван", "Петров", "admin", "", formatDate(START_DATE)]);
  const adminId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  db.run(`INSERT INTO notification_settings (user_id) VALUES (?)`, [adminId]);

  const allUserIds: number[] = [];
  const schoolUsers: Record<string, number[]> = {};
  SCHOOLS.forEach(s => schoolUsers[s] = []);

  // 2. Create Users for each school
  SCHOOLS.forEach((school, schoolIndex) => {
    console.log(`🏫 Seeding school: ${school}...`);
    const schoolId = transliterate(school.split(' ')[0].substring(0, 5)) + schoolIndex;

    // Director
    const genderD = Math.random() > 0.5 ? 'male' : 'female';
    const { firstName: fnD, lastName: lnD } = generateName(genderD);
    const directorEmail = `director.${transliterate(lnD)}.${schoolId}@school.bg`;
    db.run(`INSERT INTO users (email, password, first_name, last_name, role, school, management_position, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [directorEmail, hashedPassword, fnD, lnD, 'director', school, 'director', formatDate(START_DATE)]);
    const dId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    db.run(`INSERT INTO notification_settings (user_id) VALUES (?)`, [dId]);
    schoolUsers[school].push(dId);
    allUserIds.push(dId);

    // Class Teachers (Класни ръководители)
    for (const className of CLASSES) {
      const genderT = Math.random() > 0.5 ? 'male' : 'female';
      const { firstName: fnT, lastName: lnT } = generateName(genderT);
      const email = `teacher.class.${transliterate(className)}.${schoolId}@school.bg`;
      const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
      db.run(`INSERT INTO users (email, password, first_name, last_name, role, school, subject, class, teacher_type, created_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [email, hashedPassword, fnT, lnT, 'teacher', school, subject, className, 'class', formatDate(START_DATE)]);
      const tId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
      db.run(`INSERT INTO notification_settings (user_id) VALUES (?)`, [tId]);
      schoolUsers[school].push(tId);
      allUserIds.push(tId);
    }

    // Regular Teachers
    for (const subject of SUBJECTS) {
      for (let i = 0; i < TEACHERS_PER_SUBJECT; i++) {
        const genderT = Math.random() > 0.5 ? 'male' : 'female';
        const { firstName: fnT, lastName: lnT } = generateName(genderT);
        const email = `teacher.${transliterate(subject)}.${i}.${schoolId}@school.bg`;
        db.run(`INSERT INTO users (email, password, first_name, last_name, role, school, subject, teacher_type, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [email, hashedPassword, fnT, lnT, 'teacher', school, subject, 'regular', formatDate(START_DATE)]);
        const tId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        db.run(`INSERT INTO notification_settings (user_id) VALUES (?)`, [tId]);
        schoolUsers[school].push(tId);
        allUserIds.push(tId);
      }
    }

    // Students
    for (const className of CLASSES) {
      for (let i = 1; i <= STUDENTS_PER_CLASS; i++) {
        const genderS = Math.random() > 0.5 ? 'male' : 'female';
        const { firstName: fnS, lastName: lnS } = generateName(genderS);
        const email = `student.${transliterate(className)}.${i}.${schoolId}@school.bg`;
        db.run(`INSERT INTO users (email, password, first_name, last_name, role, school, class, class_number, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [email, hashedPassword, fnS, lnS, 'student', school, className, i, formatDate(START_DATE)]);
        const sId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        db.run(`INSERT INTO notification_settings (user_id) VALUES (?)`, [sId]);
        schoolUsers[school].push(sId);
        allUserIds.push(sId);
      }
    }
  });

  // 3. Create Messages, Notifications, Activity
  console.log("📝 Generating messages and activity...");

  const categories = ['system', 'general', 'administrative', 'academic', 'personal'];
  const importance = ['low', 'normal', 'high'];
  const statuses = ['published', 'archived', 'draft'];

  const REAL_MESSAGES: Record<string, { title: string, content: string }[]> = {
    academic: [
      { title: "График за провеждане на НВО (10. клас)", content: "Публикуван е официалният график за Националното външно оценяване за учениците от 10. клас. Моля, запознайте се с датите и залите в прикачения файл." },
      { title: "Резултати от олимпиадата по математика", content: "Поздравяваме всички участници в областния кръг. Списъкът с класираните за национален кръг е наличен в архива на училището." },
      { title: "Допълнителни часове по БЕЛ", content: "Във връзка с подготовката за матурите, се организират допълнителни консултации всеки вторник от 14:30 ч. в кабинет 204." }
    ],
    administrative: [
      { title: "Промяна в седмичното разписание", content: "От следващия понеделник влиза в сила актуализирано седмично разписание поради кадрови промени. Моля, проверете промените за вашата паралелка." },
      { title: "Инструктаж за противопожарна безопасност", content: "Всички класове трябва да преминат през задължителен инструктаж в четвъртия учебен час. Присъствието е задължително." },
      { title: "Срок за подаване на заявления за стипендии", content: "Крайният срок за подаване на документи за социални и отлични стипендии е до 15-о число на текущия месец в канцеларията." }
    ],
    general: [
      { title: "Благотворителен базар „Да помогнем заедно“", content: "Каним всички ученици и родители да се включат в нашия пролетен базар. Събраните средства ще бъдат дарени за благотворителна кауза." },
      { title: "Предстоящ футболен турнир между класовете", content: "Записването на отборите при преподавателите по ФВС започва от сряда. Участват отбори от 8. до 12. клас. Очакваме ви!" },
      { title: "Училищен празник – 24 май", content: "Подготовката за тържественото честване започва! Учениците, желаещи да участват в празничната програма, да се явят в актовата зала." }
    ],
    system: [
      { title: "Профилактика на електронната платформа", content: "Системата ще бъде временно недостъпна тази събота между 22:00 и 02:00 ч. поради техническа поддръжка. Благодарим за разбирането." },
      { title: "Важно: Актуализация на изискванията за сигурност", content: "Моля, обновете своите данни за достъп съгласно новите изисквания за сигурност на платформата EduПоща." }
    ],
    personal: [
      { title: "Покана за индивидуална консултация", content: "Моля, заповядайте за обсъждане на текущия напредък и оценките в удобно за Вас и Вашите учители време." },
      { title: "Уведомление за отсъствия", content: "Информираме Ви за натрупан брой неизвинени отсъствия за съответния период. Очакваме писмено обяснение в срок." }
    ]
  };

  const COMMENT_TEMPLATES = [
    "Благодаря за информацията!",
    "Ще присъствам задължително.",
    "Може ли повече детайли относно часа?",
    "Разбрано, благодаря.",
    "Къде можем да намерим списъка със залите?",
    "Много добра инициатива!",
    "Ще предам на съучениците си."
  ];

  for (const school of SCHOOLS) {
    const usersInSchool = schoolUsers[school];
    const directors = usersInSchool.filter(id => {
      const u = db.exec(`SELECT role FROM users WHERE id = ${id}`)[0].values[0][0];
      return u === 'director';
    });
    const teachers = usersInSchool.filter(id => {
      const u = db.exec(`SELECT role FROM users WHERE id = ${id}`)[0].values[0][0];
      return u === 'teacher';
    });

    const posters = [...directors, ...teachers.slice(0, 8)];

    for (const posterId of posters) {
      const msgCount = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < msgCount; i++) {
        const date = getRandomDate(START_DATE, END_DATE);
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const imp = importance[Math.floor(Math.random() * importance.length)];

        const templates = REAL_MESSAGES[category] || REAL_MESSAGES['general'];
        const template = templates[Math.floor(Math.random() * templates.length)];

        const title = template.title + (status === 'draft' ? " (Чернова)" : "");
        const content = template.content;

        db.run(`INSERT INTO messages (title, content, category, status, importance, target_audience, author_id, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [title, content, category, status, imp, 'all', posterId, formatDate(date), formatDate(date)]);
        const msgId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

        db.run(`INSERT INTO audit_log (action, performed_by, target_type, target_id, details, created_at) 
                VALUES (?, ?, ?, ?, ?, ?)`,
          ['Публикуване на съобщение', posterId, 'message', String(msgId), `Публикувано съобщение "${title}"`, formatDate(date)]);

        if (status === 'published') {
          if (Math.random() > 0.4) {
            const types = [
              { name: 'график_изпити.pdf', type: 'application/pdf' },
              { name: 'qr_registration.png', type: 'image/png' },
              { name: 'снимка_събитие.jpg', type: 'image/jpeg' },
              { name: 'училищна_наредба.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
            ];
            const att = types[Math.floor(Math.random() * types.length)];
            db.run(`INSERT INTO attachments (message_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
              [msgId, att.name, 1024 * (50 + Math.floor(Math.random() * 500)), att.type, att.name]);
          }

          const commentators = usersInSchool.slice(0, 15);
          for (const commId of commentators) {
            if (commId === posterId) continue;
            if (Math.random() > 0.75) {
              const cDate = getRandomDate(date, END_DATE);
              const commentText = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
              db.run(`INSERT INTO comments (message_id, author_id, content, created_at) VALUES (?, ?, ?, ?)`,
                [msgId, commId, commentText, formatDate(cDate)]);

              db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, created_at) 
                        VALUES (?, 'new_comment', ?, ?, ?, ?)`,
                [posterId, msgId, title, `Нов коментар от потребител под "${title}"`, formatDate(cDate)]);
            }
          }

          const targetUsers = usersInSchool.slice(0, 40);
          for (const uId of targetUsers) {
            if (uId === posterId) continue;

            const nRead = Math.random() > 0.6 ? 1 : 0;
            const notificationTitle = imp === 'high' ? `ВАЖНО: ${title}` : `Ново съобщение: ${title}`;
            db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, read, created_at) 
                    VALUES (?, 'new_message', ?, ?, ?, ?, ?)`,
              [uId, msgId, title, notificationTitle, nRead, formatDate(date)]);

            if (Math.random() > 0.5) {
              const rDate = getRandomDate(date, END_DATE);
              const confirmed = imp === 'high' ? (Math.random() > 0.6 ? 1 : 0) : 0;
              db.run(`INSERT INTO read_statuses (message_id, user_id, read_at, confirmed) VALUES (?, ?, ?, ?)`,
                [msgId, uId, formatDate(rDate), confirmed]);
            }
          }
        }
      }
    }
  }

  // 4. Add Demo Audit Actions
  console.log("🛠️ Adding demo audit actions...");
  const demoActions = [
    ['Заявка за смяна типа на учителя', 'user', String(adminId), 'Потребителят заяви смяна на типа към: класен ръководител'],
    ['Промяна по профил', 'user', String(adminId), 'Промяна на телефонен номер и адрес'],
    ['Административна промяна', 'user', String(adminId), 'Директорът промени правата на потребителя'],
    ['Регистрация на потребител', 'user', String(adminId), 'Нов учител се регистрира в системата'],
    ['Създаване на клас', 'class', '1', 'Създаден е нов клас: 12Б'],
    ['Изтриване на клас', 'class', '2', 'Изтрит е клас: 11В'],
    ['Потвърждаване на важно съобщение', 'message', '1', 'Потребителят потвърди прочитането на съобщение #1']
  ];

  for (const [action, type, target, details] of demoActions) {
    db.run("INSERT INTO audit_log (action, performed_by, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [action, adminId, type, target, details, formatDate(END_DATE)]);
  }

  console.log("✅ Large-scale seeding inner logic complete!");
}
