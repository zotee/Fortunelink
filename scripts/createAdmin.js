require("dotenv").config();

const Admin = require("../model/adminModel");

const createAdmin = async () => {
  // =================================================
  // CHECK ENVIRONMENT VARIABLES
  // =================================================

  if (!process.env.ADMIN_EMAIL) {
    throw new Error("ADMIN_EMAIL is missing from .env");
  }

  if (!process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD is missing from .env");
  }

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();

  // =================================================
  // CHECK EXISTING ADMIN
  // =================================================

  const existingAdmin = await Admin.findOne({
    email,
  });

  if (existingAdmin) {
    console.log(`Super Admin already exists: ${existingAdmin.email}`);

    return existingAdmin;
  }

  // =================================================
  // CREATE ADMIN
  //
  // adminModel pre-save middleware hashes password
  // =================================================

  const admin = await Admin.create({
    name: process.env.ADMIN_NAME?.trim() || "Super Admin",

    email,

    password: process.env.ADMIN_PASSWORD,

    role: "superadmin",

    isActive: true,
  });

  console.log(`Super Admin created successfully: ${admin.email}`);

  return admin;
};

module.exports = createAdmin;
