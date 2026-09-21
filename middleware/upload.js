const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadPath = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// =================================================
// ALLOWED FILE TYPES
// =================================================

const imageMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
]);

const pdfMimeTypes = new Set([
  "application/pdf",
]);

const pdfExtensions = new Set([
  ".pdf",
]);

// =================================================
// STORAGE
// =================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = [
      Date.now(),
      crypto.randomUUID(),
    ].join("-");

    cb(null, `${uniqueName}${extension}`);
  },
});

// =================================================
// FILE VALIDATION
// =================================================

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  // Client image validation
  if (file.fieldname === "clientImage") {
    const validMimeType = imageMimeTypes.has(file.mimetype);
    const validExtension = imageExtensions.has(extension);

    if (!validMimeType || !validExtension) {
      return cb(
        new multer.MulterError(
          "LIMIT_UNEXPECTED_FILE",
          "clientImage must be JPG, JPEG, PNG, GIF, or WEBP",
        ),
      );
    }

    return cb(null, true);
  }

  // CV validation — PDF only
  if (file.fieldname === "cv") {
    const validMimeType = pdfMimeTypes.has(file.mimetype);
    const validExtension = pdfExtensions.has(extension);

    if (!validMimeType || !validExtension) {
      return cb(
        new multer.MulterError(
          "LIMIT_UNEXPECTED_FILE",
          "cv must be a PDF file",
        ),
      );
    }

    return cb(null, true);
  }

  // Reject every unknown upload field
  return cb(
    new multer.MulterError(
      "LIMIT_UNEXPECTED_FILE",
      file.fieldname,
    ),
  );
};

// =================================================
// MULTER CONFIGURATION
// =================================================

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 2,
  },
});

module.exports = upload;