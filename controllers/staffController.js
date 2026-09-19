const mongoose = require("mongoose");

const Staff = require("../model/staffSchema");
const Admin = require("../model/adminModel");
const Client = require("../model/clientSchema");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseStaffListQuery = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 10, 1),
    100,
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    keyword: String(query.keyword || query.free_word || "").trim(),
    staffId: String(query.staffId || "").trim().toUpperCase(),
    location: String(query.location || "").trim(),
    isActive:
      query.isActive === "true" ? true : query.isActive === "false" ? false : null,
  };
};

// =================================================
// FIND STAFF
// Supports MongoDB _id or generated staffId
// =================================================

const findStaff = async (id, includePassword = false) => {
  const normalizedId = decodeURIComponent(String(id || "")).trim();

  if (!normalizedId) {
    return null;
  }

  const filter = mongoose.Types.ObjectId.isValid(normalizedId)
    ? {
        $or: [
          { _id: normalizedId },
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

// =================================================
// CREATE STAFF
// POST /api/staff
// =================================================

const createStaff = async (req, res) => {
  try {
    const { name, phone, location, email, password } = req.body;

    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !location?.trim() ||
      !email?.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, location, email and password are required.",
      });
    }

    // =================================================
    // PASSWORD VALIDATION
    // =================================================

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // =================================================
    // CHECK STAFF EMAIL
    // =================================================

    const existingStaff = await Staff.findOne({
      email: normalizedEmail,
    });

    if (existingStaff) {
      return res.status(409).json({
        success: false,
        message: "Staff with this email already exists.",
      });
    }

    // =================================================
    // PREVENT STAFF FROM USING ADMIN EMAIL
    // =================================================

    const existingAdmin = await Admin.findOne({
      email: normalizedEmail,
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "This email is already used by an Admin account.",
      });
    }

    // =================================================
    // CREATE STAFF
    //
    // staffId is automatically generated
    // inside staffSchema.js
    //
    // password is automatically hashed
    // inside staffSchema.js
    // =================================================

    const staff = new Staff({
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      email: normalizedEmail,
      password,
    });

    await staff.save();

    // =================================================
    // REMOVE PASSWORD FROM RESPONSE
    // =================================================

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

// =================================================
// GET ALL STAFF
// GET /api/staff
// =================================================

const getAllStaff = async (req, res) => {
  try {
    const { page, limit, skip, keyword, staffId, location, isActive } =
      parseStaffListQuery(req.query);

    const filter = {};

    if (staffId) {
      filter.staffId = staffId;
    }

    if (location) {
      filter.location = location;
    }

    if (isActive !== null) {
      filter.isActive = isActive;
    }

    if (keyword) {
      const searchRegex = { $regex: escapeRegex(keyword), $options: "i" };
      filter.$or = [
        { staffId: searchRegex },
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { location: searchRegex },
      ];
    }

    const [staffList, total] = await Promise.all([
      Staff.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Staff.countDocuments(filter),
    ]);

    const staffIds = staffList.map((staff) => staff.staffId).filter(Boolean);

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
      clientCounts.map((item) => [item._id, item.totalClients]),
    );

    const result = staffList.map((staff) => ({
      ...staff,

      totalClients: clientCountMap.get(staff.staffId) || 0,
    }));

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
      pagination: {
        current_page: page,
        last_page: total > 0 ? Math.ceil(total / limit) : 0,
        per_page: limit,
        total,
        from: total === 0 ? null : skip + 1,
        to: total === 0 ? null : Math.min(skip + result.length, total),
        has_next_page: page < Math.ceil(total / limit),
        has_previous_page: page > 1,
      },
      filters: {
        keyword: keyword || null,
        staffId: staffId || null,
        location: location || null,
        isActive,
      },
    });
  } catch (error) {
    console.error("GET ALL STAFF ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get staff.",
    });
  }
};

// =================================================
// GET ONE STAFF
// GET /api/staff/W-122257
// =================================================

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

// =================================================
// GET CLIENTS ASSIGNED TO STAFF
// GET /api/staff/:id/clients
// =================================================

const getStaffClients = async (req, res) => {
  try {
    const staff = await findStaff(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

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
        {
          visaType: {
            $regex: search,
            $options: "i",
          },
        },
        {
          clientStatus: {
            $regex: search,
            $options: "i",
          },
        },
        {
          clientId: {
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
      message: error.message || "Failed to get staff clients.",
    });
  }
};

// =================================================
// UPDATE STAFF INFORMATION
// PATCH /api/staff/:id
// =================================================

const updateStaff = async (req, res) => {
  try {
    const staff = await findStaff(req.params.id, true);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const { name, phone, location, email, password } = req.body;

    // =================================================
    // NAME
    // =================================================

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }

      staff.name = String(name).trim();
    }

    // =================================================
    // PHONE
    // =================================================

    if (phone !== undefined) {
      if (!String(phone).trim()) {
        return res.status(400).json({
          success: false,
          message: "Phone cannot be empty.",
        });
      }

      staff.phone = String(phone).trim();
    }

    // =================================================
    // LOCATION
    // =================================================

    if (location !== undefined) {
      if (!String(location).trim()) {
        return res.status(400).json({
          success: false,
          message: "Location cannot be empty.",
        });
      }

      staff.location = String(location).trim();
    }

    // =================================================
    // EMAIL
    // =================================================

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty.",
        });
      }

      const existingStaff = await Staff.findOne({
        email: normalizedEmail,

        _id: {
          $ne: staff._id,
        },
      });

      if (existingStaff) {
        return res.status(409).json({
          success: false,
          message: "Another staff member already uses this email.",
        });
      }

      const existingAdmin = await Admin.findOne({
        email: normalizedEmail,
      });

      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: "This email is already used by an Admin account.",
        });
      }

      staff.email = normalizedEmail;
    }

    // =================================================
    // PASSWORD
    // =================================================

    if (password !== undefined && password !== "") {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters.",
        });
      }

      // staffSchema pre-save hook
      // will automatically hash this
      staff.password = password;
    }

    // =================================================
    // SAVE
    // =================================================

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

// =================================================
// UPDATE STAFF ACTIVE STATUS
// PATCH /api/staff/:id/status
// =================================================

const updateStaffStatus = async (req, res) => {
  try {
    const staff = await findStaff(req.params.id, true);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    staff.isActive = isActive;

    await staff.save();

    return res.status(200).json({
      success: true,

      message: isActive
        ? "Staff account activated successfully."
        : "Staff account disabled successfully.",

      data: {
        _id: staff._id,
        staffId: staff.staffId,
        name: staff.name,
        email: staff.email,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    console.error("UPDATE STAFF STATUS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to update staff status.",
    });
  }
};

module.exports = {
  createStaff,
  getAllStaff,
  getOneStaff,
  getStaffClients,
  updateStaff,
  updateStaffStatus,
};
