const mongoose = require("mongoose");
const Counter = require("./CounterModel");

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String, // ✅ String — matches "J-176587346" format
      unique: true,
      index: true,
      trim: true,
      immutable: true, // set once, never changes
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

    visaType: {
      type: String,
      required: true,
      enum: ["Student", "Working", "Dependent"],
    },

    coeStatus: {
      type: String,
      enum: ["Not Applied", "Applied", "Processing", "Received", "Rejected"],
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
        "Registration Pending",
        "Vacancy Searching",
        "Interview Fixed",
        "Interview Failed",
        "Job Offer Received",
        "Visa Documents Submitted",
        "Visa Result Waiting",
        "Waiting for Joining",
        "Return to Nepal",
      ],
      default: "New",
    },

    stageHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Staff",
          default: null,
        },
        changedByName: { type: String, default: "System" },
      },
    ],

    assignmentHistory: [
      {
        staffId: { type: String, required: true },
        assignedAt: { type: Date, default: Date.now },
        unassignedAt: { type: Date, default: null },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Staff",
          default: null,
        },
        assignedByName: { type: String, default: "System" },
      },
    ],

    nextFollowUpDate: {
      type: Date,
      default: null,
      index: true,
    },

    nextFollowUpPurpose: {
      type: String,
      trim: true,
      default: "",
    },

    assignedStaff: {
      type: String,
      ref: "Staff",
      required: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ✅ Virtual populate: Client.assignedStaff ("W-122260") → Staff.staffId
clientSchema.virtual("staff", {
  ref: "Staff",
  localField: "assignedStaff", // "W-122260"
  foreignField: "staffId", // Staff.staffId
  justOne: true,
});

// ✅ Compound index for getStaffClients sort
clientSchema.index({ assignedStaff: 1, createdAt: -1 });

// ✅ Auto-generate clientId as String with "J-" prefix
clientSchema.pre("save", async function () {
  if (!this.isNew || this.clientId) return;

  const counter = await Counter.findOneAndUpdate(
    { _id: "ClientId" },
    { $inc: { sequence_value: 1 } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  const startValue = 176587345;
  this.clientId = `J-${startValue + counter.sequence_value}`; // "J-176587346"
});

module.exports = mongoose.model("Client", clientSchema);
