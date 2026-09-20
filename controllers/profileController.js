const mongoose = require("mongoose");
const Client = require("../model/clientSchema");
const { Profile } = require("../model/profileSchema");
const Remark = require("../model/remarkSchema");

// =================================================
// ALLOWED PROFILE FIELDS
// =================================================
const PROFILE_FIELDS = [
  "dateOfBirth",
  "gender",
  "email",
  "prefecture",
  "address",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
  "statusOfResidence",
  "education",
  "japaneseLanguageLevel",
  "intake",
  "employmentHistory",
  "remark",
];

// =================================================
// CLIENT POPULATE FIELDS
// =================================================
const CLIENT_POPULATE_FIELDS = [
  "clientId",
  "fullName",
  "phone",
  "currentVisaStatus",
  "preferCategory",
  "currentStage",
  "clientStatus",
  "assignedStaff",
].join(" ");

// =================================================
// SELECT ALLOWED PROFILE FIELDS
// =================================================
const selectProfileFields = (body) => {
  return PROFILE_FIELDS.reduce((result, field) => {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }

    return result;
  }, {});
};

// =================================================
// PARSE JSON FORM-DATA FIELD
// =================================================
const parseJsonField = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must contain valid JSON.`);
  }
};

// =================================================
// PREPARE PROFILE DATA
//
// Supports:
//
// 1. application/json
// 2. multipart/form-data
// =================================================
const prepareProfileData = (body) => {
  const data = selectProfileFields(body);

  if (data.education !== undefined) {
    data.education = parseJsonField(data.education, "education");
  }

  if (data.employmentHistory !== undefined) {
    data.employmentHistory = parseJsonField(
      data.employmentHistory,
      "employmentHistory",
    );
  }

  return data;
};

// =================================================
// GET UPLOADED FILES
// =================================================
const getUploadedFiles = (req) => {
  const files = {};

  if (req.files?.clientImage?.[0]?.path) {
    files.clientImage = req.files.clientImage[0].path;
  }

  if (req.files?.cv?.[0]?.path) {
    files.cv = req.files.cv[0].path;
  }

  return files;
};

// =================================================
// POPULATE CLIENT AND STAFF
// =================================================
const populateProfileClient = (query) => {
  return query.populate({
    path: "clientRef",
    select: CLIENT_POPULATE_FIELDS,
    populate: {
      path: "staff",
      model: "Staff",
      select: "staffId name email phone location isActive role",
    },
  });
};

// =================================================
// CREATE PROFILE
//
// POST /api/profile
// =================================================
exports.createProfile = async (req, res) => {
  try {
    const clientId = String(req.body.clientId || "").trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required.",
      });
    }

    const client = await Client.findOne({
      clientId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    const existingProfile = await Profile.findOne({
      clientId: client.clientId,
    }).lean();

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this client.",
      });
    }

    const profileData = prepareProfileData(req.body);

    const createdProfile = await Profile.create({
      clientId: client.clientId,
      clientRef: client._id,
      ...profileData,
      ...getUploadedFiles(req),
    });

    const profile = await populateProfileClient(
      Profile.findById(createdProfile._id),
    ).lean();

    return res.status(201).json({
      success: true,
      message: "Profile created successfully.",
      data: profile,
    });
  } catch (error) {
    console.error("CREATE PROFILE ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this client.",
        duplicateFields: error.keyValue || {},
      });
    }

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message === "education must contain valid JSON." ||
      error.message ===
        "employmentHistory must contain valid JSON."
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create profile.",
    });
  }
};

// =================================================
// GET ALL PROFILES
//
// GET /api/profile
// =================================================
exports.getAllProfiles = async (req, res) => {
  try {
    const profiles = await populateProfileClient(
      Profile.find().sort({
        createdAt: -1,
      }),
    ).lean();

    return res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles,
    });
  } catch (error) {
    console.error("GET ALL PROFILES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get profiles.",
    });
  }
};

// =================================================
// GET PROFILE DETAILS
//
// GET /api/profile/profiles/:clientId
// =================================================
exports.getProfileDetails = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required.",
      });
    }

    const profile = await populateProfileClient(
      Profile.findOne({
        clientId,
      }),
    ).lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

  const clientMongoId = profile.clientRef?._id;

let remarks = [];

if (
  clientMongoId &&
  mongoose.Types.ObjectId.isValid(clientMongoId)
) {
  remarks = await Remark.find({
    clientId: clientMongoId,
  })
    .sort({
      createdAt: -1,
    })
    .lean();
}



    return res.status(200).json({
      success: true,
      data: {
        ...profile,
        remarks,
      },
    });
  } catch (error) {
    console.error("GET PROFILE DETAILS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get profile.",
    });
  }
};

// =================================================
// UPDATE PROFILE
//
// PATCH /api/profile/profiles/:clientId
// =================================================
exports.updateProfile = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required.",
      });
    }

    const updates = {
      ...prepareProfileData(req.body),
      ...getUploadedFiles(req),
    };

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No profile fields were provided for update.",
      });
    }

    const profile = await populateProfileClient(
      Profile.findOneAndUpdate(
        {
          clientId,
        },
        {
          $set: updates,
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      ),
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: profile,
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message === "education must contain valid JSON." ||
      error.message ===
        "employmentHistory must contain valid JSON."
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile.",
    });
  }
};

// =================================================
// DELETE PROFILE
//
// DELETE /api/profile/profiles/:clientId
// =================================================
exports.deleteProfile = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required.",
      });
    }

    const profile = await Profile.findOneAndDelete({
      clientId,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete profile.",
    });
  }
};