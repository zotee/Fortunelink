const mongoose = require("mongoose");

// =================================================
// CLIENT STAGE HISTORY
// =================================================
const clientStageHistorySchema = new mongoose.Schema(
  {
    clientRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    clientId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    fromStage: {
      type: String,
      default: null,
    },

    fromStageName: {
      type: String,
      default: null,
    },

    toStage: {
      type: String,
      required: true,
      trim: true,
    },

    toStageName: {
      type: String,
      required: true,
      trim: true,
    },

    // Snapshot of Stage Master amount when client entered stage.
    toStageAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Payment created for this transition when amount > 0.
    paymentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    changedBy: {
      type: String,
      required: true,
    },

    changedByRole: {
      type: String,
      required: true,
      enum: ["superadmin", "staff"],
    },

    staffId: {
      type: String,
      default: null,
    },

    changedByName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

clientStageHistorySchema.index({
  clientId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ClientStageHistory", clientStageHistorySchema);
