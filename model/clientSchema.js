const mongoose = require("mongoose");
const Counter = require("./CounterModel");

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,        // ✅ String now (was Number)
      unique: true,
      index: true,
      trim: true,
      immutable: true,     // set once, never changes
    },

    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },

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
        "New", "Document Collection", "Processing",
        "COE Applied", "COE Received", "Visa Applied",
        "Visa Approved", "Visa Rejected", "Departed", "Arrived in Japan",
      ],
      default: "New",
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
  }
);

// ✅ Staff virtual: "W-122260" → Staff.staffId
clientSchema.virtual("staff", {
  ref: "Staff",
  localField: "assignedStaff",
  foreignField: "staffId",
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
    }
  );

  const startValue = 176587345;
  this.clientId = `J-${startValue + counter.sequence_value}`;  // ✅ "J-176587346"
});

module.exports = mongoose.model("Client", clientSchema);