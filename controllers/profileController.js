const mongoose = require("mongoose");

const Client = require("../model/clientSchema");
const Profile = require("../model/profileSchema");
const Remark = require("../model/remarkSchema");

const PROFILE_FIELDS = [
  "dateOfBirth",
  "gender",
  "email",
  "address",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
  "statusOfResidence",
  "lastQualification",
  "japaneseLanguageLevel",
  "schoolName",
  "course",
  "intake",
  "jobCategory",
  "jobTitle",
  "companyName",
  "workLocation",
  "sponsorName",
  "sponsorRelationship",
  "sponsorStatusOfResidence",
  "visaStatus",
  "remark",
  "clientImage",
  "cv",
];

const selectProfileFields = (body) => {
  return PROFILE_FIELDS.reduce((result, field) => {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }

    return result;
  }, {});
};

const getUploadedFiles = (req) => {
  const files = {};

  if (req.files?.clientImage?.[0]) {
    files.clientImage = req.files.clientImage[0].path;
  }

  if (req.files?.cv?.[0]) {
    files.cv = req.files.cv[0].path;
  }

  return files;
};

// POST /api/profile
exports.createProfile = async (req, res) => {
  try {
    const clientId = String(req.body.clientId || "").trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required.",
      });
    }

    const client = await Client.findOne({ clientId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    const existingProfile = await Profile.findOne({
      clientId: client.clientId,
    });

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this client.",
      });
    }

    const profile = await Profile.create({
      ...selectProfileFields(req.body),
      ...getUploadedFiles(req),
      clientId: client.clientId,
      clientRef: client._id,
    });

    return res.status(201).json({
      success: true,
      message: "Profile created successfully.",
      data: profile,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A profile already exists for this client.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create profile.",
    });
  }
};

// GET /api/profile/profiles
exports.getAllProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find()
      .populate("clientRef", "clientId fullName phone visaType assignedStaff")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get profiles.",
    });
  }
};

// GET /api/profile/profiles/:clientId
exports.getProfileDetails = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

   const profile = await Profile.findOne({ clientId })
      .populate({
        path: "clientRef",
        select: "clientId fullName phone visaType clientStatus assignedStaff",
        populate: {
          path: "staff",              // 👈 virtual we defined
          model: "Staff",
          select: "staffId name email phone location isActive role",
        },
      })
      .lean({ virtuals: true }); 

    /*
      This supports either:
      1. remarks that store generated clientId strings
      2. old remarks that store a MongoDB ObjectId
    */
    const remarkConditions = [{ clientId }];

    if (mongoose.Types.ObjectId.isValid(profile.clientRef?._id)) {
      remarkConditions.push({
        clientId: profile.clientRef._id,
      });
    }

    const remarks = await Remark.find({
      $or: remarkConditions,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...profile,
        remarks,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get profile.",
    });
  }
};

// PATCH /api/profile/profiles/:clientId
exports.updateProfile = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const updates = {
      ...selectProfileFields(req.body),
      ...getUploadedFiles(req),
    };

    const profile = await Profile.findOneAndUpdate(
      { clientId },
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      },
    ).populate(
      "clientRef",
      "clientId fullName phone visaType assignedStaff",
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
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile.",
    });
  }
};

// DELETE /api/profile/profiles/:clientId
exports.deleteProfile = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

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
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete profile.",
    });
  }
};