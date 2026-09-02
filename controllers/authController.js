const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const admin = require("../model/adminModel");

exports.login = (req, res) => {
  const { email, password } = req.body;

  if (email !== admin.email) {
    return res.status(404).json({ message: "Admin not found" });
  }

  const isMatch = bcrypt.compareSync(password, admin.password);

  if (!isMatch) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = jwt.sign(
    { email: admin.email, role: "superadmin" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    message: "Login successful",
    token,
  });
};

exports.dashboard = (req, res) => {
  res.json({
    message: "Welcome Super Admin!",
    user: req.user,
  });
};