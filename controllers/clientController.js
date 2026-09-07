const mongoose = require("mongoose");
const Client = require("../model/clientSchema");
const Remark = require("../model/remarkSchema");
const Staff = require("../model/staffSchema");

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

  const assignedStaffId =
    client.assignedStaff?._id || client.assignedStaff;

  return assignedStaffId.toString() === loggedInUserId.toString();
};

// =====================================
// CREATE CLIENT
// =====================================
exports.createClient = async (req, res) => {
  try {
    const {
      clientId,
      fullName,
      phone,
      visaType,
      assignedStaff,
      coeStatus,
      clientStatus,
    } = req.body;

    if (
      clientId === undefined ||
      !fullName?.trim() ||
      !phone?.trim() ||
      !visaType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Client ID, full name, phone and visa type are required",
      });
    }

    const loggedInUserId = getLoggedInUserId(req);

    if (!loggedInUserId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user was not found",
      });
    }

    /*
      Staff-created client: automatically assigned to that staff.
      Admin-created client: assignedStaff must be sent in body.
    */
    const staffId = isAdmin(req)
      ? assignedStaff
      : loggedInUserId;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Assigned staff is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assigned staff ID",
      });
    }

    const staffExists = await Staff.exists({ _id: staffId });

    if (!staffExists) {
      return res.status(404).json({
        success: false,
        message: "Assigned staff was not found",
      });
    }

    const existingClient = await Client.findOne({ clientId });

    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: "This client ID already exists",
      });
    }

    const clientData = {
      clientId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      visaType,
      assignedStaff: staffId,
    };

    if (coeStatus !== undefined) {
      clientData.coeStatus = coeStatus;
    }

    if (clientStatus !== undefined) {
      clientData.clientStatus = clientStatus;
    }

    const client = await Client.create(clientData);

    await client.populate(
      "assignedStaff",
      "name email phone role"
    );

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: {
        ...client.toObject(),
        remarks: [],
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This client ID already exists",
      });
    }

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
// GET ALL CLIENTS — ADMIN ONLY
// =====================================
exports.getAllClients = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can view all clients",
      });
    }

    const clients = await Client.find()
      .populate("assignedStaff", "name email phone role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// GET LOGGED-IN STAFF CLIENTS
// =====================================
exports.getClientsByStaff = async (req, res) => {
  try {
    const staffId = getLoggedInUserId(req);

    if (!staffId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user was not found",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid logged-in staff ID",
      });
    }

    const clients = await Client.find({
      assignedStaff: staffId,
    })
      .populate("assignedStaff", "name email phone role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// GET CLIENTS OF A SPECIFIC STAFF
// ADMIN ONLY
// =====================================
exports.getClientsByStaffId = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can view another staff member's clients",
      });
    }

    const { staffId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const staffExists = await Staff.exists({ _id: staffId });

    if (!staffExists) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    const clients = await Client.find({
      assignedStaff: staffId,
    })
      .populate("assignedStaff", "name email phone role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// GET CLIENT BY MONGODB ID WITH REMARKS
// =====================================
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    const client = await Client.findById(id).populate(
      "assignedStaff",
      "name email phone role"
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message: "You cannot access this client",
      });
    }

    const remarks = await Remark.find({
      clientId: client._id,
    })
      .populate("staffId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        ...client.toObject(),
        remarks,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// UPDATE CLIENT
// =====================================
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message: "You cannot update this client",
      });
    }

    const allowedFields = [
      "fullName",
      "phone",
      "visaType",
      "coeStatus",
      "clientStatus",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (
          typeof req.body[field] === "string" &&
          ["fullName", "phone"].includes(field)
        ) {
          client[field] = req.body[field].trim();
        } else {
          client[field] = req.body[field];
        }
      }
    });

    await client.save();

    await client.populate(
      "assignedStaff",
      "name email phone role"
    );

    const remarks = await Remark.find({
      clientId: client._id,
    })
      .populate("staffId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: {
        ...client.toObject(),
        remarks,
      },
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
// ASSIGN OR REASSIGN CLIENT
// ADMIN ONLY
// =====================================
exports.assignClientToStaff = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can assign clients",
      });
    }

    const { id } = req.params;
    const { staffId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const staffExists = await Staff.exists({ _id: staffId });

    if (!staffExists) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    const client = await Client.findByIdAndUpdate(
      id,
      {
        assignedStaff: staffId,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate("assignedStaff", "name email phone role");

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const remarks = await Remark.find({
      clientId: client._id,
    })
      .populate("staffId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Client assigned successfully",
      data: {
        ...client.toObject(),
        remarks,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// DELETE CLIENT AND REMARKS
// ADMIN ONLY
// =====================================
exports.deleteClient = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete clients",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    await Remark.deleteMany({
      clientId: client._id,
    });

    await client.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Client and remarks deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};