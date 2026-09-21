const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const { PDF_FONT_NAMES, registerPdfFonts } = require("../config/pdfFonts");

// =================================================
// DESIGN
// =================================================

const COLORS = {
  ink: "#111111",
  muted: "#666666",
  border: "#777777",
  lightBorder: "#B8B8B8",
  section: "#EEEEEE",
  soft: "#F7F7F7",
  white: "#FFFFFF",
};

const FONT_REGULAR = PDF_FONT_NAMES.regular;
const FONT_BOLD = PDF_FONT_NAMES.bold;

const PAGE_MARGIN = {
  top: 42,
  bottom: 44,
  left: 42,
  right: 42,
};

const PHOTO_WIDTH = 85;
const PHOTO_HEIGHT = 113;

// =================================================
// BASIC HELPERS
// =================================================

const safeText = (value, fallback = "-") => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  return String(value).trim();
};

const hasText = (value) => {
  return !(
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  );
};

const contentWidth = (doc) => {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
};

const bottomLimit = (doc) => {
  return doc.page.height - doc.page.margins.bottom;
};

// =================================================
// DATE HELPERS
// =================================================

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const formatJapaneseDate = (value) => {
  const date = parseDate(value);

  if (!date) {
    return "-";
  }

  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}月${String(date.getDate()).padStart(2, "0")}日`;
};

const formatJapaneseMonth = (value) => {
  const date = parseDate(value);

  if (!date) {
    return "";
  }

  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}月`;
};

const getYearMonth = (value) => {
  const date = parseDate(value);

  if (!date) {
    return {
      year: "",
      month: "",
    };
  }

  return {
    year: String(date.getFullYear()),

    month: String(date.getMonth() + 1).padStart(2, "0"),
  };
};

const calculateAge = (value) => {
  const birthDate = parseDate(value);

  if (!birthDate) {
    return "-";
  }

  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return `${age}歳`;
};

// =================================================
// JAPANESE LABEL HELPERS
// =================================================

const genderLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    male: "男",
    m: "男",
    female: "女",
    f: "女",
    other: "その他",
  };

  return map[normalized] || safeText(value);
};

const visaStatusLabel = (value) => {
  const map = {
    student: "留学",
    dependent: "家族滞在",

    designatedActivitiesJobHunting: "特定活動（就職活動）",

    designatedActivities: "特定活動",

    engineerHumanitiesInternationalServices: "技術・人文知識・国際業務",

    specifiedSkilledWorker1: "特定技能1号",

    specifiedSkilledWorker2: "特定技能2号",

    skilledLabor: "技能",

    technicalInternTraining: "技能実習",

    "intra-companyTransferee": "企業内転勤",

    nursingCare: "介護",

    highlySkilledProfessional: "高度専門職",

    businessManager: "経営・管理",

    permanentResident: "永住者",

    spouseChildOfJapaneseNational: "日本人の配偶者等",

    spouseChildOfPermanentResident: "永住者の配偶者等",

    longTermResident: "定住者",

    other: "その他",
  };

  return map[value] || safeText(value);
};

const educationTypeLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    highschool: "高等学校",

    "high school": "高等学校",

    university: "大学",

    college: "大学",

    vocational: "専門学校",

    vocationalschool: "専門学校",

    languageschool: "日本語学校",

    japaneselanguageschool: "日本語学校",

    graduateschool: "大学院",
  };

  return map[value] || map[normalized] || safeText(value, "");
};

const employmentTypeLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    fulltime: "正社員",

    "full-time": "正社員",

    parttime: "アルバイト",

    "part-time": "アルバイト",

    contract: "契約社員",

    contractemployee: "契約社員",

    temporary: "派遣社員",

    dispatch: "派遣社員",

    intern: "インターン",
  };

  return map[value] || map[normalized] || safeText(value, "");
};

const graduationStatusLabel = (value) => {
  const map = {
    graduated: "卒業",

    expectedGraduation: "卒業見込",

    currentlyEnrolled: "在学中",

    withdrawn: "中退",
  };

  return map[value] || "";
};

