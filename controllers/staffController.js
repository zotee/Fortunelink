const Staff = require("../model/staffSchema");
const Client = require("../model/clientSchema");
const CounterModel = require("../model/CounterModel");
const getLocalTime = require("../utils/getLocalTime");

// ========================================
// CREATE STAFF
// ========================================

const createStaff = async (req, res) => {
  try {
    const {
      name,
      phone,
      location,
      email,
      password,
    } = req.body;


    // Check required fields
    if (!name || !phone || !location || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }


    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }


    // Check duplicate email
    const existingStaff = await Staff.findOne({
      email: email.toLowerCase(),
    });


    if (existingStaff) {
      return res.status(409).json({
        success: false,
        message: "Staff with this email already exists",
      });
    }


    // Generate automatic staff ID
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
      }
    );


    // Create new staff
    const staff = new Staff({
      staffId: counter.sequence_value,
      name,
      phone,
      location,
      email: email.toLowerCase(),
      password,
    });


    // Password will automatically be hashed
    // by staffSchema.pre("save")
    await staff.save();


    // Convert mongoose document into object
    const staffData = staff.toObject();


    // Remove password from API response
    delete staffData.password;


    return res.status(201).json({
      success: true,
      message: "Staff created successfully",
      data: staffData,
    });

  } catch (err) {

    console.error("CREATE STAFF ERROR:", err);


    // Duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or Staff ID already exists",
      });
    }


    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



// ========================================
// GET ALL STAFF
// ========================================

const getAllStaff = async (req, res) => {
  try {

    // Don't return password
    const staffList = await Staff.find()
      .select("-password")
      .sort({ createdAt: -1 });


    const result = await Promise.all(

      staffList.map(async (staff) => {

        // Count clients belonging to this staff
        const totalClients = await Client.countDocuments({
          assignedStaff: staff._id,
        });


        return {
          ...staff.toObject(),
          totalClients,
        };
      })

    );


    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });

  } catch (err) {

    console.error("GET STAFF ERROR:", err);


    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



// ========================================
// GET ONE STAFF
// ========================================

const getOneStaff = async (req, res) => {
  try {

    const staff = await Staff.findById(req.params.id)
      .select("-password");


    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }


    // Count staff clients
    const totalClients = await Client.countDocuments({
      assignedStaff: staff._id,
    });


    return res.status(200).json({
      success: true,

      data: {
        ...staff.toObject(),
        totalClients,
      },
    });

  } catch (err) {

    console.error("GET ONE STAFF ERROR:", err);


    // Invalid MongoDB ID
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }


    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



// ========================================
// UPDATE STAFF
// ========================================

const updateStaff = async (req, res) => {
  try {

    const {
      name,
      phone,
      location,
      email,
      password,
    } = req.body;


    const staff = await Staff.findById(req.params.id);


    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }


    // Update only provided values

    if (name !== undefined) {
      staff.name = name;
    }

    if (phone !== undefined) {
      staff.phone = phone;
    }

    if (location !== undefined) {
      staff.location = location;
    }


    // Email update
    if (email !== undefined) {

      const existingEmail = await Staff.findOne({
        email: email.toLowerCase(),

        _id: {
          $ne: staff._id,
        },
      });


      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Another staff already uses this email",
        });
      }


      staff.email = email.toLowerCase();
    }


    // Password update
    if (password !== undefined && password !== "") {

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      staff.password = password;
    }


    // If password changed,
    // pre-save hook automatically hashes it
    await staff.save();


    const staffData = staff.toObject();

    delete staffData.password;


    return res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      data: staffData,
    });

  } catch (err) {

    console.error("UPDATE STAFF ERROR:", err);


    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



// ========================================
// DELETE STAFF
// ========================================

const deleteStaff = async (req, res) => {
  try {

    const staff = await Staff.findById(req.params.id);


    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }


    // Check if staff has assigned clients
    const clientCount = await Client.countDocuments({
      assignedStaff: staff._id,
    });


    if (clientCount > 0) {

      return res.status(400).json({
        success: false,

        message:
          "This staff has assigned clients. Reassign clients before deleting staff.",

        totalClients: clientCount,
      });
    }


    await Staff.findByIdAndDelete(req.params.id);


    return res.status(200).json({
      success: true,
      message: "Staff deleted successfully",
    });

  } catch (err) {

    console.error("DELETE STAFF ERROR:", err);


    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



// ========================================
// EXPORT
// ========================================

module.exports = {
  createStaff,
  getAllStaff,
  getOneStaff,
  updateStaff,
  deleteStaff,
};