const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// =================================================
// CONSTANTS
// =================================================

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN_LEFT = 42;
const MARGIN_RIGHT = 42;
const MARGIN_TOP = 42;
const MARGIN_BOTTOM = 42;

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// 30mm x 40mm approximately
const PHOTO_WIDTH = 85;
const PHOTO_HEIGHT = 113;

// =================================================
// TEXT HELPERS
// =================================================

const textValue = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "-";
  }

  return String(value).trim();
};

const formatJapaneseDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return textValue(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}年${month}月${day}日`;
};

const formatJapaneseMonth = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return textValue(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}年${month}月`;
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) {
    return "-";
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
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
// JAPANESE LABELS
// =================================================

const genderLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "male" || normalized === "m" || normalized === "男") {
    return "男";
  }

  if (normalized === "female" || normalized === "f" || normalized === "女") {
    return "女";
  }

  return textValue(value);
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

  return map[value] || textValue(value);
};

const educationTypeLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    highschool: "高校",
    "high school": "高校",
    vocational: "専門学校",
    vocationalSchool: "専門学校",
    university: "大学",
    college: "大学",
    languageSchool: "日本語学校",
    japaneseLanguageSchool: "日本語学校",
    graduateSchool: "大学院",
  };

  return map[value] || map[normalized] || textValue(value);
};

const employmentTypeLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    fulltime: "正社員",
    "full-time": "正社員",
    fullTime: "正社員",
    parttime: "アルバイト",
    "part-time": "アルバイト",
    partTime: "アルバイト",
    contract: "契約社員",
    temporary: "派遣社員",
    intern: "インターン",
  };

  return map[value] || map[normalized] || textValue(value);
};

// =================================================
// FONT
// =================================================

const applyJapaneseFont = (doc) => {
  const fontPath = process.env.PDF_FONT_PATH;

  if (!fontPath || !fs.existsSync(fontPath)) {
    const error = new Error(
      "PDF_FONT_PATH must point to a Japanese-capable font file.",
    );

    error.statusCode = 500;

    throw error;
  }

  doc.registerFont("Japanese", fontPath);

  doc.font("Japanese");
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
    path.resolve(process.cwd(), raw.replace(/^\/+/, "")),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

// =================================================
// PAGE SPACE
// =================================================

const ensureSpace = (doc, requiredHeight) => {
  const maxY = PAGE_HEIGHT - MARGIN_BOTTOM;

  if (doc.y + requiredHeight > maxY) {
    doc.addPage();

    doc.font("Japanese");

    doc.y = MARGIN_TOP;

    return true;
  }

  return false;
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
  fontSize = 8.5,
  align = "left",
  bold = false,
  fill = null,
  padding = 5,
}) => {
  if (fill) {
    doc.save().fillColor(fill).rect(x, y, width, height).fill().restore();
  }

  doc.lineWidth(0.7).strokeColor("#222222").rect(x, y, width, height).stroke();

  doc.fillColor("#111111").fontSize(bold ? fontSize + 0.2 : fontSize);

  doc.text(textValue(text), x + padding, y + padding, {
    width: width - padding * 2,

    height: height - padding * 2,

    align,

    valign: "center",

    lineGap: 1,
  });
};

// =================================================
// CELL HEIGHT
// =================================================

const getTextHeight = (doc, value, width, fontSize = 8.5, padding = 5) => {
  doc.fontSize(fontSize);

  const height = doc.heightOfString(textValue(value), {
    width: width - padding * 2,

    lineGap: 1,
  });

  return Math.max(25, height + padding * 2 + 2);
};

// =================================================
// SECTION TITLE
// =================================================

const drawSectionTitle = (doc, title) => {
  ensureSpace(doc, 32);

  const y = doc.y;

  doc
    .save()
    .fillColor("#F2F2F2")
    .rect(MARGIN_LEFT, y, CONTENT_WIDTH, 25)
    .fill()
    .restore();

  doc
    .lineWidth(0.8)
    .strokeColor("#222222")
    .rect(MARGIN_LEFT, y, CONTENT_WIDTH, 25)
    .stroke();

  doc
    .fontSize(11)
    .fillColor("#111111")
    .text(title, MARGIN_LEFT, y + 6, {
      width: CONTENT_WIDTH,
      align: "center",
    });

  doc.y = y + 25;
};

// =================================================
// PERSONAL INFORMATION
// =================================================

