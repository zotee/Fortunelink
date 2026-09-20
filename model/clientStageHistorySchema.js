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
    // Snapshot of the configured amount at the time
    // the client entered this stage.
    toStageAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
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
