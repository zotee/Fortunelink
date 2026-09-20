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
// SAFE FILE NAME
// =================================================

const sanitizeFileName = (value) => {
  return String(value || "client")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$|/g, "");
};

// =================================================
// GENERATE JAPANESE CV
//
// GET /api/clients/:clientId/japanese-cv
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
    // PDF
    // =================================================

    const safeName = sanitizeFileName(client.fullName);

    const filename = `${client.clientId}_${safeName}_Japanese-CV.pdf`;

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = buildJapaneseCvPdf({
      client,
      profile,
    });

    doc.on("error", (error) => {
      console.error("JAPANESE CV PDF ERROR:", error);

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
