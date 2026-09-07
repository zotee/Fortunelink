const mongoose = require("mongoose");
const Counter = require("./CounterModel");

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      unique: true,
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
      ],
      default: "New",
    },

    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
  },
  { timestamps: true }
);

//
// ✅ AUTO GENERATE CLIENT ID
//
clientSchema.pre("save", async function () {
  if (!this.isNew) return;

  const counter = await Counter.findOneAndUpdate(
    { _id: "ClientId" },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );

  const startValue = 176587345;
  this.clientId = `J-${startValue + counter.sequence_value}`;
});

module.exports = mongoose.model("Client", clientSchema);