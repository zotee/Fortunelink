const dns = require("dns");

dns.setServers(["192.168.1.1"]);

require("dotenv").config();

const mongoose = require("mongoose");
const Admin = require("../model/adminModel");

const createAdmin = async () => {
  try {
    // =================================================
    // CHECK ENVIRONMENT VARIABLES
    // =================================================

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!process.env.ADMIN_EMAIL) {
      throw new Error("ADMIN_EMAIL is missing from .env");
    }

    if (!process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_PASSWORD is missing from .env");
    }

    // =================================================
    // CONNECT DATABASE
    // =================================================

    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB Atlas");

    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();

    // =================================================
    // CHECK EXISTING ADMIN
    // =================================================

    const existingAdmin = await Admin.findOne({
      email,
    });

    if (existingAdmin) {
      console.log("Super Admin already exists:");
      console.log(`Email: ${existingAdmin.email}`);
      console.log(`ID: ${existingAdmin._id}`);

      await mongoose.disconnect();
      process.exit(0);
    }

    // =================================================
    // CREATE ADMIN
    // Password will automatically be hashed
    // by adminModel.js pre-save middleware
    // =================================================

    const admin = await Admin.create({
      name: process.env.ADMIN_NAME?.trim() || "Super Admin",

      email,

      password: process.env.ADMIN_PASSWORD,

      role: "superadmin",

      isActive: true,
    });

    console.log("");
    console.log("Super Admin created successfully.");
    console.log(`ID: ${admin._id}`);
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log("");

    await mongoose.disconnect();

    process.exit(0);
  } catch (error) {
    console.error("Failed to create Super Admin:");
    console.error(error.message);

    await mongoose.disconnect();

    process.exit(1);
  }
};

createAdmin();
