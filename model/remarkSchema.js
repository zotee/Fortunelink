const mongoose = require("mongoose");

const remarkSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },

    staffName: {
      type: String,
      required: true,
      trim: true,
    },

    remarks: {
      type: String,
      required: true,
      trim: true,
    },

    medium: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Phone Call",
        "Meeting",
        "WhatsApp",
        "Email",
        "Company Visit",
        "Other",
      ],
    },
  },
  {
    timestamps: true,
  }
);

remarkSchema.index({
  clientId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Remark",
  remarkSchema
);