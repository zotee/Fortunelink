const multer = require("multer");
const path = require("path");
const fs = require("fs");

// 📁 Ensure uploads folder exists
const uploadPath = "uploads/";

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

// 📦 Storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// 🔍 File filter (safe + flexible)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",

    // PDF
    "application/pdf",

    // Word docs
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    // fallback (some tools like Postman send this)
    "application/octet-stream",
  ];

  const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;

  const extName = allowedExtensions.test(
    path.extname(file.originalname).toLowerCase()
  );

  const mimeOk = allowedMimeTypes.includes(file.mimetype);

  if (mimeOk || extName) {
    cb(null, true);
  } else {
    console.log("❌ Rejected file:", file.originalname, file.mimetype);
    cb(new Error("Only images, PDFs, DOC, DOCX are allowed"), false);
  }
};

// ⚙️ Multer config
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = upload;