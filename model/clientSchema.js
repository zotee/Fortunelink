const mongoose = require("mongoose");
const Counter = require("./CounterModel");
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
    // Stage key from ClientStage.key
    currentStage: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Human readable snapshot.
    // Always derived from ClientStage.name.
    clientStatus: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Stores Staff.staffId e.g. W-122261
    assignedStaff: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  },
);
// =================================================
// STAFF VIRTUAL
// =================================================
clientSchema.virtual("staff", {
  ref: "Staff",
  localField: "assignedStaff",
  foreignField: "staffId",
  justOne: true,
});
// =================================================
// INDEXES
// =================================================
clientSchema.index({
  assignedStaff: 1,
  createdAt: -1,
});
clientSchema.index({
  currentStage: 1,
  createdAt: -1,
});
// =================================================
// AUTO CLIENT ID
// =================================================
clientSchema.pre("save", async function () {
  if (!this.isNew || this.clientId) {
    return;
  }
  const counter = await Counter.findOneAndUpdate(
    {
      _id: "ClientId",
    },
    {
      $inc: {
        sequence_value: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
  const startValue = 176587345;
  this.clientId = `J-${startValue + counter.sequence_value}`;
});
module.exports = mongoose.model("Client", clientSchema);
