const ClientStage = require("../model/clientStageSchema");
// =================================================
// DEFAULT CLIENT STAGES
// IMPORTANT:
// All amounts are 0 until Admin approves actual charges.
// =================================================
const DEFAULT_CLIENT_STAGES = [
  {
    key: "registeredPaid",
    name: "Registered / Paid",
    amount: 0,
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
// SEED DEFAULT STAGES
// $setOnInsert means:
// Admin-edited name/amount will NOT be overwritten
// every time the server restarts.
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
        },
      },
      upsert: true,
    },
  }));
  if (operations.length === 0) {
    return;
  }
  await ClientStage.bulkWrite(operations);
  console.log("Default client stages checked.");
};
// =================================================
// FIND ACTIVE STAGE
// =================================================
const findActiveClientStage = async (stageKey) => {
  if (!stageKey) {
    return null;
  }
  return ClientStage.findOne({
    key: String(stageKey).trim(),
    isActive: true,
  }).lean();
};
// =================================================
// FIND ANY STAGE
// =================================================
const findClientStage = async (stageKey) => {
  if (!stageKey) {
    return null;
  }
  return ClientStage.findOne({
    key: String(stageKey).trim(),
  }).lean();
};
module.exports = {
  DEFAULT_CLIENT_STAGES,
  seedDefaultClientStages,
  findActiveClientStage,
  findClientStage,
};
