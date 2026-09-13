const mongoose = require("mongoose");

const { CLIENT_STAGES } = require("../constants/clientStages");

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
      trim: true,
      index: true,
    },

    fromStage: {
      type: String,
      enum: [...CLIENT_STAGES, null],
      default: null,
    },

    toStage: {
      type: String,
      enum: CLIENT_STAGES,
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    changedByRole: {
      type: String,
      enum: ["superadmin", "staff"],
      required: true,
    },

    staffId: {
      type: String,
      default: null,
      trim: true,
    },

    changedByName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

clientStageHistorySchema.index({
  clientRef: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ClientStageHistory", clientStageHistorySchema);
