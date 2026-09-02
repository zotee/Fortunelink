const bcrypt = require("bcryptjs");

const superAdmin = {
  email: "admin@example.com",
  password: bcrypt.hashSync("admin123", 8),
};

module.exports = superAdmin;