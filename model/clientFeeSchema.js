const mongoose = require("mongoose");

const clientFeeSchema = new mongoose.Schema(
  {
    // =================================================
    // CLIENT
    // =================================================

    clientRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    clientId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // =================================================
    // FEE REQUIREMENT
    // =================================================

    feeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    expectedAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    status: {
      type: String,
      enum: ["Active", "Cancelled"],
      default: "Active",
      index: true,
    },

    // =================================================
    // CREATED BY
    // =================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    createdByRole: {
      type: String,
      enum: ["superadmin", "staff"],
      required: true,
    },

    createdByName: {
      type: String,
      required: true,
      trim: true,
    },

    // =================================================
    // CANCEL INFORMATION
    // =================================================

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    cancelledByName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

clientFeeSchema.index({
  clientRef: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ClientFee", clientFeeSchema);
