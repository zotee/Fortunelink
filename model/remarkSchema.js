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
      enum: ["Call", "Meeting", "WhatsApp", "Document", "Interview"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Remark", remarkSchema);