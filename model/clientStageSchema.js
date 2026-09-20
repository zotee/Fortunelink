const mongoose = require("mongoose");
// =================================================
// CLIENT STAGE MASTER
// =================================================
const clientStageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    createdById: {
      type: String,
      default: null,
    },
    createdByName: {
      type: String,
      default: null,
    },
    updatedById: {
      type: String,
      default: null,
    },
    updatedByName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);
// =================================================
// INDEX
// =================================================
clientStageSchema.index({
  isActive: 1,
  displayOrder: 1,
});
module.exports = mongoose.model("ClientStage", clientStageSchema);