const japaneseLevelLabel = (value) => {
  if (!value) {
    return "";
  }

  const normalized = String(value).trim().toLowerCase();

  const map = {
    n1: "JLPT N1",

    n2: "JLPT N2",

    n3: "JLPT N3",

    n4: "JLPT N4",

    n5: "JLPT N5",
  };

  return map[normalized] || safeText(value, "");
};

// =================================================
// FONT
// =================================================

const setFont = (doc, { bold = false, size = 9, color = COLORS.ink } = {}) => {
  doc
    .font(bold ? FONT_BOLD : FONT_REGULAR)
    .fontSize(size)
    .fillColor(color);

  return doc;
};

// =================================================
// IMAGE
// =================================================

const resolveImagePath = (imagePath) => {
  if (!imagePath) {
    return null;
  }

  const raw = String(imagePath).trim();

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return null;
  }

  const candidates = [
    raw,

    path.resolve(process.cwd(), raw),

    path.resolve(process.cwd(), raw.replace(/^[/\\]+/, "")),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

// =================================================
// PAGE HELPERS
// =================================================

const addNewPage = (doc) => {
  doc.addPage();

  setFont(doc);

  doc.y = doc.page.margins.top;
};

const ensureSpace = (doc, requiredHeight) => {
  if (doc.y + requiredHeight > bottomLimit(doc)) {
    addNewPage(doc);

    return true;
  }

  return false;
};

// =================================================
// TEXT MEASUREMENT
// =================================================

const measureTextHeight = (
  doc,
  text,
  width,
  { size = 9, bold = false, lineGap = 1.5 } = {},
) => {
  setFont(doc, {
    size,
    bold,
  });

  return doc.heightOfString(safeText(text), {
    width,
    lineGap,
  });
};

// =================================================
// CELL
// =================================================

const drawCell = ({
  doc,
  x,
  y,
  width,
  height,
  text,
  fill = null,
  bold = false,
  size = 8.5,
  align = "left",
  padding = 5,
  color = COLORS.ink,
}) => {
  if (fill) {
    doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
  }

  doc
    .save()
    .lineWidth(0.65)
    .strokeColor(COLORS.border)
    .rect(x, y, width, height)
    .stroke()
    .restore();

  setFont(doc, {
    bold,
    size,
    color,
  });

  doc.text(safeText(text), x + padding, y + padding, {
    width: width - padding * 2,

    height: height - padding * 2,

    align,

    lineGap: 1.2,
  });
};

// =================================================
// SECTION TITLE
// =================================================

const drawSectionTitle = (doc, title) => {
  ensureSpace(doc, 34);

  const x = doc.page.margins.left;

  const y = doc.y;

  const width = contentWidth(doc);

  doc.save().fillColor(COLORS.section).rect(x, y, width, 24).fill().restore();

  doc
    .save()
    .strokeColor(COLORS.border)
    .lineWidth(0.7)
    .rect(x, y, width, 24)
    .stroke()
    .restore();

  setFont(doc, {
    bold: true,
    size: 10.5,
  });

  doc.text(title, x + 8, y + 6, {
    width: width - 16,
  });

  doc.y = y + 31;
};

// =================================================
// BODY TEXT
// =================================================

const drawBodyText = (
  doc,
  value,
  { emptyText = "記載なし", size = 9 } = {},
) => {
  const text = hasText(value) ? String(value).trim() : emptyText;

  setFont(doc, {
    size,
  });

  doc.text(text, {
    width: contentWidth(doc),

    lineGap: 3,
  });

  doc.moveDown(0.7);
};

// =================================================
// DOCUMENT TITLE
// =================================================

const drawDocumentTitle = (
  doc,
  title,
  { name = "", showName = false } = {},
) => {
  setFont(doc, {
    bold: true,
    size: 19,
  });

  doc.text(title, doc.page.margins.left, doc.page.margins.top, {
    width: contentWidth(doc),

    align: "center",
  });

  const currentDate = formatJapaneseDate(new Date());

  setFont(doc, {
    size: 8.5,
    color: COLORS.muted,
  });

  doc.text(
    `${currentDate} 現在`,
    doc.page.margins.left,
    doc.page.margins.top + 28,
    {
      width: contentWidth(doc),

      align: "right",
    },
  );

  if (showName && name) {
    setFont(doc, {
      size: 10,
    });

    doc.text(
      `氏名：${name}`,
      doc.page.margins.left,
      doc.page.margins.top + 45,
      {
        width: contentWidth(doc),

        align: "right",
      },
    );

    doc.y = doc.page.margins.top + 70;
  } else {
    doc.y = doc.page.margins.top + 58;
  }
};

// =================================================
// PERSONAL INFORMATION
// =================================================

const drawPersonalInformation = (doc, client, profile) => {
  const x = doc.page.margins.left;

  const totalWidth = contentWidth(doc);

  const gap = 12;

  const tableWidth = totalWidth - PHOTO_WIDTH - gap;

  const photoX = x + tableWidth + gap;

  const photoY = doc.y;

  // =================================================
  // PHOTO
  // =================================================

  doc
    .save()
    .lineWidth(0.7)
    .strokeColor(COLORS.border)
    .rect(photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT)
    .stroke()
    .restore();

  const imagePath = resolveImagePath(profile?.clientImage);

  if (imagePath) {
    try {
      doc.image(imagePath, photoX + 2, photoY + 2, {
        cover: [PHOTO_WIDTH - 4, PHOTO_HEIGHT - 4],

        align: "center",

        valign: "center",
      });
    } catch (error) {
      console.error("CV PHOTO ERROR:", error.message);
    }
  } else {
    setFont(doc, {
      size: 8,
      color: COLORS.muted,
    });

    doc.text("写真", photoX, photoY + 50, {
      width: PHOTO_WIDTH,

      align: "center",
    });
  }

  // =================================================
  // TABLE HELPERS
  // =================================================

  let y = doc.y;

  const fullRow = (label, value, minHeight = 27) => {
    const labelWidth = 66;

    const valueWidth = tableWidth - labelWidth;

    const valueHeight = measureTextHeight(doc, value, valueWidth - 10);

    const height = Math.max(minHeight, valueHeight + 10);

    drawCell({
      doc,
      x,
      y,

      width: labelWidth,

      height,

      text: label,

      fill: COLORS.soft,

      bold: true,

      align: "center",
    });

    drawCell({
      doc,

      x: x + labelWidth,

      y,

      width: valueWidth,

      height,

      text: value,
    });

    y += height;
  };

  const splitRow = (label1, value1, label2, value2) => {
    const half = tableWidth / 2;

    const labelWidth = 55;

    const valueWidth = half - labelWidth;

    const valueHeight1 = measureTextHeight(doc, value1, valueWidth - 10);

    const valueHeight2 = measureTextHeight(doc, value2, valueWidth - 10);

    const height = Math.max(27, valueHeight1 + 10, valueHeight2 + 10);

    drawCell({
      doc,
      x,
      y,

      width: labelWidth,

      height,

      text: label1,

      fill: COLORS.soft,

      bold: true,

      align: "center",
    });

    drawCell({
      doc,

      x: x + labelWidth,

      y,

      width: valueWidth,

      height,

      text: value1,
    });

    drawCell({
      doc,

      x: x + half,

      y,

      width: labelWidth,

      height,

      text: label2,

      fill: COLORS.soft,

      bold: true,

      align: "center",
    });

    drawCell({
      doc,

      x: x + half + labelWidth,

      y,

      width: valueWidth,

      height,

      text: value2,
    });

    y += height;
  };

  // =================================================
  // PERSONAL ROWS
  // =================================================

  fullRow("フリガナ", safeText(profile?.furigana));

  fullRow("氏名", safeText(client.fullName), 32);

  splitRow(
    "生年月日",

    formatJapaneseDate(profile?.dateOfBirth),

    "年齢",

    calculateAge(profile?.dateOfBirth),
  );

  splitRow(
    "性別",

    genderLabel(profile?.gender),

    "国籍",

    safeText(profile?.nationality),
  );

  splitRow(
    "在留資格",

    visaStatusLabel(client.currentVisaStatus),

    "在留期限",

    formatJapaneseDate(profile?.residenceExpiryDate),
  );

  const postalCode = hasText(profile?.postalCode)
    ? `〒${profile.postalCode}`
    : "";

  const address = [postalCode, profile?.prefecture, profile?.address]
    .filter(Boolean)
    .join(" ");

  fullRow("住所", safeText(address), 36);

  splitRow(
    "電話番号",
    safeText(client.phone),

    "Email",
    safeText(profile?.email),
  );

  doc.y = Math.max(y, photoY + PHOTO_HEIGHT) + 16;
};

// =================================================
// TIMELINE
// =================================================

const buildTimelineRows = (profile) => {
  const rows = [];

  // =================================================
  // EDUCATION
  // =================================================

  rows.push({
    type: "section",

    text: "学歴",
  });

  for (const item of profile?.education || []) {
    const schoolName = safeText(item.schoolName, "");

    const schoolType = educationTypeLabel(item.educationType);

    const major = safeText(item.major, "");

    const schoolText = [
      schoolName,

      major ? `（${major}）` : "",

      schoolType && !schoolName.includes(schoolType) ? ` ${schoolType}` : "",
    ]
      .filter(Boolean)
      .join("");

    if (item.enrollmentDate || schoolText) {
      const date = getYearMonth(item.enrollmentDate);

      rows.push({
        type: "entry",

        year: date.year,

        month: date.month,

        text: `${schoolText || "学校"} 入学`,
      });
    }

    const graduationStatus = graduationStatusLabel(item.graduationStatus);

    if (item.graduationDate) {
      const date = getYearMonth(item.graduationDate);

      rows.push({
        type: "entry",

        year: date.year,

        month: date.month,

        text: `${schoolText || "学校"} ${graduationStatus || "卒業"}`,
      });
    } else if (item.graduationStatus === "currentlyEnrolled") {
      rows.push({
        type: "entry",

        year: "",

        month: "",

        text: `${schoolText || "学校"} 在学中`,
      });
    }
  }

  // =================================================
  // EMPLOYMENT
  // =================================================

  rows.push({
    type: "section",

    text: "職歴",
  });

  for (const item of profile?.employmentHistory || []) {
    const companyName = safeText(item.companyName, "会社名未登録");

    const start = getYearMonth(item.startDate);

    const extra = [
      employmentTypeLabel(item.employmentType),

      safeText(item.jobTitle, ""),
    ]
      .filter(Boolean)
      .join(" / ");

    rows.push({
      type: "entry",

      year: start.year,

      month: start.month,

      text: `${companyName} 入社${extra ? `（${extra}）` : ""}`,
    });

    if (item.isCurrent) {
      rows.push({
        type: "entry",

        year: "",

        month: "",

        text: `${companyName} 現在に至る`,
      });
    } else if (item.endDate) {
      const end = getYearMonth(item.endDate);

      rows.push({
        type: "entry",

        year: end.year,

        month: end.month,

        text: `${companyName} 退社`,
      });
    }
  }

  rows.push({
    type: "end",

    text: "以上",
  });

  return rows;
};

const drawTimelineTable = (doc, rows) => {
  const x = doc.page.margins.left;

  const totalWidth = contentWidth(doc);

  const yearWidth = 58;

  const monthWidth = 42;

  const textWidth = totalWidth - yearWidth - monthWidth;

  const drawHeader = () => {
    const y = doc.y;

    const height = 25;

    drawCell({
      doc,
      x,
      y,

      width: yearWidth,

      height,

      text: "年",

      fill: COLORS.soft,

      bold: true,

      align: "center",
    });

    drawCell({
      doc,

      x: x + yearWidth,

      y,

      width: monthWidth,

      height,

      text: "月",

      fill: COLORS.soft,

      bold: true,

      align: "center",
    });

    drawCell({
      doc,

      x: x + yearWidth + monthWidth,

      y,

      width: textWidth,

      height,

      text: "学歴・職歴",

      fill: COLORS.soft,

      bold: true,

      align: "center",
    });

    doc.y = y + height;
  };

  drawHeader();

  for (const row of rows) {
    if (row.type === "section") {
      const pageChanged = ensureSpace(doc, 26);

      if (pageChanged) {
        drawHeader();
      }

      const y = doc.y;

      drawCell({
        doc,
        x,
        y,

        width: totalWidth,

        height: 24,

        text: row.text,

        fill: COLORS.soft,

        bold: true,

        align: "center",
      });

      doc.y = y + 24;

      continue;
    }

    if (row.type === "end") {
      const pageChanged = ensureSpace(doc, 26);

      if (pageChanged) {
        drawHeader();
      }

      const y = doc.y;

      drawCell({
        doc,
        x,
        y,

        width: totalWidth,

        height: 24,

        text: row.text,

        align: "right",
      });

      doc.y = y + 24;

      continue;
    }

    const textHeight = measureTextHeight(doc, row.text, textWidth - 10, {
      size: 8.5,
    });

    const rowHeight = Math.max(25, textHeight + 10);

    const pageChanged = ensureSpace(doc, rowHeight + 2);

    if (pageChanged) {
      drawHeader();
    }

    const y = doc.y;

    drawCell({
      doc,
      x,
      y,

      width: yearWidth,

      height: rowHeight,

      text: row.year,

      align: "center",
    });

    drawCell({
      doc,

      x: x + yearWidth,

      y,

      width: monthWidth,

      height: rowHeight,

      text: row.month,

      align: "center",
    });

    drawCell({
      doc,

      x: x + yearWidth + monthWidth,

      y,

      width: textWidth,

      height: rowHeight,

      text: row.text,
    });

    doc.y = y + rowHeight;
  }

  doc.moveDown(1.2);
};

// =================================================
// QUALIFICATION TABLE
// =================================================

const buildQualificationRows = (profile) => {
  const rows = [];

  if (profile?.japaneseLanguageLevel) {
    rows.push({
      date: "",

      text: `日本語能力 ${japaneseLevelLabel(profile.japaneseLanguageLevel)}`,
    });
  }

  for (const qualification of profile?.qualifications || []) {
    const pieces = [
      safeText(qualification.name, ""),

      safeText(qualification.levelOrScore, ""),

      qualification.issuer ? `（${qualification.issuer}）` : "",
    ].filter(Boolean);

    rows.push({
      date: qualification.acquiredDate
        ? formatJapaneseMonth(qualification.acquiredDate)
        : "",

      text: pieces.join(" ") || "資格",
    });
  }

  if (rows.length === 0) {
    rows.push({
      date: "",

      text: "特になし",
    });
  }

  return rows;
};

const drawQualificationTable = (doc, profile) => {
  drawSectionTitle(doc, "免許・資格");

  const rows = buildQualificationRows(profile);

  const x = doc.page.margins.left;

  const totalWidth = contentWidth(doc);

  const dateWidth = 105;

  const textWidth = totalWidth - dateWidth;

  for (const row of rows) {
    const textHeight = measureTextHeight(doc, row.text, textWidth - 10);

    const height = Math.max(27, textHeight + 10);

    ensureSpace(doc, height + 2);

    const y = doc.y;

    drawCell({
      doc,
      x,
      y,

      width: dateWidth,

      height,

      text: row.date,

      align: "center",
    });

    drawCell({
      doc,

      x: x + dateWidth,

      y,

      width: textWidth,

      height,

      text: row.text,
    });

    doc.y = y + height;
  }

  doc.moveDown(1.2);
};

// =================================================
// APPLICATION CONTENT
// =================================================

const drawApplicationContent = (doc, profile) => {
  drawSectionTitle(doc, "志望動機・自己PR");

  const parts = [];

  if (hasText(profile?.motivation)) {
    parts.push(`【志望動機】\n${String(profile.motivation).trim()}`);
  }

  if (hasText(profile?.selfPR)) {
    parts.push(`【自己PR】\n${String(profile.selfPR).trim()}`);
  }

  drawBodyText(doc, parts.join("\n\n"), {
    emptyText: "記載なし",
  });

  drawSectionTitle(doc, "本人希望記入欄");

  drawBodyText(doc, profile?.desiredConditions, {
    emptyText: "特になし",
  });
};

// =================================================
// RIREKISHO
// =================================================

const drawRirekisho = (doc, client, profile) => {
  drawDocumentTitle(doc, "履 歴 書");

  drawPersonalInformation(doc, client, profile);

  drawSectionTitle(doc, "学歴・職歴");

  drawTimelineTable(doc, buildTimelineRows(profile));

  drawQualificationTable(doc, profile);

  drawApplicationContent(doc, profile);
};

// =================================================
// CAREER HISTORY HELPERS
// =================================================

const drawCareerSectionTitle = (doc, title) => {
  ensureSpace(doc, 35);

  const x = doc.page.margins.left;

  const width = contentWidth(doc);

  setFont(doc, {
    bold: true,
    size: 11,
  });

  doc.text(title, x, doc.y, {
    width,
  });

  doc.moveDown(0.3);

  const lineY = doc.y;

  doc
    .save()
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .moveTo(x, lineY)
    .lineTo(x + width, lineY)
    .stroke()
    .restore();

  doc.y = lineY + 8;
};

const drawBulletList = (doc, values) => {
  const filtered = values.map((value) => safeText(value, "")).filter(Boolean);

  if (filtered.length === 0) {
    drawBodyText(doc, "");

    return;
  }

  for (const item of filtered) {
    ensureSpace(doc, 24);

    setFont(doc, {
      size: 9,
    });

    doc.text(`・${item}`, {
      width: contentWidth(doc),

      lineGap: 2,
    });

    doc.moveDown(0.25);
  }

  doc.moveDown(0.5);
};

const drawEmploymentBlock = (doc, item, index) => {
  ensureSpace(doc, 150);

  const start = item.startDate ? formatJapaneseMonth(item.startDate) : "";

  const end = item.isCurrent
    ? "現在"
    : item.endDate
      ? formatJapaneseMonth(item.endDate)
      : "";

  const dateRange = [start, end].filter(Boolean).join(" ～ ");

  const companyName = safeText(item.companyName, `勤務先 ${index + 1}`);

  // =================================================
  // EMPLOYMENT HEADER
  // =================================================

  const x = doc.page.margins.left;

  const width = contentWidth(doc);

  const y = doc.y;

  doc.save().fillColor(COLORS.soft).rect(x, y, width, 29).fill().restore();

  doc
    .save()
    .strokeColor(COLORS.lightBorder)
    .lineWidth(0.7)
    .rect(x, y, width, 29)
    .stroke()
    .restore();

  setFont(doc, {
    bold: true,

    size: 10,
  });

  doc.text(companyName, x + 8, y + 7, {
    width: width * 0.62,
  });

  setFont(doc, {
    size: 8.5,
  });

  doc.text(
    dateRange || "-",

    x + width * 0.63,

    y + 8,

    {
      width: width * 0.34,

      align: "right",
    },
  );

  doc.y = y + 37;

  // =================================================
  // EMPLOYMENT META
  // =================================================

  const meta = [
    ["雇用形態", employmentTypeLabel(item.employmentType)],

    ["部署", safeText(item.department, "")],

    ["職種", safeText(item.jobTitle, "")],

    ["勤務地", safeText(item.workLocation, "")],
  ].filter(([, value]) => hasText(value));

  if (meta.length > 0) {
    setFont(doc, {
      size: 8.5,

      color: COLORS.muted,
    });

    doc.text(meta.map(([label, value]) => `${label}: ${value}`).join("    "), {
      width,
      lineGap: 2,
    });

    doc.moveDown(0.7);
  }

  // =================================================
  // RESPONSIBILITIES
  // =================================================

  if (hasText(item.responsibilities)) {
    setFont(doc, {
      bold: true,

      size: 9,
    });

    doc.text("【主な業務内容】");

    doc.moveDown(0.25);

    setFont(doc, {
      size: 9,
    });

    doc.text(String(item.responsibilities).trim(), {
      width,
      lineGap: 3,
    });

    doc.moveDown(0.65);
  }

  // =================================================
  // ACHIEVEMENTS
  // =================================================

  if (hasText(item.achievements)) {
    setFont(doc, {
      bold: true,

      size: 9,
    });

    doc.text("【実績・成果】");

    doc.moveDown(0.25);

    setFont(doc, {
      size: 9,
    });

    doc.text(String(item.achievements).trim(), {
      width,
      lineGap: 3,
    });

    doc.moveDown(0.65);
  }

  if (!hasText(item.responsibilities) && !hasText(item.achievements)) {
    setFont(doc, {
      size: 9,

      color: COLORS.muted,
    });

    doc.text("業務内容の詳細は未登録です。");

    doc.moveDown(0.7);
  }

  doc.moveDown(0.5);
};

// =================================================
// CAREER QUALIFICATIONS
// =================================================

const drawCareerQualifications = (doc, profile) => {
  const lines = [];

  if (profile?.japaneseLanguageLevel) {
    lines.push(
      `日本語能力: ${japaneseLevelLabel(profile.japaneseLanguageLevel)}`,
    );
  }

  for (const item of profile?.qualifications || []) {
    const qualification = [
      item.acquiredDate ? formatJapaneseMonth(item.acquiredDate) : "",

      safeText(item.name, ""),

      safeText(item.levelOrScore, ""),

      item.issuer ? `（${item.issuer}）` : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (qualification) {
      lines.push(qualification);
    }
  }

  drawBulletList(doc, lines);
};

// =================================================
// CAREER CONTENT
// =================================================

const drawCareerContent = (doc, client, profile) => {
  drawDocumentTitle(doc, "職 務 経 歴 書", {
    name: client.fullName,

    showName: true,
  });

  // =================================================
  // SUMMARY
  // =================================================

  drawCareerSectionTitle(doc, "■ 職務要約");

  drawBodyText(doc, profile?.careerSummary, {
    emptyText: "職務要約は未登録です。",
  });

  // =================================================
  // EMPLOYMENT
  // =================================================

  drawCareerSectionTitle(doc, "■ 職務経歴");

  const employment = profile?.employmentHistory || [];

  if (employment.length === 0) {
    drawBodyText(doc, "職務経歴は未登録です。");
  } else {
    employment.forEach((item, index) => {
      drawEmploymentBlock(doc, item, index);
    });
  }

  // =================================================
  // SKILLS
  // =================================================

  drawCareerSectionTitle(doc, "■ 活かせる経験・スキル");

  drawBulletList(doc, profile?.skills || []);

  // =================================================
  // QUALIFICATIONS
  // =================================================

  drawCareerSectionTitle(doc, "■ 資格・語学");

  drawCareerQualifications(doc, profile);

  // =================================================
  // SELF PR
  // =================================================

  drawCareerSectionTitle(doc, "■ 自己PR");

  drawBodyText(doc, profile?.selfPR, {
    emptyText: "自己PRは未登録です。",
  });
};

// =================================================
// CAREER HISTORY
// =================================================

const drawCareerHistory = (doc, client, profile) => {
  addNewPage(doc);

  drawCareerContent(doc, client, profile);
};

// =================================================
// PAGE NUMBERS
// =================================================

const addPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);

    setFont(doc, {
      size: 7.5,

      color: COLORS.muted,
    });

    doc.text(
      `${index + 1} / ${range.count}`,

      doc.page.margins.left,

      doc.page.height - 27,

      {
        width: contentWidth(doc),

        align: "center",

        lineBreak: false,
      },
    );
  }
};

