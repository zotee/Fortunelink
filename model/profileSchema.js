const mongoose = require("mongoose");

// =================================================
// LABELS (Frontend only)
// =================================================
const EDUCATION_LABELS = {
  schoolName: "School / College Name",
  educationType: "BAchelor",
  enrollmentDate: "Enrollment Date",
  graduationDate: "Graduation Date",
  major: "Major / Field of Study",
};

const EMPLOYMENT_LABELS = {
  companyName: "会社名 (Company Name)",
  startDate: "入社年月 (Start Date)",
  endDate: "退社年月 (End Date)",
  employmentType: "雇用形態 (Employment Type)",
};

// =================================================
// SCHEMA
// =================================================
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

    prefecture: {
      type: String,
      enum: [
        "hokkaido",
        "aomori",
        "iwate",
        "miyagi",
        "akita",
        "yamagata",
        "fukushima",

        "ibaraki",
        "tochigi",
        "gunma",
        "saitama",
        "chiba",
        "tokyo",
        "kanagawa",

        "niigata",
        "toyama",
        "ishikawa",
        "fukui",
        "yamanashi",
        "nagano",
        "gifu",
        "shizuoka",
        "aichi",

        "mie",
        "shiga",
        "kyoto",
        "osaka",
        "hyogo",
        "nara",
        "wakayama",

        "tottori",
        "shimane",
        "okayama",
        "hiroshima",
        "yamaguchi",

        "tokushima",
        "kagawa",
        "ehime",
        "kochi",

        "fukuoka",
        "saga",
        "nagasaki",
        "kumamoto",
        "oita",
        "miyazaki",
        "kagoshima",

        "okinawa",
      ],
      default: null,
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },

    nationality: {
      type: String,
      enum: [
        "nepali",
        "indian",
        "bangladeshi",
        "pakistani",
        "sri Lankan",
        "vietnamese",
        "myanmar",
        "indonesian",
        "filipino",
        "chinese",
        "other",
      ],
      default: "other",
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
    "student",
    "dependent",
    "engineerSpecialistInHumanitiesInternationalServices",
    "specifiedSkilledWorkerNo1",
    "specifiedSkilledWorkerNo2",
    "technicalInternTraining",
    "designatedActivities",
    "highlySkilledProfessional",
    "skilledLabor",
    "intra-companyTransferee",
    "nursingCare",
    "businessManager",
    "instructor",
    "researcher",
    "professor",
    "medicalServices",
    "permanentResident",
    "long-TermResident",
    "spouseOrChildOfJapaneseNational",
    "spouseOrChildOfPermanentResident",
    "culturalActivities",
    "trainee",
    "other",
  ],
  set: (value) => {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmedValue = String(value).trim();

    return trimmedValue === "" ? null : trimmedValue;
  },
  default: null,
},
    education: [
  {
    schoolName: {
      type: String,
      trim: true,
      default: "",
    },

    educationType: {
      type: String,
      enum: [
        "Japanese Language School",
        "Vocational School",
        "University",
        "Junior College",
        "High School",
        "Technical College",
        "International School",
        "Other",
      ],
      set: (value) => {
        if (value === undefined || value === null) {
          return null;
        }

        const trimmedValue = String(value).trim();

        return trimmedValue === "" ? null : trimmedValue;
      },
      default: null,
    },

    enrollmentDate: {
      type: Date,
      default: null,
    },

    graduationDate: {
      type: Date,
      default: null,
    },

    degree: {
      type: String,
      trim: true,
      default: "",
    },

    major: {
      type: String,
      trim: true,
      default: "",
    },
  },
],

    japaneseLanguageLevel: {
      type: String,
      enum: ["n5", "n4", "n3", "n2", "n1"],
      default: "",
    },
  

    intake: {
      type: String,
      trim: true,
      default: "",
    },

    employmentHistory: [
      {
        companyName: { type: String, trim: true, default: "" },
        
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        employmentType: {
          type: String,
          enum: [
            "full-time",
            "part-time",
            "contract",
            "temporaryDispatchEmployee",
            "other",
          ],
          default: "other",
        },
      },
    ],

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
  }
);

// =================================================
// VALIDATION: ensure client exists
// =================================================
profileSchema.pre("save", async function () {
  const Client = mongoose.model("Client");

  const client = await Client.findById(this.clientRef)
    .select("clientId")
    .lean();

  if (!client || client.clientId !== this.clientId) {
    throw new Error("clientId and clientRef mismatch");
  }
});

// =================================================
// EXPORT
// =================================================
const Profile = mongoose.model("Profile", profileSchema);

module.exports = {
  Profile,
  EDUCATION_LABELS,
  EMPLOYMENT_LABELS,
};