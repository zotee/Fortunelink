const ClientStage = require("../model/clientStageSchema");
const Counter = require("../model/CounterModel");

// =================================================
// DEFAULT CLIENT STAGES
// =================================================

const DEFAULT_CLIENT_STAGES = [
  {
    key: "registeredPaid",
    name: "Registered / Paid",
    amount: 30000,
    displayOrder: 1,
  },
  {
    key: "vacancySearching",
    name: "Vacancy Searching",
    amount: 0,
    displayOrder: 2,
  },
  {
    key: "interviewFixedPreparation",
    name: "Interview Fixed / Preparation",
    amount: 0,
    displayOrder: 3,
  },
  {
    key: "interviewFailed",
    name: "Interview Failed",
    amount: 0,
    displayOrder: 4,
  },
  {
    key: "jobOfferReceived",
    name: "Naitei / Job Offer Received",
    amount: 0,
    displayOrder: 5,
  },
  {
    key: "jobOfferAccepted",
    name: "Job Offer Accepted",
    amount: 0,
    displayOrder: 6,
  },
  {
    key: "jobOfferRejected",
    name: "Job Offer Rejected",
    amount: 0,
    displayOrder: 7,
  },
  {
    key: "visaDocumentsSubmitted",
    name: "Visa Documents Submitted",
    amount: 0,
    displayOrder: 8,
  },
  {
    key: "visaAppliedResultWaiting",
    name: "Visa Applied / Result Waiting",
    amount: 0,
    displayOrder: 9,
  },
  {
    key: "visaApproved",
    name: "Visa Approved",
    amount: 0,
    displayOrder: 10,
  },
  {
    key: "visaRejected",
    name: "Visa Rejected",
    amount: 0,
    displayOrder: 11,
  },
  {
    key: "companyJoining",
    name: "Waiting for Nyusha / Company Joining",
    amount: 0,
    displayOrder: 12,
  },
  {
    key: "employmentStartedCompanyJoined",
    name: "Employment Started / Company Joined",
    amount: 0,
    displayOrder: 13,
  },
  {
    key: "visaRenewal1Year",
    name: "Visa Renewal - 1 Year",
    amount: 0,
    displayOrder: 14,
  },
  {
    key: "visaRenewal3Years",
    name: "Visa Renewal - 3 Years",
    amount: 0,
    displayOrder: 15,
  },
  {
    key: "visaRenewal5Years",
    name: "Visa Renewal - 5 Years",
    amount: 0,
    displayOrder: 16,
  },
  {
    key: "returntoNepal",
    name: "Return to Nepal",
    amount: 0,
    displayOrder: 17,
  },
];

// =================================================
// GENERATE NEXT STAGE ID
// =================================================

const generateNextStageId = async () => {
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

  return `S-${2323 + counter.sequence_value}`;
};

// =================================================
// ASSIGN IDs TO EXISTING STAGES
// =================================================

const assignMissingStageIds = async () => {
  const stagesWithoutId = await ClientStage.find({
    $or: [
      { stageId: { $exists: false } },
      { stageId: null },
      { stageId: "" },
    ],
  })
    .sort({
      displayOrder: 1,
      createdAt: 1,
    })
    .select("_id")
    .lean();

  let assignedCount = 0;

  for (const stage of stagesWithoutId) {
    const stageId = await generateNextStageId();

    /*
     * Use the native collection method because stageId is
     * immutable in the Mongoose schema. This is only for
     * migrating existing records without stageId.
     */
    const result = await ClientStage.collection.updateOne(
      {
        _id: stage._id,
        $or: [
          { stageId: { $exists: false } },
          { stageId: null },
          { stageId: "" },
        ],
      },
      {
        $set: {
          stageId,
        },
      },
    );

    if (result.modifiedCount === 1) {
      assignedCount += 1;
    }
  }

  return assignedCount;
};

// =================================================
// SEED DEFAULT STAGES
// =================================================

const seedDefaultClientStages = async () => {
  const operations = DEFAULT_CLIENT_STAGES.map((stage) => ({
    updateOne: {
      filter: {
        key: stage.key,
      },
      update: {
        $setOnInsert: {
          ...stage,
          isActive: true,
          isSystem: true,
          createdById: null,
          createdByName: "System",
          updatedById: null,
          updatedByName: null,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length === 0) {
    return;
  }

  await ClientStage.bulkWrite(operations);

  const assignedCount = await assignMissingStageIds();

  console.log(
    `Default client stages checked. ${assignedCount} stage ID(s) assigned.`,
  );
};

// =================================================
// FIND ACTIVE STAGE
// =================================================

const findActiveClientStage = async (stageKey) => {
  const normalizedKey = String(stageKey || "").trim();

  if (!normalizedKey) {
    return null;
  }

  return ClientStage.findOne({
    key: normalizedKey,
    isActive: true,
  }).lean();
};

// =================================================
// FIND ANY STAGE
// =================================================

const findClientStage = async (stageKey) => {
  const normalizedKey = String(stageKey || "").trim();

  if (!normalizedKey) {
    return null;
  }

  return ClientStage.findOne({
    key: normalizedKey,
  }).lean();
};

// =================================================
// FIND BY CUSTOM ID
// =================================================

const findClientStageById = async (stageId) => {
  const normalizedStageId = String(stageId || "")
    .trim()
    .toUpperCase();

  if (!normalizedStageId) {
    return null;
  }

  return ClientStage.findOne({
    stageId: normalizedStageId,
  }).lean();
};

module.exports = {
  DEFAULT_CLIENT_STAGES,
  seedDefaultClientStages,
  assignMissingStageIds,
  findActiveClientStage,
  findClientStage,
  findClientStageById,
};