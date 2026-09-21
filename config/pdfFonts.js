const fs = require("fs");
const path = require("path");

const PDF_FONT_NAMES = {
  regular: "JapaneseRegular",
  bold: "JapaneseBold",
};

const DEFAULT_REGULAR_FONT_PATH = "assets/fonts/Japanese-Regular.ttf";

const DEFAULT_BOLD_FONT_PATH = "assets/fonts/Japanese-Bold.ttf";

const resolveProjectPath = (value) => {
  if (!value) {
    return null;
  }

  const configuredPath = String(value).trim();

  if (!configuredPath) {
    return null;
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return path.resolve(process.cwd(), configuredPath);
};

const getPdfFontPaths = () => {
  return {
    regularPath: resolveProjectPath(
      process.env.PDF_FONT_PATH || DEFAULT_REGULAR_FONT_PATH,
    ),

    boldPath: resolveProjectPath(
      process.env.PDF_FONT_BOLD_PATH || DEFAULT_BOLD_FONT_PATH,
    ),
  };
};

const assertFontExists = (fontPath, label) => {
  if (!fontPath) {
    throw new Error(`${label} PDF font path is not configured.`);
  }

  if (!fs.existsSync(fontPath)) {
    throw new Error(`${label} Japanese PDF font not found: ${fontPath}`);
  }

  if (!fs.statSync(fontPath).isFile()) {
    throw new Error(
      `${label} Japanese PDF font path is not a file: ${fontPath}`,
    );
  }
};

const validatePdfFonts = () => {
  const { regularPath, boldPath } = getPdfFontPaths();

  assertFontExists(regularPath, "Regular");

  assertFontExists(boldPath, "Bold");

  return {
    regularPath,
    boldPath,
  };
};

const registerPdfFonts = (doc) => {
  const { regularPath, boldPath } = validatePdfFonts();

  try {
    doc.registerFont(PDF_FONT_NAMES.regular, regularPath);

    doc.registerFont(PDF_FONT_NAMES.bold, boldPath);

    doc.font(PDF_FONT_NAMES.regular);

    return {
      regular: PDF_FONT_NAMES.regular,
      bold: PDF_FONT_NAMES.bold,
      regularPath,
      boldPath,
    };
  } catch (error) {
    console.error("PDF FONT REGISTRATION ERROR:", {
      regularPath,
      boldPath,
      message: error.message,
    });

    throw new Error(
      "Japanese PDF fonts exist but could not be loaded by PDFKit.",
    );
  }
};

module.exports = {
  PDF_FONT_NAMES,
  getPdfFontPaths,
  validatePdfFonts,
  registerPdfFonts,
};
