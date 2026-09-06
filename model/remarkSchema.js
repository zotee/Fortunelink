const mongoose = require("mongoose");

const remarkSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
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
      enum: ["Phone Call", "Meeting", "WhatsApp", "Company Visit", "Other"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Remark", remarkSchema);