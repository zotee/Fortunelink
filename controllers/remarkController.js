const Client = require("../model/clientSchema");
const Remark = require("../model/remarkSchema");

// =================================================
// HELPERS
// =================================================

const normalizeClientId = (clientId) => {
  if (!clientId) {
    return null;
  }

  return decodeURIComponent(String(clientId)).trim();
};

// =================================================
// CLIENT ACCESS
//
// Super Admin:
// can access every client
//
// Staff:
// only clients assigned to themselves
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
// PARSE REMARK DATE
//
// Frontend sends:
//
// 2026-09-13
//
// That represents the selected date in Japan.
// =================================================

const parseRemarkDate = (value) => {
  // If frontend doesn't send a date,
  // use current time.
  if (!value) {
    return new Date();
  }

  const input = String(value).trim();

  let date;

  // Date-only input
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    // Treat selected date as Tokyo date
    date = new Date(`${input}T00:00:00+09:00`);
  } else {
    date = new Date(input);
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// =================================================
// CREATE REMARK
//
// POST /api/remarks
//
// BODY:
//
// {
//   "clientId": "J-176587355",
//   "remarkDate": "2026-09-13",
//   "medium": "WhatsApp",
//   "remarks": "Client confirmed documents."
// }
// =================================================

exports.createRemark = async (req, res) => {
  try {
    const clientId = normalizeClientId(req.body.clientId);

    const remarks = String(req.body.remarks || "").trim();

    const medium = String(req.body.medium || "").trim();

    const remarkDate = parseRemarkDate(req.body.remarkDate);

    // =================================================
    // VALIDATION
    // =================================================

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Remark is required.",
      });
    }

    if (!medium) {
      return res.status(400).json({
        success: false,
        message: "Medium is required.",
      });
    }

    if (!remarkDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid remark date.",
      });
    }

    // =================================================
    // FIND CLIENT
    // =================================================

    const client = await Client.findOne({
      clientId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    // =================================================
    // ACCESS CHECK
    // =================================================

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to add remarks to this client.",
      });
    }

    // =================================================
    // CREATOR INFORMATION
    //
    // NEVER trust these from frontend.
    // Always get them from authenticated req.user.
    // =================================================

    const createdBy = req.user.id;

    const createdByRole = req.user.role;

    const staffName = req.user.name;

    const staffId = req.user.role === "staff" ? req.user.staffId : null;

    const staffRef = req.user.role === "staff" ? req.user.id : null;

    if (!createdBy || !staffName) {
      return res.status(401).json({
        success: false,

        message: "Authenticated user information is missing.",
      });
    }

    // =================================================
    // CREATE REMARK
    // =================================================

    const remark = await Remark.create({
      clientId: client._id,

      clientCode: client.clientId,

      createdBy,

      createdByRole,

      staffRef,

      staffId,

      staffName,

      remarkDate,

      medium,

      remarks,
    });

    // =================================================
    // RESPONSE
    // =================================================

    const savedRemark = await Remark.findById(remark._id)
      .populate({
        path: "staffRef",
        select: "staffId name email",
      })
      .lean();

    return res.status(201).json({
      success: true,

      message: "Remark added successfully.",

      data: savedRemark,
    });
  } catch (error) {
    console.error("CREATE REMARK ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to add remark.",
    });
  }
};

// =================================================
// GET CLIENT REMARK HISTORY
//
// GET
// /api/remarks/client/J-176587355
//
// Super Admin:
// can view any client remarks
//
// Staff:
// only their assigned client remarks
// =================================================

exports.getClientRemarks = async (req, res) => {
  try {
    const clientId = normalizeClientId(req.params.clientId);

    if (!clientId) {
      return res.status(400).json({
        success: false,

        message: "Client ID is required.",
      });
    }

    // =================================================
    // FIND CLIENT
    // =================================================

    const client = await Client.findOne({
      clientId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,

        message: "Client not found.",
      });
    }

    // =================================================
    // ACCESS CHECK
    // =================================================

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to access this client's remarks.",
      });
    }

    // =================================================
    // REMARK HISTORY
    // =================================================

    const remarks = await Remark.find({
      clientId: client._id,
    })
      .populate({
        path: "staffRef",
        select: "staffId name email",
      })
      .sort({
        remarkDate: -1,
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,

      count: remarks.length,

      data: remarks,
    });
  } catch (error) {
    console.error("GET REMARKS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to retrieve remarks.",
    });
  }
};
