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
  enum: ["Male", "Female", "Other", "Prefer not to say"],
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
  enum: [
    "Citizen",
    "Permanent Resident",
    "Temporary Resident",
    "Student Visa",
    "Work Visa",
    "Dependent Visa",
    "Refugee",
    "Other",
  ],
  default: "",
},
lastQualification: {
  type: String,
  enum: [
    "SLC / SEE",
    "+2 / Intermediate",
    "Bachelor's Degree",
    "Master's Degree",
    "PhD",
    "Diploma",
    "Certificate Course",
    "Other",
  ],
  default: "",
},

   japaneseLanguageLevel: {
  type: String,
  enum: [
    "None",
    "N5",
    "N4",
    "N3",
    "N2",
    "N1",
    "JLPT Not Taken",
    "NAT-Test",
    "J-Test",
  ],
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
  enum: [
    "Father",
    "Mother",
    "Brother",
    "Sister",
    "Spouse",
    "Uncle",
    "Aunt",
    "Grandparent",
    "Self",
    "Guardian",
    "Other",
  ],
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