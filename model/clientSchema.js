const mongoose = require("mongoose");
const Counter = require("./CounterModel");

// =================================================
// DROPDOWN STAGES (for frontend only)
// =================================================
const CLIENT_STAGES = [
  "Registered/Paid",
  "Vacancy Searching",
  "Interview Fixed / Preparation",
  "Interview Failed",
  "Naitei / Job Offer Received",
  "Job Offer Accepted",
  "Job Offer Rejected",
  "Visa Documents Submitted",
  "Visa Applied / Result Waiting",
  "Visa Approved",
  "Visa Rejected",
  "Waiting for Nyusha / Company Joining",
  "Employment Started/Company Joined",
  "Visa Renewal - 1 Year",
  "Visa Renewal - 3 Years",
  "Visa Renewal - 5 Years",
  "Return to Nepal",
];

// =================================================
// STAGE → STATUS MAPPING
// =================================================
function mapStageToStatus(stage) {
  const map = {
    "Registered/Paid": "Registered/Paid",
    "Vacancy Searching": "Vacancy Searching",
    "Interview Fixed / Preparation": "Interview Fixed / Preparation",
    "Interview Failed": "Interview Failed",
    "Naitei / Job Offer Received": "Naitei / Job Offer Received",
    "Job Offer Accepted": "Job Offer Accepted",
    "Job Offer Rejected": "Job Offer Rejected",
    "Visa Documents Submitted": "Visa Documents Submitted",
    "Visa Applied / Result Waiting": "Visa Applied / Result Waiting",
    "Visa Approved": "Visa Approved",
    "Visa Rejected": "Visa Rejected",
    "Waiting for Nyusha / Company Joining": "Waiting for Nyusha / Company Joining",
    "Employment Started/Company Joined": "Employment Started/Company Joined",
    "Visa Renewal - 1 Year": "Visa Renewal - 1 Year",
    "Visa Renewal - 3 Years": "Visa Renewal - 3 Years",
    "Visa Renewal - 5 Years": "Visa Renewal - 5 Years",
    "Return to Nepal": "Return to Nepal",
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
        "designatedActivitiesJob Hunting",
        "designatedActivities - Other",
        "engineerHumanitiesInternationalServices",
        "specifiedSkilled Worker 1",
        "specified Skilled Worker 2",
        "skilled Labor",
        "technical Intern Training",
        "intra-company Transferee",
        "nursing Care",
        "highly Skilled Professional",
        "business Manager",
        "permanent Resident",
        "spouseChild of Japanese National",
        "spouseChild of Permanent Resident",
        "longTerm Resident",
        "other",
      ],
    },

   preferCategory: {
  type: String,
  enum: [
    "Shushoku / New Job",
    "Tenshoku / Job Change",
    "Dependent Visa Renewal",
    "Visa Service Only / Renewal",
    "Visa Service Only / Change",
    "Other Visa Service",
  ],
  default: "Other Visa Service",
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