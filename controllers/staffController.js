const mongoose = require("mongoose");

const Staff = require("../model/staffSchema");
const Client = require("../model/clientSchema");
const CounterModel = require("../model/CounterModel");

// Find staff using either MongoDB _id or generated staffId
const findStaff = async (id, includePassword = false) => {
  const normalizedId = decodeURIComponent(
    String(id || ""),
  ).trim();

  if (!normalizedId) {
    return null;
  }

  const filter = mongoose.Types.ObjectId.isValid(normalizedId)
    ? {
        $or: [
          {
            _id: normalizedId,
          },
          {
            staffId: normalizedId.toUpperCase(),
          },
        ],
      }
    : {
        staffId: normalizedId.toUpperCase(),
      };

  const query = Staff.findOne(filter);

  if (!includePassword) {
    query.select("-password");
  }

  return query;
};

// CREATE STAFF
// POST /api/staff
const createStaff = async (req, res) => {
  try {
    const {
      name,
      phone,
      location,
      email,
      password,
    } = req.body;

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !location?.trim() ||
      !email?.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, phone, location, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingStaff = await Staff.findOne({
      email: normalizedEmail,
    });

    if (existingStaff) {
      return res.status(409).json({
        success: false,
        message: "Staff with this email already exists.",
      });
    }

    const counter = await CounterModel.findOneAndUpdate(
      {
        _id: "StaffId",
      },
      {
        $inc: {
          sequence_value: 1,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const generatedStaffId = `W-${counter.sequence_value}`;

    const staff = new Staff({
      staffId: generatedStaffId,
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      email: normalizedEmail,
      password,
      role: "staff",
      isActive: true,
    });

    // The staffSchema pre-save middleware hashes the password
    await staff.save();

    const staffData = staff.toObject();

    delete staffData.password;

    return res.status(201).json({
      success: true,
      message: "Staff created successfully.",
      data: {
        ...staffData,
        totalClients: 0,
      },
    });
  } catch (error) {
    console.error("CREATE STAFF ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or Staff ID already exists.",
        duplicateFields: error.keyValue || {},
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
      message: error.message || "Failed to create staff.",
    });
  }
};

// GET ALL STAFF WITH CLIENT COUNTS
// GET /api/staff
const getAllStaff = async (req, res) => {
  try {
    const staffList = await Staff.find()
      .select("-password")
      .sort({
        createdAt: -1,
      })
      .lean();

    const staffIds = staffList
      .map((staff) => staff.staffId)
      .filter(Boolean);

    const clientCounts = await Client.aggregate([
      {
        $match: {
          assignedStaff: {
            $in: staffIds,
          },
        },
      },
      {
        $group: {
          _id: "$assignedStaff",
          totalClients: {
            $sum: 1,
          },
        },
      },
    ]);

    const clientCountMap = new Map(
      clientCounts.map((item) => [
        item._id,
        item.totalClients,
      ]),
    );

    const result = staffList.map((staff) => ({
      ...staff,
      totalClients:
        clientCountMap.get(staff.staffId) || 0,
    }));

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("GET ALL STAFF ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get staff.",
    });
  }
};

// GET ONE STAFF WITH THEIR CLIENT LIST
// Supports:
// GET /api/staff/6aa0fb0bd3d49da506b00719
// GET /api/staff/W-122261
const getOneStaff = async (req, res) => {
  try {
    const staff = await findStaff(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const clients = await Client.find({
      assignedStaff: staff.staffId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...staff.toObject(),
        totalClients: clients.length,
        clients,
      },
    });
  } catch (error) {
    console.error("GET ONE STAFF ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get staff.",
    });
  }
};

// GET ONLY THE CLIENTS ASSIGNED TO ONE STAFF
// GET /api/staff/W-122261/clients
const getStaffClients = async (req, res) => {
  try {
    const staff = await findStaff(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1,
    );

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      100,
    );

    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    const filter = {
      assignedStaff: staff.staffId,
    };

    if (search) {
      filter.$or = [
        {
          clientId: {
            $regex: search,
            $options: "i",
          },
        },
        {
          fullName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      Client.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      staff: {
        _id: staff._id,
        staffId: staff.staffId,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        location: staff.location,
        isActive: staff.isActive,
      },
      count: clients.length,
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET STAFF CLIENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to get staff clients.",
    });
  }
};

// UPDATE STAFF
// Supports MongoDB _id or generated staffId
// PATCH /api/staff/W-122261
const updateStaff = async (req, res) => {
  try {
    const staff = await findStaff(req.params.id, true);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const {
      name,
      phone,
      location,
      email,
      password,
      isActive,
    } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }

      staff.name = String(name).trim();
    }

    if (phone !== undefined) {
      if (!String(phone).trim()) {
        return res.status(400).json({
          success: false,
          message: "Phone cannot be empty.",
        });
      }

      staff.phone = String(phone).trim();
    }

    if (location !== undefined) {
      if (!String(location).trim()) {
        return res.status(400).json({
          success: false,
          message: "Location cannot be empty.",
        });
      }

      staff.location = String(location).trim();
    }

    if (email !== undefined) {
      const normalizedEmail = String(email)
        .toLowerCase()
        .trim();

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty.",
        });
      }

      const existingEmail = await Staff.findOne({
        email: normalizedEmail,
        _id: {
          $ne: staff._id,
        },
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message:
            "Another staff member already uses this email.",
        });
      }

      staff.email = normalizedEmail;
    }

    if (password !== undefined && password !== "") {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters.",
        });
      }

      staff.password = password;
    }

    if (isActive !== undefined) {
      staff.isActive =
        isActive === true ||
        isActive === "true";
    }

    await staff.save();

    const staffData = staff.toObject();

    delete staffData.password;

    const totalClients = await Client.countDocuments({
      assignedStaff: staff.staffId,
    });

    return res.status(200).json({
      success: true,
      message: "Staff updated successfully.",
      data: {
        ...staffData,
        totalClients,
      },
    });
  } catch (error) {
    console.error("UPDATE STAFF ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or Staff ID already exists.",
        duplicateFields: error.keyValue || {},
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
      message: error.message || "Failed to update staff.",
    });
  }
};

// DELETE STAFF
// Supports MongoDB _id or generated staffId
// DELETE /api/staff/W-122261
const deleteStaff = async (req, res) => {
  try {
    const staff = await findStaff(req.params.id, true);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const clientCount = await Client.countDocuments({
      assignedStaff: staff.staffId,
    });

    if (clientCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "This staff has assigned clients. Reassign the clients before deleting the staff.",
        totalClients: clientCount,
      });
    }

    await Staff.findByIdAndDelete(staff._id);

    return res.status(200).json({
      success: true,
      message: "Staff deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE STAFF ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete staff.",
    });
  }
};

module.exports = {
  createStaff,
  getAllStaff,
  getOneStaff,
  getStaffClients,
  updateStaff,
  deleteStaff,
};