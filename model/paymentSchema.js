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
    // STAGE PAYMENT
    // =================================================
    stageHistoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientStageHistory",
      default: null,
    },

    stageKey: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    stageName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    // Snapshot of the Stage Master amount when payment happened.
    stageAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    // For all NEW stage payments:
    // amountPaid === stageAmount
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
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Completed", "Cancelled", "Refunded"],
      default: "Completed",
      index: true,
    },

    // =================================================
    // RECORDED BY
    // =================================================
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    collectedByRole: {
      type: String,
      enum: ["superadmin", "staff"],
      required: true,
    },

    collectedByName: {
      type: String,
      required: true,
      trim: true,
    },

    // =================================================
    // STAFF CREDIT
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
    // OPTIONAL PAYMENT DETAILS
    // =================================================
    referenceNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    receiptNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    bankName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    // =================================================
    // LEGACY FIELDS
    //
    // Keep temporarily so old payment records remain
    // readable while we migrate away from ClientFee.
    // NEW PAYMENTS DO NOT USE THESE.
    // =================================================
    clientFeeRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientFee",
      default: null,
    },

    paymentName: {
      type: String,
      trim: true,
      default: "",
    },

    expectedAmount: {
      type: Number,
      min: 0,
      default: null,
    },

    stageAtPayment: {
      type: String,
      trim: true,
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

paymentSchema.index(
  {
    stageHistoryRef: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      stageHistoryRef: {
        $type: "objectId",
      },
    },
  },
);

module.exports = mongoose.model("Payment", paymentSchema);
