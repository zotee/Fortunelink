const ClientStage = require("../model/clientStageSchema");

// =================================================
// NORMALIZE STAGE ID
// =================================================

const normalizeStageId = (stageId) => {
  return String(stageId || "")
    .trim()
    .toUpperCase();
};

// =================================================
// FIND ACTIVE STAGE BY CUSTOM ID
// Example: S-2324
// =================================================

const findActiveClientStage = async (stageId) => {
  const normalizedStageId = normalizeStageId(stageId);

  if (!normalizedStageId) {
    return null;
  }

  return ClientStage.findOne({
    stageId: normalizedStageId,
    isActive: true,
  }).lean();
};

// =================================================
// FIND ANY STAGE BY CUSTOM ID
// =================================================

const findClientStage = async (stageId) => {
  const normalizedStageId = normalizeStageId(stageId);

  if (!normalizedStageId) {
    return null;
  }

  return ClientStage.findOne({
    stageId: normalizedStageId,
  }).lean();
};

// =================================================
// FIND ACTIVE STAGES
// =================================================

const findActiveClientStages = async () => {
  return ClientStage.find({
    isActive: true,
  })
    .sort({
      displayOrder: 1,
      createdAt: 1,
    })
    .lean();
};

module.exports = {
  normalizeStageId,
  findActiveClientStage,
  findClientStage,
  findActiveClientStages,
};