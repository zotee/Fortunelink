const jwt = require("jsonwebtoken");

const Staff = require("../model/staffSchema");
const Admin = require("../model/adminModel");

// =================================================
// VERIFY JWT + CHECK USER STATUS
// =================================================

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // -------------------------------------------------
    // Check Authorization header
    // -------------------------------------------------
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token not provided",
      });
    }

    // -------------------------------------------------
    // Verify JWT
    // -------------------------------------------------
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;

    // =================================================
    // SUPER ADMIN
    // =================================================
    if (decoded.role === "superadmin") {
      user = await Admin.findById(decoded.id).select("-password");
    }

    // =================================================
    // STAFF
    // =================================================
    else if (decoded.role === "staff") {
      user = await Staff.findById(decoded.id).select("-password");
    }

    // =================================================
    // INVALID ROLE
    // =================================================
    else {
      return res.status(403).json({
        success: false,
        message: "Invalid user role",
      });
    }

    // -------------------------------------------------
    // User no longer exists
    // -------------------------------------------------
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    // -------------------------------------------------
    // User disabled
    // -------------------------------------------------
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been disabled",
      });
    }

    // -------------------------------------------------
    // Attach authenticated user
    // -------------------------------------------------
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: decoded.role,
      isActive: user.isActive,

      staffId: decoded.role === "staff" ? user.staffId : undefined,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// =================================================
// ROLE AUTHORIZATION
// =================================================

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource",
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  authorize,
};
