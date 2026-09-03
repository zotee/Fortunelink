const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Staff = require("../model/staffSchema");
const superAdmin = require("../model/adminModel");

// =================================================
// GENERATE TOKEN
// =================================================

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

// =================================================
// SUPER ADMIN LOGIN
// =================================================

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (email.toLowerCase() !== superAdmin.email.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      superAdmin.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken({
      email: superAdmin.email,
      role: "superadmin",
    });

    return res.status(200).json({
      success: true,
      message: "Super Admin login successful",

      user: {
        email: superAdmin.email,
        role: "superadmin",
      },

      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// =================================================
// STAFF LOGIN
// =================================================

exports.staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const staff = await Staff.findOne({
      email: email.toLowerCase(),
    });

    if (!staff) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Disabled/fired staff cannot login
    if (!staff.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      staff.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken({
      id: staff._id.toString(),
      email: staff.email,
      role: "staff",
    });

    return res.status(200).json({
      success: true,
      message: "Staff login successful",

      user: {
        id: staff._id,
        staffId: staff.staffId,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        location: staff.location,
        role: "staff",
        isActive: staff.isActive,
      },

      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// =================================================
// SUPER ADMIN DASHBOARD
// =================================================

exports.superAdminDashboard = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Welcome Super Admin",

      user: req.user,

      permissions: {
        manageStaff: true,
        createStaff: true,
        editStaff: true,
        deleteStaff: true,

        viewAllClients: true,
        createClient: true,
        editAnyClient: true,
        deleteClient: true,

        assignClients: true,
        reassignClients: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// =================================================
// STAFF DASHBOARD
// =================================================

exports.staffDashboard = async (req, res) => {
  try {
    const staff = await Staff.findById(req.user.id).select(
      "-password"
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    // Important:
    // If admin disables staff after they already logged in,
    // their old token should no longer allow dashboard access.
    if (!staff.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Welcome ${staff.name}`,

      user: {
        id: staff._id,
        staffId: staff.staffId,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        location: staff.location,
        role: "staff",
        isActive: staff.isActive,
      },

      permissions: {
        manageStaff: false,
        createStaff: false,
        editStaff: false,
        deleteStaff: false,

        viewAllClients: false,
        createClient: false,

        // Staff can edit only clients assigned to them
        editOwnClients: true,

        deleteClient: false,
        assignClients: false,
        reassignClients: false,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};