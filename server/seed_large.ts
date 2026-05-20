import bcrypt from "bcryptjs";

// --- Configuration ---
const SCHOOLS = [
  'СУ "Христо Ботев"',
  'Професионална гимназия по компютърни науки и математически анализи „Проф. Минко Балкански“'
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

const CLASSES_PER_SCHOOL = ["8А", "9А", "10А", "11А"];
const STUDENTS_PER_CLASS = 26;
const TEACHERS_PER_SCHOOL = 8; // 4 class + 4 regular
const DEFAULT_PASSWORD = "password123";

// --- Real upload files for attachments ---
const REAL_UPLOAD_FILES = [
  { name: "bg_school_messages.docx", size: 37584, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { name: "bg_school_messages.pdf", size: 50059, type: "application/pdf" },
  { name: "bg_school_messages.txt", size: 2645, type: "text/plain" },
  { name: "qr_bgmateriali.png", size: 438, type: "image/png" },
  { name: "qr_bgtest.png", size: 426, type: "image/png" },
  { name: "qr_pgknma.png", size: 440, type: "image/png" },
  { name: "qr_ucha_se.png", size: 405, type: "image/png" },
  { name: "school_message_art.png", size: 1150642, type: "image/png" },
  { name: "school_message_ui.png", size: 602900, type: "image/png" }
];

// --- Name Data ---
const MALE_FIRST_NAMES = ["Иван", "Петър", "Георги", "Димитър", "Николай", "Стефан", "Христо", "Йордан", "Тодор", "Стоян", "Васил", "Ангел", "Мартин", "Александър", "Виктор", "Калоян"];
const FEMALE_FIRST_NAMES = ["Мария", "Иванка", "Елена", "Йорданка", "Пенка", "Росица", "Петя", "Десислава", "Гергана", "Силвия", "Милена", "Надежда", "Теодора", "Радослава", "Виктория"];
const LAST_NAME_ROOTS = ["Петров", "Иванов", "Димитров", "Георгиев", "Николов", "Стоянов", "Колев", "Маринов", "Тодоров", "Ангелов", "Василев", "Младенов"];

// Track used name combinations per school to avoid duplicates
const usedNames = new Map<string, Set<string>>();

function generateName(gender: 'male' | 'female', context: string = 'global') {
  const firstNames = gender === 'male' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;

  if (!usedNames.has(context)) usedNames.set(context, new Set());
  const used = usedNames.get(context)!;

  let firstName: string, lastName: string, fullName: string;
  let attempts = 0;
  do {
    firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastNameRoot = LAST_NAME_ROOTS[Math.floor(Math.random() * LAST_NAME_ROOTS.length)];
    lastName = lastNameRoot;
    if (gender === 'female') {
      if (lastName.endsWith('ов')) lastName = lastName.replace('ов', 'ова');
      else if (lastName.endsWith('ев')) lastName = lastName.replace('ев', 'ева');
      else lastName += 'а';
    }
    fullName = `${firstName} ${lastName}`;
    attempts++;
  } while (used.has(fullName) && attempts < 100);

  used.add(fullName);
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

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ─── Message templates by category ──────────────────────────────────
const REAL_MESSAGES: Record<string, { title: string, content: string }[]> = {
  academic: [
    { title: "График за провеждане на НВО (10. клас)", content: "Публикуван е официалният график за Националното външно оценяване за учениците от 10. клас. Моля, запознайте се с датите и залите в прикачения файл." },
    { title: "Резултати от олимпиадата по математика", content: "Поздравяваме всички участници в областния кръг. Списъкът с класираните за национален кръг е наличен в архива на училището." },
    { title: "Допълнителни часове по БЕЛ", content: "Във връзка с подготовката за матурите, се организират допълнителни консултации всеки вторник от 14:30 ч. в кабинет 204." },
    { title: "Промяна в графика за изпитите", content: "Уведомяваме ви, че изпитите по математика са преместени за следващата седмица. Моля, проверете актуализирания график." },
    { title: "Класиране за ученически олимпиади", content: "Публикуван е списъкът с класираните ученици за областния кръг на олимпиадите. Успех на всички участници!" }
  ],
  administrative: [
    { title: "Промяна в седмичното разписание", content: "От следващия понеделник влиза в сила актуализирано седмично разписание поради кадрови промени. Моля, проверете промените за вашата паралелка." },
    { title: "Инструктаж за противопожарна безопасност", content: "Всички класове трябва да преминат през задължителен инструктаж в четвъртия учебен час. Присъствието е задължително." },
    { title: "Срок за подаване на заявления за стипендии", content: "Крайният срок за подаване на документи за социални и отлични стипендии е до 15-о число на текущия месец в канцеларията." },
    { title: "Нови правила за вътрешния ред", content: "Утвърдени са нови правила за вътрешния ред на училището. Всички ученици и учители да се запознаят с тях в срок до края на седмицата." },
    { title: "Задължително носене на ученическа лична карта", content: "Напомняме, че от следващия месец всички ученици трябва да носят ученическата си лична карта в училище." }
  ],
  general: [
    { title: "Благотворителен базар - Да помогнем заедно", content: "Каним всички ученици и родители да се включат в нашия пролетен базар. Събраните средства ще бъдат дарени за благотворителна кауза." },
    { title: "Предстоящ футболен турнир между класовете", content: "Записването на отборите при преподавателите по ФВС започва от сряда. Участват отбори от 8. до 12. клас. Очакваме ви!" },
    { title: "Училищен празник – 24 май", content: "Подготовката за тържественото честване започва! Учениците, желаещи да участват в празничната програма, да се явят в актовата зала." },
    { title: "Ден на отворените врати", content: "На 15-ти март ще се проведе ден на отворените врати за бъдещи ученици и родители. Очакваме ви от 10:00 ч." },
    { title: "Екскурзия до Велико Търново", content: "Организираме екскурзия до Велико Търново за учениците от 9. и 10. клас. Записванията са до петък при класния ръководител." }
  ],
  system: [
    { title: "Профилактика на електронната платформа", content: "Системата ще бъде временно недостъпна тази събота между 22:00 и 02:00 ч. поради техническа поддръжка. Благодарим за разбирането." },
    { title: "Важно: Актуализация на изискванията за сигурност", content: "Моля, обновете своите данни за достъп съгласно новите изисквания за сигурност на платформата." },
    { title: "Нова версия на платформата", content: "Публикувана е нова версия на платформата с подобрена функционалност. Моля, запознайте се с промените." },
    { title: "Системно известие: Архивиране на данни", content: "Информираме ви, че данните по-стари от 6 месеца ще бъдат архивирани автоматично. Моля, запазете важните съобщения." }
  ],
  personal: [
    { title: "Покана за индивидуална консултация", content: "Моля, заповядайте за обсъждане на текущия напредък и оценките в удобно за Вас и Вашите учители време." },
    { title: "Уведомление за отсъствия", content: "Информираме Ви за натрупан брой неизвинени отсъствия за съответния период. Очакваме писмено обяснение в срок." },
    { title: "Лична среща с класния ръководител", content: "Моля, заповядайте за лична среща с класния ръководител на вашето дете относно академичния му напредък." },
    { title: "Информация за стипендия", content: "Вие отговаряте на условията за получаване на стипендия за отличен успех. Моля, подайте необходимите документи." }
  ]
};

const COMMENT_TEMPLATES = [
  "Благодаря за информацията!",
  "Ще присъствам задължително.",
  "Може ли повече детайли относно часа?",
  "Разбрано, благодаря.",
  "Къде можем да намерим списъка със залите?",
  "Много добра инициатива!",
  "Ще предам на съучениците си.",
  "Супер! Кога точно започва?",
  "Има ли краен срок за записване?",
  "Очакваме с нетърпение!",
  "Благодаря за бързата реакция.",
  "Може ли да се запишем онлайн?",
  "Кога ще бъде публикуван пълният списък?",
  "Има ли допълнителна информация?",
  "Уведомих и родителите си."
];

// ─── Draft message templates ────────────────────────────────────────
const DRAFT_TEMPLATES = [
  { title: "Чернова: Предстоящ родителски срещи", content: "Уважаеми родители, каним ви на родителска среща, която ще се проведе...", category: "administrative" },
  { title: "Чернова: Нов учебен план", content: "Информираме ви за промени в учебния план за следващия семестър...", category: "academic" },
  { title: "Чернова: Спортно събитие", content: "Организираме спортен ден за всички класове. Моля, запишете се при...", category: "general" },
  { title: "Чернова: Промяна в графика", content: "Поради технически причини, часовете по информатика се преместват в...", category: "administrative" },
  { title: "Чернова: Класна работа по математика", content: "Класната работа по математика за 10. клас ще се проведе на...", category: "academic" },
  { title: "Чернова: Извънкласна дейност", content: "Предлагаме нова извънкласна дейност по роботика. Записването е...", category: "general" },
  { title: "Чернова: Системна поддръжка", content: "Планираме техническа поддръжка на сървърите в периода...", category: "system" },
  { title: "Чернова: Лично съобщение до ученик", content: "Уважаеми ученик, бих искал да ви уведомя за...", category: "personal" },
  { title: "Чернова: Нови учебни материали", content: "Качени са нови учебни материали в платформата за предмет...", category: "academic" },
];

// ─── Types ──────────────────────────────────────────────────────────
interface UserInfo {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  school: string;
  class?: string;
  subject?: string;
  teacherType?: string;
  registrationStatus: string;
}

export async function seed(db: any) {
  console.log("🚀 Starting large-scale seeding...");

  // Clear existing data
  console.log("🧹 Clearing existing data...");
  db.run("DELETE FROM personal_archives");
  db.run("DELETE FROM message_edits");
  db.run("DELETE FROM read_statuses");
  db.run("DELETE FROM notifications");
  db.run("DELETE FROM notification_settings");
  db.run("DELETE FROM audit_log");
  db.run("DELETE FROM attachments");
  db.run("DELETE FROM comments");
  db.run("DELETE FROM messages");
  db.run("DELETE FROM school_classes");
  db.run("DELETE FROM users");

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const allUsers: UserInfo[] = [];
  const schoolUsers: Record<string, UserInfo[]> = {};
  SCHOOLS.forEach(s => schoolUsers[s] = []);

  // Track all created message IDs for archives
  const publishedMessageIds: number[] = [];
  let auditCounter = 0;

  // Helper to insert user and return info
  function insertUser(opts: {
    email: string; firstName: string; lastName: string; role: string;
    school: string; class_?: string; subject?: string; teacherType?: string;
    classNumber?: number; managementPosition?: string;
    registrationStatus?: string; registrationReviewNote?: string;
    registrationReviewedAt?: string; createdAt: string;
    pendingClass?: string; pendingSubject?: string; pendingTeacherType?: string;
  }): UserInfo {
    db.run(`INSERT INTO users (email, password, first_name, last_name, role, school, class, subject, teacher_type, class_number, management_position, registration_status, registration_review_note, registration_reviewed_at, created_at, pending_class, pending_subject, pending_teacher_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opts.email, hashedPassword, opts.firstName, opts.lastName, opts.role, opts.school,
        opts.class_ || null, opts.subject || null, opts.teacherType || null,
        opts.classNumber || null, opts.managementPosition || null,
        opts.registrationStatus || 'approved',
        opts.registrationReviewNote || null,
        opts.registrationReviewedAt || null,
        opts.createdAt,
        opts.pendingClass || null, opts.pendingSubject || null, opts.pendingTeacherType || null
      ]);
    const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
    db.run(`INSERT INTO notification_settings (user_id) VALUES (?)`, [id]);

    const info: UserInfo = {
      id, email: opts.email, firstName: opts.firstName, lastName: opts.lastName,
      role: opts.role, school: opts.school, class: opts.class_,
      subject: opts.subject, teacherType: opts.teacherType,
      registrationStatus: opts.registrationStatus || 'approved'
    };
    allUsers.push(info);
    if (opts.school) {
      if (!schoolUsers[opts.school]) schoolUsers[opts.school] = [];
      schoolUsers[opts.school].push(info);
    }
    return info;
  }

  // Helper to add audit log
  function addAudit(action: string, performedBy: number, targetType: string, targetId: string, details: string, date: string, targetData?: string) {
    db.run(`INSERT INTO audit_log (action, performed_by, target_type, target_id, details, target_data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [action, performedBy, targetType, targetId, details, targetData || null, date]);
    auditCounter++;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 1. CREATE USERS
  // ═══════════════════════════════════════════════════════════════════
  console.log("👤 Creating Admin...");

  // 1.1 Global Admin (NOT tied to a school)
  const adminDate = formatDate(START_DATE);
  const admin = insertUser({
    email: "admin@school.bg",
    firstName: "Иван", lastName: "Петров",
    role: "admin", school: "",
    createdAt: adminDate
  });
  addAudit("Регистриране на профил", admin.id, "user", String(admin.id),
    `Регистриран администратор: ${admin.firstName} ${admin.lastName}`, adminDate);
  addAudit("Вход в системата", admin.id, "user", String(admin.id),
    `Администраторът ${admin.firstName} ${admin.lastName} влезе в системата`, adminDate);

  // 1.2 For each school: 1 director, 8 teachers (4 class + 4 regular), 4 classes × 26 students
  for (let si = 0; si < SCHOOLS.length; si++) {
    const school = SCHOOLS[si];
    console.log(`🏫 Seeding school: ${school}...`);
    const schoolId = transliterate(school.split(' ')[0].substring(0, 5)) + si;

    // --- Director (approved) ---
    const gD = Math.random() > 0.5 ? 'male' : 'female' as const;
    const { firstName: fnD, lastName: lnD } = generateName(gD, school);
    const dirDate = formatDate(getRandomDate(START_DATE, new Date(START_DATE.getTime() + 7 * 86400000)));
    const director = insertUser({
      email: `director.${transliterate(lnD)}.${schoolId}@school.bg`,
      firstName: fnD, lastName: lnD,
      role: "director", school, managementPosition: "director",
      registrationStatus: "approved",
      registrationReviewedAt: dirDate,
      createdAt: dirDate
    });
    addAudit("Регистриране на профил", director.id, "user", String(director.id),
      `Регистриран директор: ${fnD} ${lnD} (${school})`, dirDate);
    addAudit("Вход в системата", director.id, "user", String(director.id),
      `Директорът ${fnD} ${lnD} влезе в системата`, dirDate);

    // --- 4 Class Teachers (класни ръководители) ---
    for (let ci = 0; ci < CLASSES_PER_SCHOOL.length; ci++) {
      const className = CLASSES_PER_SCHOOL[ci];
      const gT = Math.random() > 0.5 ? 'male' : 'female' as const;
      const { firstName: fnT, lastName: lnT } = generateName(gT, school);
      const subject = SUBJECTS[ci % SUBJECTS.length]; // Each gets a different subject
      const tDate = formatDate(getRandomDate(START_DATE, new Date(START_DATE.getTime() + 14 * 86400000)));

      // Vary statuses: first 3 approved, 4th school's last teacher pending
      let regStatus = 'approved';
      if (si === 0 && ci === 3) regStatus = 'pending'; // one pending class teacher

      const classTeacher = insertUser({
        email: `teacher.class.${transliterate(className)}.${schoolId}@school.bg`,
        firstName: fnT, lastName: lnT,
        role: "teacher", school, subject, class_: className, teacherType: "class",
        registrationStatus: regStatus,
        registrationReviewedAt: regStatus === 'approved' ? tDate : undefined,
        createdAt: tDate,
        pendingClass: regStatus === 'pending' ? className : undefined,
        pendingSubject: regStatus === 'pending' ? subject : undefined,
        pendingTeacherType: regStatus === 'pending' ? 'class' : undefined
      });

      // Insert school_classes entry
      db.run(`INSERT OR IGNORE INTO school_classes (school, name) VALUES (?, ?)`, [school, className]);

      addAudit("Регистриране на профил", classTeacher.id, "user", String(classTeacher.id),
        `Регистриран учител (класен ръководител на ${className}): ${fnT} ${lnT}`, tDate);
    }

    // --- 4 Regular Teachers ---
    for (let ri = 0; ri < 4; ri++) {
      const gT = Math.random() > 0.5 ? 'male' : 'female' as const;
      const { firstName: fnT, lastName: lnT } = generateName(gT, school);
      const subject = SUBJECTS[(4 + ri) % SUBJECTS.length];
      const tDate = formatDate(getRandomDate(START_DATE, new Date(START_DATE.getTime() + 14 * 86400000)));

      // Vary statuses: mix of approved and rejected
      let regStatus = 'approved';
      if (si === 0 && ri === 3) regStatus = 'rejected'; // one rejected teacher in school 1
      if (si === 1 && ri === 3) regStatus = 'pending'; // one pending teacher in school 2

      const regNote = regStatus === 'rejected' ? 'Непълна документация за преподавателска квалификация' : undefined;

      const teacher = insertUser({
        email: `teacher.regular.${transliterate(subject)}.${ri}.${schoolId}@school.bg`,
        firstName: fnT, lastName: lnT,
        role: "teacher", school, subject, teacherType: "regular",
        registrationStatus: regStatus,
        registrationReviewNote: regNote,
        registrationReviewedAt: regStatus !== 'pending' ? tDate : undefined,
        createdAt: tDate,
        pendingSubject: regStatus === 'pending' ? subject : undefined,
        pendingTeacherType: regStatus === 'pending' ? 'regular' : undefined
      });
      addAudit("Регистриране на профил", teacher.id, "user", String(teacher.id),
        `Регистриран учител: ${fnT} ${lnT} (${subject})`, tDate);
    }

    // --- 26 Students per class (4 classes) ---
    for (const className of CLASSES_PER_SCHOOL) {
      for (let i = 1; i <= STUDENTS_PER_CLASS; i++) {
        const gS = Math.random() > 0.5 ? 'male' : 'female' as const;
        const { firstName: fnS, lastName: lnS } = generateName(gS, `${school}-${className}`);
        const sDate = formatDate(getRandomDate(START_DATE, new Date(START_DATE.getTime() + 30 * 86400000)));

        // Sprinkle statuses: most approved, a few pending/rejected per class
        let regStatus = 'approved';
        if (i === 25) regStatus = 'pending';   // one pending student per class
        if (i === 26) regStatus = 'rejected';  // one rejected student per class

        const regNote = regStatus === 'rejected' ? 'Невалидни лични данни при регистрация' : undefined;

        const student = insertUser({
          email: `student.${transliterate(className)}.${i}.${schoolId}@school.bg`,
          firstName: fnS, lastName: lnS,
          role: "student", school, class_: className, classNumber: i,
          registrationStatus: regStatus,
          registrationReviewNote: regNote,
          registrationReviewedAt: regStatus !== 'pending' ? sDate : undefined,
          createdAt: sDate
        });
        addAudit("Регистриране на профил", student.id, "user", String(student.id),
          `Регистриран ученик: ${fnS} ${lnS} (${className}, №${i})`, sDate);
      }
    }
  }

  console.log(`✅ Created ${allUsers.length} users total.`);

  // ═══════════════════════════════════════════════════════════════════
  // 2. CREATE MESSAGES (every type, every importance, with real file attachments)
  // ═══════════════════════════════════════════════════════════════════
  console.log("📝 Generating messages...");

  const categories: Array<'system' | 'general' | 'administrative' | 'academic' | 'personal'> = ['system', 'general', 'administrative', 'academic', 'personal'];
  const importanceLevels: Array<'low' | 'normal' | 'high'> = ['low', 'normal', 'high'];
  const categoryLabels: Record<string, string> = {
    system: 'Системно съобщение', general: 'Общо съобщение',
    administrative: 'Административно съобщение', academic: 'Учебно съобщение',
    personal: 'Лично съобщение'
  };

  let messageCounter = 0;
  let commentCounter = 0;
  let attachmentFileIndex = 0;

  for (const school of SCHOOLS) {
    const usersInSchool = schoolUsers[school];
    const approvedInSchool = usersInSchool.filter(u => u.registrationStatus === 'approved');
    const directors = approvedInSchool.filter(u => u.role === 'director');
    const teachers = approvedInSchool.filter(u => u.role === 'teacher');
    const students = approvedInSchool.filter(u => u.role === 'student');
    const posters = [...directors, ...teachers]; // directors + all approved teachers can post

    // Ensure every category × every importance level has at least one message
    for (const category of categories) {
      for (const importance of importanceLevels) {
        const poster = pickRandom(posters);
        const templates = REAL_MESSAGES[category];
        const template = pickRandom(templates);
        const date = getRandomDate(new Date(START_DATE.getTime() + 30 * 86400000), END_DATE);
        const dateStr = formatDate(date);

        // Determine target_audience based on category
        let targetAudience = 'all';
        if (category === 'personal') {
          const targetStudent = pickRandom(students);
          targetAudience = `user:${targetStudent.id}`;
        } else if (category === 'academic') {
          const targets = ['all', 'students', `class:${pickRandom(CLASSES_PER_SCHOOL)}`];
          targetAudience = pickRandom(targets);
        } else if (category === 'administrative') {
          targetAudience = pickRandom(['all', 'teachers']);
        }

        db.run(`INSERT INTO messages (title, content, category, status, importance, target_audience, author_id, comments_enabled, created_at, updated_at)
                VALUES (?, ?, ?, 'published', ?, ?, ?, 1, ?, ?)`,
          [template.title, template.content, category, importance, targetAudience, poster.id, dateStr, dateStr]);
        const msgId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
        publishedMessageIds.push(msgId);
        messageCounter++;

        // Attach a real file from uploads
        const file = REAL_UPLOAD_FILES[attachmentFileIndex % REAL_UPLOAD_FILES.length];
        attachmentFileIndex++;
        db.run(`INSERT INTO attachments (message_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
          [msgId, file.name, file.size, file.type, file.name]);

        // Audit: publish
        addAudit("Публикуване на съобщение", poster.id, "message", String(msgId),
          `Заглавие: "${template.title}" | Категория: ${categoryLabels[category]} | Важност: ${importance}`, dateStr);

        // Notifications for this message (to all approved in-school users)
        for (const u of approvedInSchool) {
          if (u.id === poster.id) continue;
          const nText = importance === 'high'
            ? `ВАЖНО: ${poster.firstName} ${poster.lastName} Ви изпрати съобщение с категория ${categoryLabels[category]} и висока важност`
            : `${poster.firstName} ${poster.lastName} Ви изпрати съобщение с категория ${categoryLabels[category]} и ${importance === 'low' ? 'ниска' : 'нормална'} важност`;
          db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, read, created_at)
                  VALUES (?, 'new_message', ?, ?, ?, ?, ?)`,
            [u.id, msgId, template.title, nText, Math.random() > 0.4 ? 1 : 0, dateStr]);

          // Read status
          if (Math.random() > 0.3) {
            const rDate = formatDate(getRandomDate(date, END_DATE));
            const confirmed = importance === 'high' ? (Math.random() > 0.5 ? 1 : 0) : 0;
            db.run(`INSERT OR IGNORE INTO read_statuses (message_id, user_id, read_at, confirmed) VALUES (?, ?, ?, ?)`,
              [msgId, u.id, rDate, confirmed]);
          }
        }

        // Comments (2-5 per published message)
        const numComments = 2 + Math.floor(Math.random() * 4);
        const commentators = pickRandomN(approvedInSchool.filter(u => u.id !== poster.id), numComments);
        for (const commenter of commentators) {
          const cDate = getRandomDate(date, END_DATE);
          const cDateStr = formatDate(cDate);
          const commentText = pickRandom(COMMENT_TEMPLATES);

          db.run(`INSERT INTO comments (message_id, author_id, content, created_at) VALUES (?, ?, ?, ?)`,
            [msgId, commenter.id, commentText, cDateStr]);
          const commentId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
          commentCounter++;

          // Attach a file to some comments
          if (Math.random() > 0.7) {
            const cFile = REAL_UPLOAD_FILES[attachmentFileIndex % REAL_UPLOAD_FILES.length];
            attachmentFileIndex++;
            db.run(`INSERT INTO attachments (comment_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
              [commentId, cFile.name, cFile.size, cFile.type, cFile.name]);
          }

          addAudit("Добавен коментар", commenter.id, "comment", String(commentId),
            `${commenter.firstName} ${commenter.lastName} коментира съобщение "${template.title}"`, cDateStr);

          // Notification to message author about comment
          db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, created_at)
                  VALUES (?, 'new_comment', ?, ?, ?, ?)`,
            [poster.id, msgId, template.title,
              `${commenter.firstName} ${commenter.lastName} коментира вашето съобщение`, cDateStr]);
        }
      }
    }

    // Additional messages from specific roles for variety
    for (let extra = 0; extra < 5; extra++) {
      const poster = pickRandom(posters);
      const category = pickRandom(categories);
      const importance = pickRandom(importanceLevels);
      const template = pickRandom(REAL_MESSAGES[category]);
      const date = getRandomDate(new Date(START_DATE.getTime() + 30 * 86400000), END_DATE);
      const dateStr = formatDate(date);

      let targetAudience = 'all';
      if (category === 'personal') {
        const targets = pickRandomN(students, 2 + Math.floor(Math.random() * 3));
        targetAudience = `users:${targets.map(t => t.id).join(',')}`;
      }

      db.run(`INSERT INTO messages (title, content, category, status, importance, target_audience, author_id, comments_enabled, created_at, updated_at)
              VALUES (?, ?, ?, 'published', ?, ?, ?, 1, ?, ?)`,
        [template.title, template.content, category, importance, targetAudience, poster.id, dateStr, dateStr]);
      const msgId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
      publishedMessageIds.push(msgId);
      messageCounter++;

      addAudit("Публикуване на съобщение", poster.id, "message", String(msgId),
        `Заглавие: "${template.title}" | Категория: ${categoryLabels[category]} | Важност: ${importance}`, dateStr);

      // Add real file attachments
      if (Math.random() > 0.3) {
        const file = REAL_UPLOAD_FILES[attachmentFileIndex % REAL_UPLOAD_FILES.length];
        attachmentFileIndex++;
        db.run(`INSERT INTO attachments (message_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
          [msgId, file.name, file.size, file.type, file.name]);
      }

      // Some notifications
      for (const u of pickRandomN(approvedInSchool, 15)) {
        if (u.id === poster.id) continue;
        db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, read, created_at)
                VALUES (?, 'new_message', ?, ?, ?, ?, ?)`,
          [u.id, msgId, template.title,
            `${poster.firstName} ${poster.lastName} Ви изпрати ново съобщение`, Math.random() > 0.5 ? 1 : 0, dateStr]);
      }

      // Comments
      const numC = 1 + Math.floor(Math.random() * 3);
      for (let ci = 0; ci < numC; ci++) {
        const commenter = pickRandom(approvedInSchool.filter(u => u.id !== poster.id));
        if (!commenter) continue;
        const cDate = formatDate(getRandomDate(date, END_DATE));
        db.run(`INSERT INTO comments (message_id, author_id, content, created_at) VALUES (?, ?, ?, ?)`,
          [msgId, commenter.id, pickRandom(COMMENT_TEMPLATES), cDate]);
        const commentId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
        commentCounter++;
        addAudit("Добавен коментар", commenter.id, "comment", String(commentId),
          `${commenter.firstName} ${commenter.lastName} коментира съобщение "${template.title}"`, cDate);
      }
    }
  }

  // Global admin messages (system-wide)
  console.log("📢 Creating admin system messages...");
  for (const importance of importanceLevels) {
    const template = pickRandom(REAL_MESSAGES['system']);
    const date = getRandomDate(new Date(START_DATE.getTime() + 15 * 86400000), END_DATE);
    const dateStr = formatDate(date);

    db.run(`INSERT INTO messages (title, content, category, status, importance, target_audience, author_id, comments_enabled, created_at, updated_at)
            VALUES (?, ?, 'system', 'published', ?, 'all', ?, 1, ?, ?)`,
      [template.title, template.content, importance, admin.id, dateStr, dateStr]);
    const msgId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
    publishedMessageIds.push(msgId);
    messageCounter++;

    const file = REAL_UPLOAD_FILES[attachmentFileIndex % REAL_UPLOAD_FILES.length];
    attachmentFileIndex++;
    db.run(`INSERT INTO attachments (message_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)`,
      [msgId, file.name, file.size, file.type, file.name]);

    addAudit("Публикуване на съобщение", admin.id, "message", String(msgId),
      `Заглавие: "${template.title}" | Категория: Системно съобщение | Важност: ${importance}`, dateStr);

    // Notify all approved users
    for (const u of allUsers.filter(u => u.id !== admin.id && u.registrationStatus === 'approved')) {
      db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, read, created_at)
              VALUES (?, 'new_message', ?, ?, ?, ?, ?)`,
        [u.id, msgId, template.title, `Системно съобщение от администратора`, Math.random() > 0.5 ? 1 : 0, dateStr]);
    }
  }

  console.log(`✅ Created ${messageCounter} messages and ${commentCounter} comments.`);

  // ═══════════════════════════════════════════════════════════════════
  // 3. EDITED MESSAGES (creates `edited_message` notifications + audit)
  // ═══════════════════════════════════════════════════════════════════
  console.log("✏️ Creating edited message notifications...");
  // Pick a few messages and simulate edits
  const messagesForEdit = pickRandomN(publishedMessageIds, 5);
  for (const msgId of messagesForEdit) {
    const msgRow = db.exec(`SELECT * FROM messages WHERE id = ${msgId}`)[0];
    if (!msgRow) continue;
    const cols = msgRow.columns;
    const vals = msgRow.values[0];
    const msgObj: any = {};
    cols.forEach((c: string, i: number) => msgObj[c] = vals[i]);

    const editDate = formatDate(getRandomDate(new Date(START_DATE.getTime() + 60 * 86400000), END_DATE));
    const newTitle = msgObj.title + " (обновено)";

    db.run(`UPDATE messages SET title = ?, updated_at = ? WHERE id = ?`, [newTitle, editDate, msgId]);

    // Edit history
    db.run(`INSERT INTO message_edits (message_id, edited_by, changes, edited_at) VALUES (?, ?, ?, ?)`,
      [msgId, msgObj.author_id, JSON.stringify({ title: true, content: false }), editDate]);

    addAudit("Редакция на съобщение", msgObj.author_id, "message", String(msgId),
      `Редактирано съобщение "${newTitle}"`, editDate, JSON.stringify({
        previous: {
          id: String(msgId),
          title: msgObj.title,
          content: msgObj.content,
          category: msgObj.category,
          importance: msgObj.importance,
          targetAudience: msgObj.target_audience,
        },
        current: {
          id: String(msgId),
          title: newTitle,
          content: msgObj.content,
          category: msgObj.category,
          importance: msgObj.importance,
          targetAudience: msgObj.target_audience,
        },
        changes: {
          title: { label: "Заглавие", from: msgObj.title, to: newTitle },
        },
      }));

    // Notify users about edit
    const school = db.exec(`SELECT school FROM users WHERE id = ${msgObj.author_id}`)[0]?.values[0]?.[0] as string;
    const authorName = db.exec(`SELECT first_name || ' ' || last_name FROM users WHERE id = ${msgObj.author_id}`)[0]?.values[0]?.[0] as string;
    const targetUsers = school
      ? allUsers.filter(u => u.school === school && u.id !== msgObj.author_id && u.registrationStatus === 'approved')
      : allUsers.filter(u => u.id !== msgObj.author_id && u.registrationStatus === 'approved');
    for (const u of pickRandomN(targetUsers, 20)) {
      db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, read, created_at)
              VALUES (?, 'edited_message', ?, ?, ?, ?, ?)`,
        [u.id, msgId, newTitle, `${authorName} редактира съобщение "${newTitle}"`, Math.random() > 0.5 ? 1 : 0, editDate]);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. REMINDER NOTIFICATIONS (for high-importance unconfirmed)
  // ═══════════════════════════════════════════════════════════════════
  console.log("🔔 Creating reminder notifications...");
  const highMsgs = db.exec(`SELECT id, title, author_id FROM messages WHERE importance = 'high' AND status = 'published' LIMIT 5`);
  if (highMsgs.length > 0) {
    for (const row of highMsgs[0].values) {
      const [hMsgId, hTitle, hAuthorId] = row;
      // Find users without confirmed read
      const unconfirmed = allUsers.filter(u =>
        u.id !== hAuthorId && u.registrationStatus === 'approved'
      ).slice(0, 10);

      for (const u of unconfirmed) {
        // Check if already has a reminder
        const existing = db.exec(`SELECT id FROM notifications WHERE user_id = ${u.id} AND message_id = ${hMsgId} AND type = 'reminder'`);
        if (existing.length > 0 && existing[0].values.length > 0) continue;

        const rDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 7 * 86400000), END_DATE));
        db.run(`INSERT INTO notifications (user_id, type, message_id, message_title, text, read, created_at)
                VALUES (?, 'reminder', ?, ?, ?, 0, ?)`,
          [u.id, hMsgId, hTitle, `Напомняне: Все още не сте потвърдили важно съобщение: "${hTitle}"`, rDate]);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. DELETED MESSAGES (audit entries for "Изтриване на съобщение")
  // ═══════════════════════════════════════════════════════════════════
  console.log("🗑️ Creating deleted message audit entries...");
  // Create 3 messages that we immediately "delete" to log the action
  for (let d = 0; d < 3; d++) {
    const school = SCHOOLS[d % SCHOOLS.length];
    const usersInSchool = schoolUsers[school].filter(u => u.registrationStatus === 'approved');
    const poster = usersInSchool.find(u => u.role === 'director') || usersInSchool[0];
    const date = formatDate(getRandomDate(new Date(START_DATE.getTime() + 40 * 86400000), END_DATE));
    const template = pickRandom(REAL_MESSAGES['general']);

    db.run(`INSERT INTO messages (title, content, category, status, importance, target_audience, author_id, comments_enabled, created_at, updated_at)
            VALUES (?, ?, 'general', 'published', 'normal', 'all', ?, 1, ?, ?)`,
      [template.title, template.content, poster.id, date, date]);
    const tmpMsgId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;

    addAudit("Публикуване на съобщение", poster.id, "message", String(tmpMsgId),
      `Заглавие: "${template.title}" | Категория: Общо съобщение | Важност: нормална`, date);

    // Now delete it
    const delDate = formatDate(getRandomDate(new Date(new Date(date).getTime() + 86400000), END_DATE));
    addAudit("Изтриване на съобщение", poster.id, "message", String(tmpMsgId),
      `Изтрито съобщение "${template.title}"`, delDate);

    // Delete the cascade
    db.run(`DELETE FROM attachments WHERE message_id = ?`, [tmpMsgId]);
    db.run(`DELETE FROM comments WHERE message_id = ?`, [tmpMsgId]);
    db.run(`DELETE FROM read_statuses WHERE message_id = ?`, [tmpMsgId]);
    db.run(`DELETE FROM notifications WHERE message_id = ?`, [tmpMsgId]);
    db.run(`DELETE FROM message_edits WHERE message_id = ?`, [tmpMsgId]);
    db.run(`DELETE FROM messages WHERE id = ?`, [tmpMsgId]);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. DELETED COMMENT AUDIT ENTRIES
  // ═══════════════════════════════════════════════════════════════════
  console.log("💬 Creating deleted comment audit entries...");
  // Pick some existing comments, snapshot them, then actually delete them.
  const someComments = db.exec(`SELECT c.id, c.message_id, c.author_id, c.content, m.title, u.first_name || ' ' || u.last_name AS author_name FROM comments c JOIN messages m ON c.message_id = m.id JOIN users u ON c.author_id = u.id LIMIT 3`);
  if (someComments.length > 0) {
    for (const row of someComments[0].values) {
      const [commentId, messageId, authorId, content, msgTitle, authorName] = row;
      const delDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 14 * 86400000), END_DATE));
      addAudit("Изтрит коментар", authorId as number, "comment", String(commentId),
        `Изтрит коментар от съобщение "${msgTitle}"`, delDate, JSON.stringify({
          messageId: String(messageId),
          messageTitle: msgTitle,
          authorId: String(authorId),
          authorName,
          content,
        }));
      db.run(`DELETE FROM attachments WHERE comment_id = ?`, [commentId]);
      db.run(`DELETE FROM comments WHERE id = ?`, [commentId]);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 7. CONFIRMED IMPORTANT MESSAGES (audit)
  // ═══════════════════════════════════════════════════════════════════
  console.log("✅ Creating confirmation audit entries...");
  const confirmedStatuses = db.exec(`SELECT rs.user_id, rs.message_id, m.title FROM read_statuses rs JOIN messages m ON rs.message_id = m.id WHERE rs.confirmed = 1 LIMIT 10`);
  if (confirmedStatuses.length > 0) {
    for (const row of confirmedStatuses[0].values) {
      const [userId, messageId, title] = row;
      const userRow = db.exec(`SELECT first_name, last_name FROM users WHERE id = ${userId}`);
      if (userRow.length > 0) {
        const [fn, ln] = userRow[0].values[0];
        const cDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 30 * 86400000), END_DATE));
        addAudit("Потвърждаване на важно съобщение", userId as number, "message", String(messageId),
          `Потребител ${fn} ${ln} потвърди, че е прочел "${title}"`, cDate);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 8. DRAFTS (3 per user)
  // ═══════════════════════════════════════════════════════════════════
  console.log("📋 Creating drafts...");
  let draftCounter = 0;
  for (const user of allUsers.filter(u => u.registrationStatus === 'approved')) {
    const usedDraftIndices = new Set<number>();
    for (let d = 0; d < 3; d++) {
      let draftIdx: number;
      do {
        draftIdx = Math.floor(Math.random() * DRAFT_TEMPLATES.length);
      } while (usedDraftIndices.has(draftIdx) && usedDraftIndices.size < DRAFT_TEMPLATES.length);
      usedDraftIndices.add(draftIdx);

      const draft = DRAFT_TEMPLATES[draftIdx];
      const dDate = formatDate(getRandomDate(new Date(START_DATE.getTime() + 20 * 86400000), END_DATE));

      // Determine target audience for draft
      let targetAudience = 'all';
      if (draft.category === 'personal' && user.role === 'teacher') {
        const schoolStudents = schoolUsers[user.school]?.filter(u => u.role === 'student' && u.registrationStatus === 'approved') || [];
        if (schoolStudents.length > 0) {
          targetAudience = `user:${pickRandom(schoolStudents).id}`;
        }
      }

      db.run(`INSERT INTO messages (title, content, category, status, importance, target_audience, author_id, comments_enabled, created_at, updated_at)
              VALUES (?, ?, ?, 'draft', ?, ?, ?, 1, ?, ?)`,
        [draft.title, draft.content, draft.category, pickRandom(importanceLevels), targetAudience, user.id, dDate, dDate]);
      const draftId = db.exec("SELECT last_insert_rowid()")[0].values[0][0] as number;
      draftCounter++;

      // Audit for draft creation
      addAudit("Публикуване на съобщение", user.id, "draft", String(draftId),
        `Създадена чернова: "${draft.title}"`, dDate,
        JSON.stringify({
          id: String(draftId),
          title: draft.title,
          content: draft.content,
          category: draft.category,
          status: 'draft',
          importance: 'normal',
          targetAudience: targetAudience,
          authorId: String(user.id),
          authorName: `${user.firstName} ${user.lastName}`,
          authorRole: user.role,
          authorSchool: user.school,
          commentsEnabled: true,
          createdAt: dDate,
          updatedAt: dDate,
          attachments: [],
          comments: [],
          editHistory: [],
          links: []
        }));
    }
  }
  console.log(`✅ Created ${draftCounter} drafts.`);

  // ═══════════════════════════════════════════════════════════════════
  // 9. PERSONAL ARCHIVES (1-3 archived messages per user)
  // ═══════════════════════════════════════════════════════════════════
  console.log("📦 Creating personal archives...");
  let archiveCounter = 0;
  const approvedUsers = allUsers.filter(u => u.registrationStatus === 'approved');

  for (const user of approvedUsers) {
    const numArchived = 1 + Math.floor(Math.random() * 3); // 1-3
    const eligibleMessages = pickRandomN(publishedMessageIds, numArchived);

    for (const msgId of eligibleMessages) {
      // Build a snapshot of the message
      const msgRow = db.exec(`SELECT m.*, u.first_name || ' ' || u.last_name AS author_name, u.role AS author_role, u.school AS author_school
                              FROM messages m JOIN users u ON m.author_id = u.id WHERE m.id = ${msgId}`);
      if (!msgRow.length || !msgRow[0].values.length) continue;

      const cols = msgRow[0].columns;
      const vals = msgRow[0].values[0];
      const msgObj: any = {};
      cols.forEach((c: string, i: number) => msgObj[c] = vals[i]);

      const snapshot = JSON.stringify({
        id: String(msgObj.id),
        title: msgObj.title,
        content: msgObj.content,
        category: msgObj.category,
        status: msgObj.status,
        importance: msgObj.importance,
        targetAudience: msgObj.target_audience,
        authorId: String(msgObj.author_id),
        authorName: msgObj.author_name,
        authorRole: msgObj.author_role,
        authorSchool: msgObj.author_school,
        commentsEnabled: !!msgObj.comments_enabled,
        createdAt: msgObj.created_at,
        updatedAt: msgObj.updated_at,
        attachments: [],
        comments: [],
        editHistory: [],
        links: []
      });

      const archDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 30 * 86400000), END_DATE));
      db.run(`INSERT OR IGNORE INTO personal_archives (user_id, message_id, snapshot, archived_at) VALUES (?, ?, ?, ?)`,
        [user.id, msgId, snapshot, archDate]);

      addAudit("Публикуване на съобщение", user.id, "archive", String(msgId),
        `Потребител ${user.firstName} ${user.lastName} архивира съобщение #${msgId}`, archDate, snapshot);
      archiveCounter++;
    }
  }
  console.log(`✅ Created ${archiveCounter} personal archive entries.`);

  // ═══════════════════════════════════════════════════════════════════
  // 10. ADDITIONAL AUDIT LOG ENTRIES (all action types)
  // ═══════════════════════════════════════════════════════════════════
  console.log("🛠️ Adding remaining audit action types...");

  // "Вход в системата" for several users
  for (const user of pickRandomN(approvedUsers, 20)) {
    const loginDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 30 * 86400000), END_DATE));
    addAudit("Вход в системата", user.id, "user", String(user.id),
      `${user.firstName} ${user.lastName} влезе в системата`, loginDate);
  }

  // "Промяна по профил"
  for (const user of pickRandomN(approvedUsers, 8)) {
    const changeDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 60 * 86400000), END_DATE));
    addAudit("Промяна по профил", user.id, "user", String(user.id),
      `${user.firstName} ${user.lastName} промени данните на профила си`, changeDate);
  }

  // "Административна промяна" by directors and admin
  for (const school of SCHOOLS) {
    const director = schoolUsers[school].find(u => u.role === 'director');
    if (director) {
      const changeTargets = pickRandomN(schoolUsers[school].filter(u => u.role !== 'director'), 3);
      for (const target of changeTargets) {
        const changeDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 45 * 86400000), END_DATE));
        addAudit("Административна промяна", director.id, "user", String(target.id),
          `Директорът ${director.firstName} ${director.lastName} промени данните на ${target.firstName} ${target.lastName}`, changeDate);
      }
    }
  }

  // Admin makes administrative changes
  const adminChangeTargets = pickRandomN(approvedUsers.filter(u => u.id !== admin.id), 3);
  for (const target of adminChangeTargets) {
    const changeDate = formatDate(getRandomDate(new Date(END_DATE.getTime() - 30 * 86400000), END_DATE));
    addAudit("Административна промяна", admin.id, "user", String(target.id),
      `Администраторът промени правата на ${target.firstName} ${target.lastName}`, changeDate);
  }

  console.log(`✅ Total audit log entries: ${auditCounter}`);
  console.log("✅ Large-scale seeding inner logic complete!");
}