const drawPersonalInformation = (doc, client, profile) => {
  drawSectionTitle(doc, "個 人 情 報");

  const tableWidth = CONTENT_WIDTH - PHOTO_WIDTH - 10;

  const startX = MARGIN_LEFT;

  let y = doc.y;

  const labelWidth = 70;

  const valueWidth = tableWidth - labelWidth - 100 - 70;

  const sideLabelWidth = 70;
  const sideValueWidth = 100;

  const rows = [
    {
      leftLabel: "氏名",
      leftValue: client.fullName,
      rightLabel: "生年月日",
      rightValue: formatJapaneseDate(profile?.dateOfBirth),
    },
    {
      leftLabel: "電話番号",
      leftValue: client.phone,
      rightLabel: "年齢",
      rightValue: calculateAge(profile?.dateOfBirth),
    },
    {
      leftLabel: "Email",
      leftValue: profile?.email,
      rightLabel: "性別",
      rightValue: genderLabel(profile?.gender),
    },
    {
      leftLabel: "住所",
      leftValue: [profile?.prefecture, profile?.address]
        .filter(Boolean)
        .join(" "),
      rightLabel: "国籍",
      rightValue: profile?.nationality,
    },
    {
      leftLabel: "在留資格",
      leftValue:
        profile?.statusOfResidence || visaStatusLabel(client.currentVisaStatus),
      rightLabel: "日本語",
      rightValue: profile?.japaneseLanguageLevel,
    },
  ];

  for (const row of rows) {
    const rowHeight = Math.max(
      27,

      getTextHeight(doc, row.leftValue, valueWidth),
    );

    drawCell({
      doc,
      x: startX,
      y,
      width: labelWidth,
      height: rowHeight,
      text: row.leftLabel,
      fill: "#F7F7F7",
      align: "center",
    });

    drawCell({
      doc,
      x: startX + labelWidth,
      y,
      width: valueWidth,
      height: rowHeight,
      text: row.leftValue,
    });

    drawCell({
      doc,
      x: startX + labelWidth + valueWidth,
      y,
      width: sideLabelWidth,
      height: rowHeight,
      text: row.rightLabel,
      fill: "#F7F7F7",
      align: "center",
    });

    drawCell({
      doc,
      x: startX + labelWidth + valueWidth + sideLabelWidth,
      y,
      width: sideValueWidth,
      height: rowHeight,
      text: row.rightValue,
      align: "center",
    });

    y += rowHeight;
  }

  const imagePath = resolveImagePath(profile?.clientImage);

  const photoX = MARGIN_LEFT + tableWidth + 10;

  const photoY = doc.y - rows.reduce((total) => total + 27, 0);

  doc
    .lineWidth(0.8)
    .rect(photoX, MARGIN_TOP + 42, PHOTO_WIDTH, PHOTO_HEIGHT)
    .stroke();

  if (imagePath) {
    try {
      doc.image(imagePath, photoX + 2, MARGIN_TOP + 44, {
        fit: [PHOTO_WIDTH - 4, PHOTO_HEIGHT - 4],

        align: "center",
        valign: "center",
      });
    } catch {
      // Invalid image should not prevent CV generation.
    }
  } else {
    doc
      .fontSize(8)
      .fillColor("#777777")
      .text("写真", photoX, MARGIN_TOP + 90, {
        width: PHOTO_WIDTH,
        align: "center",
      });
  }

  doc.y = Math.max(y, MARGIN_TOP + 42 + PHOTO_HEIGHT) + 14;
};

// =================================================
// EDUCATION
// =================================================

const drawEducation = (doc, education) => {
  drawSectionTitle(doc, "学 歴");

  const widths = [78, 78, 75, 180, CONTENT_WIDTH - 411];

  const headers = ["入学年月", "卒業年月", "種別", "学校名", "専攻・学科"];

  let y = doc.y;

  headers.forEach((header, index) => {
    const x =
      MARGIN_LEFT +
      widths.slice(0, index).reduce((total, width) => total + width, 0);

    drawCell({
      doc,
      x,
      y,
      width: widths[index],
      height: 28,
      text: header,
      fill: "#F7F7F7",
      align: "center",
    });
  });

  y += 28;

  const rows =
    Array.isArray(education) && education.length > 0 ? education : [{}];

  rows.forEach((item) => {
    const values = [
      formatJapaneseMonth(item.enrollmentDate),

      formatJapaneseMonth(item.graduationDate),

      educationTypeLabel(item.educationType),

      item.schoolName,

      item.major,
    ];

    let rowHeight = 28;

    values.forEach((value, index) => {
      rowHeight = Math.max(
        rowHeight,

        getTextHeight(doc, value, widths[index]),
      );
    });

    if (y + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();

      doc.font("Japanese");

      y = MARGIN_TOP;

      headers.forEach((header, index) => {
        const x =
          MARGIN_LEFT +
          widths.slice(0, index).reduce((total, width) => total + width, 0);

        drawCell({
          doc,
          x,
          y,
          width: widths[index],
          height: 28,
          text: header,
          fill: "#F7F7F7",
          align: "center",
        });
      });

      y += 28;
    }

    values.forEach((value, index) => {
      const x =
        MARGIN_LEFT +
        widths.slice(0, index).reduce((total, width) => total + width, 0);

      drawCell({
        doc,
        x,
        y,
        width: widths[index],
        height: rowHeight,
        text: value,
        align: index < 3 ? "center" : "left",
      });
    });

    y += rowHeight;
  });

  doc.y = y + 14;
};

