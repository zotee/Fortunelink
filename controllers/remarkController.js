const mongoose = require("mongoose");
const Client = require("../model/clientSchema");
const Remark = require("../model/remarkSchema");

// MongoDB _id of the logged-in staff/admin
const getLoggedInUserId = (req) => {
  return req.user?._id || req.user?.id || null;
};

// Custom staff ID, for example W-122261
const getLoggedInStaffId = (req) => {
  const staffId =
    req.user?.staffId ||
    req.user?.staff?.staffId ||
    null;

  if (!staffId) {
    return null;
  }

  return String(staffId).trim().toUpperCase();
};

const normalizeClientId = (clientId) => {
  if (!clientId) {
    return null;
  }

  return decodeURIComponent(String(clientId)).trim();
};

const isAdmin = (req) => {
  const role = String(req.user?.role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  return [
    "admin",
    "superadmin",
    "masteradmin",
  ].includes(role);
};

const canAccessClient = (req, client) => {
  if (isAdmin(req)) {
    return true;
  }

  const loggedInStaffId = getLoggedInStaffId(req);

  if (!loggedInStaffId || !client.assignedStaff) {
    return false;
  }

  const assignedStaffId = String(client.assignedStaff)
    .trim()
    .toUpperCase();

  return assignedStaffId === loggedInStaffId;
};

// =====================================
// CREATE REMARK
// POST /api/remarks
// =====================================
exports.createRemark = async (req, res) => {
  try {
    const clientId = normalizeClientId(req.body.clientId);
    const remarks = String(req.body.remarks || "").trim();
    const medium = String(req.body.medium || "").trim();

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

    // Search using custom client ID, for example J-176587345
    const client = await Client.findOne({
      clientId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot add a remark to this client.",
      });
    }

    const loggedInUserId = getLoggedInUserId(req);

    if (!isAdmin(req) && !loggedInUserId) {
      return res.status(401).json({
        success: false,
        message: "Logged-in staff information is missing.",
      });
    }

    const staffName =
      req.user?.name ||
      req.user?.fullName ||
      req.user?.email ||
      (isAdmin(req) ? "Admin" : "Staff");

    const remark = await Remark.create({
      // Store the client's MongoDB ObjectId
      clientId: client._id,

      // Admin remarks can have a null staffId
      staffId: isAdmin(req) ? null : loggedInUserId,

      staffName,
      remarks,
      medium,
    });

    const populatedRemark = await Remark.findById(
      remark._id
    )
      .populate({
        path: "staffId",
        select: "staffId name fullName email",
      })
      .lean();

    return res.status(201).json({
      success: true,
      message: "Remark added successfully.",
      data: populatedRemark,
    });
  } catch (error) {
    console.error("Create remark error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to add remark.",
    });
  }
};

// =====================================
// GET CLIENT REMARKS
// GET /api/remarks/client/J-176587345
// =====================================
exports.getClientRemarks = async (req, res) => {
  try {
    const clientId = normalizeClientId(
      req.params.clientId
    );

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }

    const client = await Client.findOne({
      clientId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot access this client's remarks.",
      });
    }

    const remarks = await Remark.find({
      clientId: client._id,
    })
      .populate({
        path: "staffId",
        select: "staffId name fullName email",
      })
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: remarks.length,
      data: remarks,
    });
  } catch (error) {
    console.error("Get remarks error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to retrieve remarks.",
    });
  }
};

// =====================================
// DELETE REMARK
// DELETE /api/remarks/:id
// =====================================
exports.deleteRemark = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid remark ID.",
      });
    }

    const remark = await Remark.findById(id);

    if (!remark) {
      return res.status(404).json({
        success: false,
        message: "Remark not found.",
      });
    }

    const client = await Client.findById(
      remark.clientId
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Related client not found.",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot access this client's remarks.",
      });
    }

    const loggedInUserId = getLoggedInUserId(req);

    const ownsRemark =
      remark.staffId &&
      loggedInUserId &&
      String(remark.staffId) ===
        String(loggedInUserId);

    if (!isAdmin(req) && !ownsRemark) {
      return res.status(403).json({
        success: false,
        message:
          "You can only delete remarks created by you.",
      });
    }

    await remark.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Remark deleted successfully.",
      data: {
        id: remark._id,
      },
    });
  } catch (error) {
    console.error("Delete remark error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to delete remark.",
    });
  }
};

