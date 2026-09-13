const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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
    // PAYMENT
    // =================================================

    paymentName: {
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

    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: ["Cash", "Bank Transfer", "Online Payment", "Cheque", "Other"],
    },

    paymentDate: {
      type: Date,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Completed", "Cancelled", "Refunded"],
      default: "Completed",
      index: true,
    },

    // =================================================
    // CLIENT STAGE SNAPSHOT
    // =================================================

    stageAtPayment: {
      type: String,
      required: true,
      trim: true,
    },

    // =================================================
    // WHO RECORDED PAYMENT
    // =================================================

    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    collectedByRole: {
      type: String,
      required: true,
      enum: ["superadmin", "staff"],
    },

    collectedByName: {
      type: String,
      required: true,
      trim: true,
    },

    // =================================================
    // STAFF WHO GETS CREDIT
    // =================================================

    creditedStaffRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },

    creditedStaff: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    creditedStaffName: {
      type: String,
      required: true,
      trim: true,
    },

    // =================================================
    // OPTIONAL DETAILS
    // =================================================

    referenceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    receiptNumber: {
      type: String,
      trim: true,
      default: "",
    },

    bankName: {
      type: String,
      trim: true,
      default: "",
    },

    note: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({
  clientRef: 1,
  paymentDate: -1,
  createdAt: -1,
});

paymentSchema.index({
  creditedStaff: 1,
  paymentDate: -1,
});

module.exports = mongoose.model("Payment", paymentSchema);
