require("dotenv").config();

const { validatePdfFonts } = require("../config/pdfFonts");

try {
  const { regularPath, boldPath } = validatePdfFonts();

  console.log("");
  console.log("======================================");
  console.log(" Japanese PDF Font Check");
  console.log("======================================");
  console.log("");

  console.log("Regular font:", regularPath);

  console.log("Bold font:", boldPath);

  console.log("");
  console.log("✅ Japanese PDF fonts are ready.");
  console.log("");
} catch (error) {
  console.error("");
  console.error("❌ Japanese PDF font check failed.");

  console.error(error.message);

  console.error("");

  process.exit(1);
}
