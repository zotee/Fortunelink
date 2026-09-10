const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      immutable: true,
    },

    clientRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
   

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: null,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    nationality: {
      type: String,
      trim: true,
      default: "Nepali",
    },

    passportNumber: {
      type: String,
      trim: true,
      default: "",
    },

    passportExpiryDate: {
      type: Date,
      default: null,
    },

    statusOfResidence: {
      type: String,
      trim: true,
      default: "",
    },

    lastQualification: {
      type: String,
      trim: true,
      default: "",
    },

    japaneseLanguageLevel: {
      type: String,
      trim: true,
      default: "",
    },

    schoolName: {
      type: String,
      trim: true,
      default: "",
    },

    course: {
      type: String,
      trim: true,
      default: "",
    },

    intake: {
      type: String,
      trim: true,
      default: "",
    },

    jobCategory: {
      type: String,
      trim: true,
      default: "",
    },

    jobTitle: {
      type: String,
      trim: true,
      default: "",
    },

    companyName: {
      type: String,
      trim: true,
      default: "",
    },

    workLocation: {
      type: String,
      trim: true,
      default: "",
    },

    sponsorName: {
      type: String,
      trim: true,
      default: "",
    },

    sponsorRelationship: {
      type: String,
      trim: true,
      default: "",
    },

    sponsorStatusOfResidence: {
      type: String,
      trim: true,
      default: "",
    },

    visaStatus: {
      type: String,
      enum: [
        "Not Applied",
        "Applied",
        "Processing",
        "Approved",
        "Rejected",
      ],
      default: "Not Applied",
    },

    remark: {
      type: String,
      trim: true,
      default: "",
    },

    clientImage: {
      type: String,
      default: "",
    },

    cv: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Profile", profileSchema);