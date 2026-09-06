const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    clientId: { type: Number, required: true, unique: true },

    fullName: { type: String, required: true, trim: true },

    dateOfBirth: { type: Date },

    gender: { type: String, enum: ["Male", "Female", "Other"] },

    phone: { type: String, required: true, trim: true },

    email: { type: String, trim: true },

    address: { type: String, trim: true },

    nationality: { type: String, default: "Nepali" },

    passportNumber: { type: String, trim: true },

    passportExpiryDate: { type: Date },

    visaType: {
      type: String,
      required: true,
      enum: ["Student", "Working", "Dependent"],
    },

    statusOfResidence: { type: String, trim: true },

    lastQualification: { type: String },

    japaneseLanguageLevel: { type: String },

    schoolName: { type: String },

    course: { type: String },

    intake: { type: String },

    jobCategory: { type: String },

    jobTitle: { type: String },

    companyName: { type: String },

    workLocation: { type: String },

    sponsorName: { type: String },

    sponsorRelationship: { type: String },

    sponsorStatusOfResidence: { type: String },

    coeStatus: {
      type: String,
      enum: ["Not Applied", "Applied", "Processing", "Received", "Rejected"],
      default: "Not Applied",
    },

    visaStatus: {
      type: String,
      enum: ["Not Applied", "Applied", "Processing", "Approved", "Rejected"],
      default: "Not Applied",
    },

    clientStatus: {
      type: String,
      enum: [
        "New",
        "Document Collection",
        "Processing",
        "COE Applied",
        "COE Received",
        "Visa Applied",
        "Visa Approved",
        "Visa Rejected",
        "Departed",
        "Arrived in Japan",
      ],
      default: "New",
    },

    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },


    // 📁 FILES
    clientImage: { type: String },
    cv: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);