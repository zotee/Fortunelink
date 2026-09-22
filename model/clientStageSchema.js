const mongoose = require("mongoose");
const Counter = require("./CounterModel");

const clientStageSchema = new mongoose.Schema(
  {
    stageId: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
      trim: true,
    },

    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
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
// AUTO-GENERATE ID FOR NEW STAGES
// =================================================

clientStageSchema.pre("save", async function () {
  if (this.stageId) {
    return;
  }

  const counter = await Counter.findOneAndUpdate(
    {
      _id: "ClientStageId",
    },
    {
      $inc: {
        sequence_value: 1,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  this.stageId = `S-${2323 + counter.sequence_value}`;
});

clientStageSchema.index({
  isActive: 1,
  displayOrder: 1,
});

module.exports = mongoose.model(
  "ClientStage",
  clientStageSchema,
);