const mongoose = require("mongoose");
const Counter = require("./CounterModel");

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      trim: true,
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
      enum: [
        "Not Applied",
        "Applied",
        "Processing",
        "Received",
        "Rejected",
      ],
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

    // Stores staffId such as W-122261
    assignedStaff: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

clientSchema.pre("validate", async function () {
  if (!this.isNew || this.clientId) {
    return;
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: "ClientId" },
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

  const baseNumber = 176587344;

  this.clientId = `J-${baseNumber + counter.sequence_value}`;
});

module.exports = mongoose.model("Client", clientSchema);