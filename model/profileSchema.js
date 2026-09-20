const mongoose = require("mongoose");
// =================================================
// EDUCATION SUBDOCUMENT
// =================================================
const educationSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      trim: true,
      default: "",
    },
    educationType: {
      type: String,
      trim: true,
      default: "",
    },
    enrollmentDate: {
      type: Date,
      default: null,
    },
    graduationDate: {
      type: Date,
      default: null,
    },
    major: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: true,
  },
);
// =================================================
// EMPLOYMENT HISTORY SUBDOCUMENT
// =================================================
const employmentHistorySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    employmentType: {
      type: String,
      trim: true,
      default: "",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  },
);
// =================================================
// PROFILE SCHEMA
// =================================================
const profileSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    clientRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      unique: true,
      index: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    prefecture: {
      type: String,
      trim: true,
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
      default: "",
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
    education: {
      type: [educationSchema],
      default: [],
    },
    japaneseLanguageLevel: {
      type: String,
      trim: true,
      default: "",
    },
    intake: {
      type: String,
      trim: true,
      default: "",
    },
    employmentHistory: {
      type: [employmentHistorySchema],
      default: [],
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
// =================================================
// INDEXES
// =================================================
profileSchema.index({
  nationality: 1,
});
profileSchema.index({
  japaneseLanguageLevel: 1,
});
// =================================================
// EXPORT
// Support both:
// const Profile=require(...)
// const {Profile}=require(...)
// =================================================
const Profile = mongoose.model("Profile", profileSchema);
module.exports = Profile;
module.exports.Profile = Profile;
module.exports.profileSchema = profileSchema;
