const mongoose = require("mongoose");
const Counter = require("./CounterModel");
const { CLIENT_STAGES } = require("../constants/clientStages");

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

    currentStage: {
      type: String,
      enum: CLIENT_STAGES,
      default: "Registration Pending",
      index: true,
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

    // Stores Staff.staffId, for example W-122290
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
// assignedStaff = W-122290
// Staff.staffId = W-122290
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
// AUTO GENERATE CLIENT ID
// Example: J-176587346
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
