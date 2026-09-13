const mongoose = require("mongoose");

const staffTargetSchema = new mongoose.Schema(
  {
    // =============================================
    // STAFF
    // =============================================

    staffRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },

    staffId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    staffName: {
      type: String,
      required: true,
      trim: true,
    },

    // =============================================
    // TARGET PERIOD
    //
    // Example: 2026-09
    // =============================================

    targetMonth: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
      index: true,
    },

    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    // =============================================
    // CREATED / ASSIGNED BY
    // =============================================

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    assignedByName: {
      type: String,
      required: true,
      trim: true,
    },

    // =============================================
    // LAST UPDATED BY
    // =============================================

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    updatedByName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Only one monthly target per staff
staffTargetSchema.index(
  {
    staffId: 1,
    targetMonth: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("StaffTarget", staffTargetSchema);