// =================================================
// EMPLOYMENT
// =================================================

const drawEmployment = (doc, employmentHistory) => {
  drawSectionTitle(doc, "職 歴");

  const widths = [85, 85, 90, CONTENT_WIDTH - 260];

  const headers = ["入社年月", "退社年月", "雇用形態", "会社名"];

  let y = doc.y;

  headers.forEach((header, index) => {
    const x =
      MARGIN_LEFT +
      widths.slice(0, index).reduce((total, width) => total + width, 0);

    drawCell({
      doc,
      x,
      y,
      width: widths[index],
      height: 28,
      text: header,
      fill: "#F7F7F7",
      align: "center",
    });
  });

  y += 28;

  const rows =
    Array.isArray(employmentHistory) && employmentHistory.length > 0
      ? employmentHistory
      : [{}];

  rows.forEach((item) => {
    const values = [
      formatJapaneseMonth(item.startDate),

      item.endDate
        ? formatJapaneseMonth(item.endDate)
        : item.companyName
          ? "在職中"
          : "-",

      employmentTypeLabel(item.employmentType),

      item.companyName,
    ];

    let rowHeight = 28;

    values.forEach((value, index) => {
      rowHeight = Math.max(
        rowHeight,

        getTextHeight(doc, value, widths[index]),
      );
    });

    if (y + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();

      doc.font("Japanese");

      y = MARGIN_TOP;

      headers.forEach((header, index) => {
        const x =
          MARGIN_LEFT +
          widths.slice(0, index).reduce((total, width) => total + width, 0);

        drawCell({
          doc,
          x,
          y,
          width: widths[index],
          height: 28,
          text: header,
          fill: "#F7F7F7",
          align: "center",
        });
      });

      y += 28;
    }

    values.forEach((value, index) => {
      const x =
        MARGIN_LEFT +
        widths.slice(0, index).reduce((total, width) => total + width, 0);

      drawCell({
        doc,
        x,
        y,
        width: widths[index],
        height: rowHeight,
        text: value,
        align: index < 3 ? "center" : "left",
      });
    });

    y += rowHeight;
  });

  doc.y = y + 14;
};

// =================================================
// LANGUAGE
// =================================================

const drawLanguage = (doc, profile) => {
  ensureSpace(doc, 100);

  drawSectionTitle(doc, "語 学 能 力");

  const y = doc.y;

  drawCell({
    doc,
    x: MARGIN_LEFT,
    y,
    width: 120,
    height: 34,
    text: "日本語",
    fill: "#F7F7F7",
    align: "center",
  });

  drawCell({
    doc,
    x: MARGIN_LEFT + 120,
    y,
    width: CONTENT_WIDTH - 120,
    height: 34,
    text: profile?.japaneseLanguageLevel || "-",
  });

  doc.y = y + 48;
};

// =================================================
// FOOTER
// =================================================

const addPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);

    doc
      .font("Japanese")
      .fontSize(8)
      .fillColor("#777777")
      .text(`${index + 1} / ${range.count}`, MARGIN_LEFT, PAGE_HEIGHT - 28, {
        width: CONTENT_WIDTH,
        align: "center",
      });
  }
};

// =================================================
// BUILD PDF
// =================================================

const buildJapaneseCvPdf = ({ client, profile }) => {
  const doc = new PDFDocument({
    size: "A4",

    margins: {
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
      left: MARGIN_LEFT,
      right: MARGIN_RIGHT,
    },

    bufferPages: true,

    info: {
      Title: `${client.clientId} Japanese CV`,

      Subject: "履歴・職務経歴書",
    },
  });

  applyJapaneseFont(doc);

  // =================================================
  // TITLE
  // =================================================

  doc
    .fontSize(18)
    .fillColor("#111111")
    .text("履歴・職務経歴書", MARGIN_LEFT, MARGIN_TOP, {
      width: CONTENT_WIDTH,
    });

  doc.y = MARGIN_TOP + 38;

  // =================================================
  // CONTENT
  // =================================================

  drawPersonalInformation(doc, client, profile);

  drawEducation(doc, profile?.education || []);

  drawEmployment(doc, profile?.employmentHistory || []);

  drawLanguage(doc, profile);

  // =================================================
  // IDENTIFIER
  // =================================================

  ensureSpace(doc, 50);

  doc
    .fontSize(8)
    .fillColor("#666666")
    .text(`Client ID: ${client.clientId}`, MARGIN_LEFT, doc.y + 5);

  addPageNumbers(doc);

  return doc;
};

module.exports = {
  buildJapaneseCvPdf,
};
