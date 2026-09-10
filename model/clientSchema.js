const mongoose = require("mongoose");
const Counter = require("./CounterModel");

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: Number,        // ✅ UNCOMMENTED — was commented out
      unique: true,
      index: true,
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

clientSchema.virtual("staff", {
  ref: "Staff",
  localField: "assignedStaff",
  foreignField: "staffId",
  justOne: true,
});

// ✅ Display ID virtual — for UI: "J-176587346"
clientSchema.virtual("displayId").get(function () {
  return this.clientId ? `J-${this.clientId}` : null;
});

clientSchema.index({ assignedStaff: 1, createdAt: -1 });

clientSchema.pre("save", async function () {
  if (!this.isNew || this.clientId) return;

  const counter = await Counter.findOneAndUpdate(
    { _id: "ClientId" },
    { $inc: { sequence_value: 1 } },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  const startValue = 176587345;
  this.clientId = startValue + counter.sequence_value;   // ✅ Number, no backticks
});

module.exports = mongoose.model("Client", clientSchema);