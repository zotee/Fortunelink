const Client = require("../model/clientSchema");

const ProfileModule = require("../model/profileSchema");

const Profile = ProfileModule.Profile || ProfileModule;

const { buildJapaneseCvPdf } = require("../services/clientJapaneseCvService");

// =================================================
// ACCESS
// =================================================

const canAccessClient = (req, client) => {
  if (req.user.role === "superadmin") {
    return true;
  }

  if (req.user.role === "staff") {
    return client.assignedStaff === req.user.staffId;
  }

  return false;
};

// =================================================
// FILE NAME
// =================================================

const sanitizeFileName = (value) => {
  return String(value || "client")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

// =================================================
// DOCUMENT TYPE
// =================================================

const normalizeDocumentType = (value) => {
  const type = String(value || "combined")
    .trim()
    .toLowerCase();

  if (["combined", "rirekisho", "career"].includes(type)) {
    return type;
  }

  return null;
};

// =================================================
// TYPE FILE LABEL
// =================================================

const getDocumentFileLabel = (type) => {
  if (type === "rirekisho") {
    return "Rirekisho";
  }

  if (type === "career") {
    return "Career-History";
  }

  return "Japanese-CV";
};

// =================================================
// GENERATE JAPANESE CV
//
// GET /api/clients/:clientId/japanese-cv
//
// Optional:
// ?type=combined
// ?type=rirekisho
// ?type=career
// =================================================

exports.generateJapaneseCv = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,

        message: "Client ID is required.",
      });
    }

    // =================================================
    // DOCUMENT TYPE
    // =================================================

    const documentType = normalizeDocumentType(req.query.type);

    if (!documentType) {
      return res.status(400).json({
        success: false,

        message: "CV type must be combined, rirekisho or career.",
      });
    }

    // =================================================
    // CLIENT
    // =================================================

    const client = await Client.findOne({
      clientId,
    }).lean();

    if (!client) {
      return res.status(404).json({
        success: false,

        message: "Client not found.",
      });
    }

    // =================================================
    // ACCESS
    // =================================================

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to generate this client's CV.",
      });
    }

    // =================================================
    // PROFILE
    // =================================================

    const profile = await Profile.findOne({
      clientId: client.clientId,
    }).lean();

    if (!profile) {
      return res.status(404).json({
        success: false,

        message: "Client profile not found.",
      });
    }

    // =================================================
    // FILE NAME
    // =================================================

    const safeClientId = sanitizeFileName(client.clientId);

    const safeName = sanitizeFileName(client.fullName) || "Client";

    const documentLabel = getDocumentFileLabel(documentType);

    const filename = `${safeClientId}_${safeName}_${documentLabel}.pdf`;

    // =================================================
    // RESPONSE HEADERS
    // =================================================

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      [
        `attachment; filename="${filename}"`,
        `filename*=UTF-8''${encodeURIComponent(filename)}`,
      ].join("; "),
    );

    res.setHeader("Cache-Control", "no-store");

    // =================================================
    // PDF
    // =================================================

    const doc = buildJapaneseCvPdf({
      client,
      profile,
      type: documentType,
    });

    doc.on("error", (error) => {
      console.error("JAPANESE CV PDF STREAM ERROR:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,

          message: "Failed to generate Japanese CV.",
        });
      } else {
        res.destroy(error);
      }
    });

    doc.pipe(res);

    doc.end();
  } catch (error) {
    console.error("GENERATE JAPANESE CV ERROR:", error);

    if (!res.headersSent) {
      return res.status(error.statusCode || 500).json({
        success: false,

        message: error.message || "Failed to generate Japanese CV.",
      });
    }

    return;
  }
};
