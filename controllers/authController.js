const jwt = require("jsonwebtoken");

const Staff = require("../model/staffSchema");
const Admin = require("../model/adminModel");

// =================================================
// GENERATE TOKEN
// =================================================

const generateToken = (userId, role) => {
  return jwt.sign(
    {
      id: userId,
      role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    },
  );
};

// =================================================
// LOGIN
// SUPER ADMIN + STAFF
// =================================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // =================================================
    // VALIDATION
    // =================================================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    let user = null;
    let role = null;

    // =================================================
    // CHECK SUPER ADMIN
    // =================================================

    const admin = await Admin.findOne({
      email: normalizedEmail,
    });

    if (admin) {
      user = admin;
      role = "superadmin";
    }

    // =================================================
    // CHECK STAFF
    // =================================================

    if (!user) {
      const staff = await Staff.findOne({
        email: normalizedEmail,
      });

      if (staff) {
        user = staff;
        role = "staff";
      }
    }

    // =================================================
    // USER NOT FOUND
    // =================================================

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // =================================================
    // ACCOUNT DISABLED
    // =================================================

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled",
      });
    }

    // =================================================
    // PASSWORD CHECK
    // =================================================

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // =================================================
    // GENERATE TOKEN
    // =================================================

    const token = generateToken(user._id.toString(), role);

    // =================================================
    // BUILD USER RESPONSE
    // =================================================

    const responseUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role,
      isActive: user.isActive,
    };

    // Staff-only fields
    if (role === "staff") {
      responseUser.staffId = user.staffId;
      responseUser.phone = user.phone;
      responseUser.location = user.location;
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: responseUser,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =================================================
// CURRENT LOGGED-IN USER
// =================================================

exports.getCurrentUser = async (req, res) => {
  try {
    let permissions;

    // =================================================
    // SUPER ADMIN PERMISSIONS
    // =================================================

    if (req.user.role === "superadmin") {
      permissions = {
        // Staff
        manageStaff: true,
        createStaff: true,
        editStaff: true,
        terminateStaff: true,

        // Clients
        viewAllClients: true,
        createClient: true,
        editAnyClient: true,
        assignClients: true,
        reassignClients: true,

        // Client stages
        updateAnyClientStage: true,

        // Payments
        viewAllPayments: true,
        createPayment: true,
        editPayment: true,
        cancelPayment: true,
        refundPayment: true,

        // Targets / Performance
        manageTargets: true,
        viewAllPerformance: true,

        // Reports
        viewReports: true,
      };
    }

    // =================================================
    // STAFF PERMISSIONS
    // =================================================
    else if (req.user.role === "staff") {
      permissions = {
        // Staff
        manageStaff: false,
        createStaff: false,
        editStaff: false,
        terminateStaff: false,

        // Clients
        viewAllClients: false,
        createClient: false,
        editOwnClients: true,
        assignClients: false,
        reassignClients: false,

        // Client stages
        updateOwnClientStage: true,

        // Payments
        viewAllPayments: false,
        createPayment: true,
        editPayment: false,
        cancelPayment: false,
        refundPayment: false,

        // Targets / Performance
        manageTargets: false,
        viewOwnPerformance: true,

        // Reports
        viewReports: false,
      };
    } else {
      return res.status(403).json({
        success: false,
        message: "Invalid user role",
      });
    }

    return res.status(200).json({
      success: true,
      user: req.user,
      permissions,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
