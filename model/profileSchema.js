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

    graduationStatus: {
      type: String,
      enum: [
        "",
        "graduated",
        "expectedGraduation",
        "currentlyEnrolled",
        "withdrawn",
      ],
      default: "",
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

    department: {
      type: String,
      trim: true,
      default: "",
    },

    jobTitle: {
      type: String,
      trim: true,
      default: "",
    },

    workLocation: {
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

    isCurrent: {
      type: Boolean,
      default: false,
    },

    responsibilities: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    achievements: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
  },
  {
    _id: true,
  },
);

// =================================================
// QUALIFICATION / CERTIFICATE SUBDOCUMENT
// =================================================

const qualificationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    levelOrScore: {
      type: String,
      trim: true,
      default: "",
    },

    acquiredDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    issuer: {
      type: String,
      trim: true,
      default: "",
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
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
    // =================================================
    // RELATION
    // =================================================

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

    // =================================================
    // PERSONAL INFORMATION
    // =================================================

    furigana: {
      type: String,
      trim: true,
      default: "",
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

    nationality: {
      type: String,
      trim: true,
      default: "",
    },

    // =================================================
    // ADDRESS
    // =================================================

    postalCode: {
      type: String,
      trim: true,
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

    // =================================================
    // PASSPORT / RESIDENCE
    // =================================================

    passportNumber: {
      type: String,
      trim: true,
      default: "",
    },

    passportExpiryDate: {
      type: Date,
      default: null,
    },

    residenceExpiryDate: {
      type: Date,
      default: null,
    },

    // Legacy field.
    // Client.currentVisaStatus is now the primary
    // current residence / visa status.
    statusOfResidence: {
      type: String,
      trim: true,
      default: "",
    },

    // =================================================
    // EDUCATION
    // =================================================

    education: {
      type: [educationSchema],
      default: [],
    },

    // =================================================
    // LANGUAGE
    // =================================================

    japaneseLanguageLevel: {
      type: String,
      trim: true,
      default: "",
    },

    // =================================================
    // QUALIFICATIONS
    // =================================================

    qualifications: {
      type: [qualificationSchema],
      default: [],
    },

    // =================================================
    // SKILLS
    // =================================================

    skills: {
      type: [String],
      default: [],
    },

    // =================================================
    // EMPLOYMENT HISTORY
    // =================================================

    employmentHistory: {
      type: [employmentHistorySchema],
      default: [],
    },

    careerSummary: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    // =================================================
    // JAPANESE APPLICATION CONTENT
    // =================================================

    motivation: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    selfPR: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    desiredConditions: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // =================================================
    // INTERNAL RECRUITMENT INFORMATION
    // =================================================

    intake: {
      type: String,
      trim: true,
      default: "",
    },

    // =================================================
    // DOCUMENTS
    // =================================================

    clientImage: {
      type: String,
      default: "",
    },

    // Original CV uploaded by applicant.
    // Generated Japanese CV is generated dynamically.
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
// =================================================

const Profile = mongoose.model("Profile", profileSchema);

module.exports = Profile;

module.exports.Profile = Profile;

module.exports.profileSchema = profileSchema;
