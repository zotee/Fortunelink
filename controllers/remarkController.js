const mongoose = require("mongoose");
const Client = require("../model/clientSchema");
const Remark = require("../model/remarkSchema");

const getLoggedInUserId = (req) => {
  return req.user?.id || req.user?._id;
};

const isAdmin = (req) => {
  const role = String(req.user?.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  return ["admin", "superadmin", "masteradmin"].includes(role);
};

const canAccessClient = (req, client) => {
  if (isAdmin(req)) {
    return true;
  }

  const loggedInUserId = getLoggedInUserId(req);

  if (!loggedInUserId || !client.assignedStaff) {
    return false;
  }

  return (
    client.assignedStaff.toString() ===
    loggedInUserId.toString()
  );
};

// =====================================
// CREATE REMARK
// =====================================
exports.createRemark = async (req, res) => {
  try {
    const { clientId, remarks, medium } = req.body;

    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    if (!remarks?.trim() || !medium) {
      return res.status(400).json({
        success: false,
        message: "Remarks and medium are required",
      });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message: "You cannot add remarks to this client",
      });
    }

    const loggedInUserId = getLoggedInUserId(req);

    const staffName =
      req.user?.name ||
      req.user?.fullName ||
      req.user?.email ||
      "Admin";

    const remark = await Remark.create({
      clientId: client._id,
      staffId: isAdmin(req) ? null : loggedInUserId,
      staffName,
      remarks: remarks.trim(),
      medium,
    });

    return res.status(201).json({
      success: true,
      message: "Remark added successfully",
      data: remark,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// GET CLIENT REMARKS
// =====================================
exports.getClientRemarks = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this client's remarks",
      });
    }

    const remarks = await Remark.find({ clientId })
      .populate("staffId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: remarks.length,
      data: remarks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// DELETE REMARK
// =====================================
exports.deleteRemark = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid remark ID",
      });
    }

    const remark = await Remark.findById(id);

    if (!remark) {
      return res.status(404).json({
        success: false,
        message: "Remark not found",
      });
    }

    const client = await Client.findById(remark.clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Related client not found",
      });
    }

    const loggedInUserId = getLoggedInUserId(req);

    const ownsRemark =
      remark.staffId &&
      loggedInUserId &&
      remark.staffId.toString() === loggedInUserId.toString();

    if (!isAdmin(req) && !ownsRemark) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this remark",
      });
    }

    await remark.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Remark deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};