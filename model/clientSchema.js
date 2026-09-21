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

    // Human-readable stage snapshot
    clientStatus: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Staff.staffId e.g. W-122261
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
//
// IMPORTANT:
// If Client is being created inside a MongoDB transaction,
// Counter uses the same session.
// =================================================

clientSchema.pre("save", async function () {
  if (!this.isNew || this.clientId) {
    return;
  }

  const session = this.$session();

  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };

  if (session) {
    options.session = session;
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
    options,
  );

  const startValue = 176587345;

  this.clientId = `J-${startValue + counter.sequence_value}`;
});

module.exports = mongoose.model("Client", clientSchema);
