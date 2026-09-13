const mongoose = require("mongoose");

const remarkSchema = new mongoose.Schema(
  {
    // MongoDB Client _id
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    // Human-readable Client ID
    // Example: J-176587355
    clientCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // MongoDB ID of the user who created the remark.
    // Can belong to Admin or Staff.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    createdByRole: {
      type: String,
      required: true,
      enum: ["superadmin", "staff"],
    },

    // MongoDB Staff reference.
    // Null when Super Admin creates the remark.
    staffRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },

    // Custom Staff ID such as W-122290.
    // Null when Super Admin creates the remark.
    staffId: {
      type: String,
      default: null,
      trim: true,
    },

    // Snapshot of creator's name.
    // This preserves history even if Staff name changes later.
    staffName: {
      type: String,
      required: true,
      trim: true,
    },

    // User-selected business date.
    // Frontend displays this using Asia/Tokyo.
    remarkDate: {
      type: Date,
      required: true,
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
        "LINE",
        "Other",
      ],
    },

    // Free-text memo
    remarks: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  {
    timestamps: true,
  },
);

// Remark history lookup
remarkSchema.index({
  clientId: 1,
  remarkDate: -1,
  createdAt: -1,
});

module.exports = mongoose.model("Remark", remarkSchema);