// =================================================
// BUILD JAPANESE CV
//
// type:
// combined
// rirekisho
// career
// =================================================

const buildJapaneseCvPdf = ({ client, profile, type = "combined" }) => {
  const allowedTypes = ["combined", "rirekisho", "career"];

  const selectedType = allowedTypes.includes(type) ? type : "combined";

  const doc = new PDFDocument({
    size: "A4",

    margins: PAGE_MARGIN,

    bufferPages: true,

    autoFirstPage: true,

    info: {
      Title: `${client.fullName} Japanese CV`,

      Author: client.fullName,

      Subject:
        selectedType === "rirekisho"
          ? "履歴書"
          : selectedType === "career"
            ? "職務経歴書"
            : "履歴書・職務経歴書",
    },
  });

  // =================================================
  // PORTABLE JAPANESE FONTS
  //
  // config/pdfFonts.js resolves:
  //
  // assets/fonts/Japanese-Regular.ttf
  // assets/fonts/Japanese-Bold.ttf
  //
  // No dependency on C:/Windows/Fonts
  // =================================================

  registerPdfFonts(doc);

  // =================================================
  // DOCUMENT
  // =================================================

  if (selectedType === "rirekisho") {
    drawRirekisho(doc, client, profile);
  }

  if (selectedType === "career") {
    drawCareerContent(doc, client, profile);
  }

  if (selectedType === "combined") {
    drawRirekisho(doc, client, profile);

    drawCareerHistory(doc, client, profile);
  }

  addPageNumbers(doc);

  return doc;
};

module.exports = {
  buildJapaneseCvPdf,
};
