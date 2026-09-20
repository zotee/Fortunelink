const mongoose = require("mongoose");
const Counter = require("./CounterModel");

// =================================================
// DROPDOWN STAGES (for frontend only)
// =================================================
const CLIENT_STAGES = [
  "registeredPaid",
  "vacancySearching",
  "interviewFixedPreparation",
  "interviewFailed",
  "jobOfferReceived",
  "jobOfferAccepted",
  "jobOfferRejected",
  "visaDocumentsSubmitted",
  "visaAppliedResultWaiting",
  "visaApproved",
  "visaRejected",
  "companyJoining",
  "employmentStartedCompanyJoined",
  "visaRenewal1Year",
  "visaRenewal3Years",
  "visaRenewal5Years",
  "returntoNepal",
];

// =================================================
// STAGE → STATUS MAPPING
// =================================================
function mapStageToStatus(stage) {
  const map = {
    "registeredPaid": "Registered/Paid",
    "vacancySearching": "Vacancy Searching",
    "interviewFixedPreparation": "Interview Fixed / Preparation",
    "interviewFailed": "Interview Failed",
    "jobOfferReceived": "Naitei / Job Offer Received",
    "jobOfferAccepted": "Job Offer Accepted",
    "jobOfferRejected": "Job Offer Rejected",
    "visaDocumentsSubmitted": "Visa Documents Submitted",
    "visaAppliedResultWaiting": "Visa Applied / Result Waiting",
    "visaApproved": "Visa Approved",
    "visaRejected": "Visa Rejected",
    "companyJoining": "Waiting for Nyusha / Company Joining",
    "employmentStartedCompanyJoined": "Employment Started/Company Joined",
    "visaRenewal1Year": "Visa Renewal - 1 Year",
    "visaRenewal3Years": "Visa Renewal - 3 Years",
    "visaRenewal5Years": "Visa Renewal - 5 Years",
    "returntoNepal": "Return to Nepal",
  };

  return map[stage] || stage || "Processing";
}

// =================================================
// CLIENT SCHEMA
// =================================================
const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      unique: true,
      index: true,
      trim: true,
      immutable: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

   
    currentVisaStatus: {
      type: String,
      required: true,
      enum: [
        "student",
        "dependent",
        "designatedActivitiesJobHunting",
        "designatedActivities",
        "engineerHumanitiesInternationalServices",
        "specifiedSkilledWorker1",
        "specifiedSkilledWorker2",
        "skilledLabor",
        "technicalInternTraining",
        "intra-companyTransferee",
        "nursingCare",
        "highlySkilledProfessional",
        "businessManager",
        "permanentResident",
        "spouseChildOfJapaneseNational",
        "spouseChildOfPermanentResident",
        "longTermResident",
        "other",
      ],
    },

   preferCategory: {
  type: String,
  enum: [
    "newJob",
    "jobChange",
    "dependentVisaRenewal",
    "visaServiceOnlyRenewal",
    "visaServiceOnlyChange",
    "otherVisaService",
  ],
  default: "otherVisaService",
},

    // =================================================
    // CURRENT STAGE (FREE TEXT + DROPDOWN SUPPORT)
    // =================================================
    currentStage: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // =================================================
    // AUTO STATUS (MIRROR OF STAGE)
    // =================================================
    clientStatus: {
      type: String,
      default: "Registered/Paid",
      index: true,
    },

    assignedStaff: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// =================================================
// VIRTUAL STAFF
// =================================================
clientSchema.virtual("staff", {
  ref: "Staff",
  localField: "assignedStaff",
  foreignField: "staffId",
  justOne: true,
});

// =================================================
// INDEX
// =================================================
clientSchema.index({
  assignedStaff: 1,
  createdAt: -1,
});

// =================================================
// AUTO CLIENT ID
// =================================================
clientSchema.pre("save", async function () {
  if (!this.isNew || this.clientId) return;

  const counter = await Counter.findOneAndUpdate(
    { _id: "ClientId" },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const startValue = 176587345;
  this.clientId = `J-${startValue + counter.sequence_value}`;
});

// =================================================
// SYNC: SAVE HOOK
// =================================================
clientSchema.pre("save", function (next) {
  if (this.isModified("currentStage")) {
    this.clientStatus = mapStageToStatus(this.currentStage);
  }
  next();
});

// =================================================
// SYNC: UPDATE HOOK
// =================================================
clientSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  if (update.currentStage) {
    update.clientStatus = mapStageToStatus(update.currentStage);
  }

  next();
});

// =================================================
// EXPORT
// =================================================
module.exports = mongoose.model("Client", clientSchema);
module.exports.CLIENT_STAGES = CLIENT_STAGES;