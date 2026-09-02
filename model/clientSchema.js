const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: Number,
      required: true,
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
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Client", clientSchema);