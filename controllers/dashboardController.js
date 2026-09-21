const Client = require("../model/clientSchema");
const Staff = require("../model/staffSchema");
const Payment = require("../model/paymentSchema");
const StaffTarget = require("../model/staffTargetSchema");
const ClientStage = require("../model/clientStageSchema");

const ProfileModule = require("../model/profileSchema");
const Profile = ProfileModule.Profile || ProfileModule;

// =================================================
// CONSTANTS
// =================================================

const VISA_STATUSES = [
  "student",
  "dependent",
  "designatedActivitiesJobHunting",
  "designatedActivities",
  "engineerHumanitiesInternationalServices",
  "specifiedSkilledWorker1",
  "specifiedSkilledWorker2",
  "skilledLabor",
  "technicalInternTraining",
  "intra-companyTransferee",
  "nursingCare",
  "highlySkilledProfessional",
  "businessManager",
  "permanentResident",
  "spouseChildOfJapaneseNational",
  "spouseChildOfPermanentResident",
  "longTermResident",
  "other",
];

const PREFER_CATEGORIES = [
  "newJob",
  "jobChange",
  "dependentVisaRenewal",
  "visaServiceOnlyRenewal",
  "visaServiceOnlyChange",
  "otherVisaService",
];

const PAYMENT_STATUSES = ["Completed", "Cancelled", "Refunded"];

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Online Payment",
  "Cheque",
  "Other",
];

// =================================================
// BASIC HELPERS
// =================================================

const normalizeQueryValue = (value) => {
  return String(value || "").trim();
};

const escapeRegex = (value) => {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const exactRegex = (value) => ({
  $regex: `^${escapeRegex(value)}$`,
  $options: "i",
});

const normalizeStaffId = (value) => {
  const staffId = normalizeQueryValue(value);

  return staffId ? staffId.toUpperCase() : "";
};

// =================================================
// MONTH
// =================================================

const isValidMonth = (value) => {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }

  const month = Number(value.split("-")[1]);

  return month >= 1 && month <= 12;
};

const getCurrentJapanMonth = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
};

const getJapanMonthRange = (targetMonth) => {
  const [yearString, monthString] = targetMonth.split("-");

  const year = Number(yearString);
  const month = Number(monthString);

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start: new Date(`${targetMonth}-01T00:00:00+09:00`),
    end: new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`,
    ),
  };
};

// =================================================
// PAGINATION
// =================================================

const parsePagination = (pageValue, limitValue, defaultLimit = 10) => {
  const page = Math.max(Number.parseInt(pageValue, 10) || 1, 1);

  const limit = Math.min(
    Math.max(Number.parseInt(limitValue, 10) || defaultLimit, 1),
    100,
  );

  return {
    page,
    limit,
  };
};

const createPagination = ({ total, page, limit, count }) => {
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1;

  const from = total === 0 ? null : (currentPage - 1) * limit + 1;

  const to = total === 0 ? null : Math.min(from + count - 1, total);

  return {
    currentPage,
    totalPages,
    perPage: limit,
    total,
    from,
    to,
    hasNextPage: totalPages > 0 && currentPage < totalPages,
    hasPreviousPage: totalPages > 0 && currentPage > 1,
  };
};

// =================================================
// QUERY VALIDATION
// =================================================

const validateAdminDashboardQuery = (query) => {
  const currentVisaStatus = normalizeQueryValue(query.currentVisaStatus);

  if (currentVisaStatus && !VISA_STATUSES.includes(currentVisaStatus)) {
    return "Invalid currentVisaStatus.";
  }

  const preferCategory = normalizeQueryValue(query.preferCategory);

  if (preferCategory && !PREFER_CATEGORIES.includes(preferCategory)) {
    return "Invalid preferCategory.";
  }

  const paymentStatus = normalizeQueryValue(query.paymentStatus);

  if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) {
    return "Invalid paymentStatus.";
  }

  const paymentMethod = normalizeQueryValue(query.paymentMethod);

  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return "Invalid paymentMethod.";
  }

  return null;
};

// =================================================
// CLIENT FILTERS
// =================================================

const hasClientFilters = (query) => {
  return Boolean(
    normalizeQueryValue(query.free_word) ||
    normalizeQueryValue(query.staffId) ||
    normalizeQueryValue(query.currentStage) ||
    normalizeQueryValue(query.currentVisaStatus) ||
    normalizeQueryValue(query.preferCategory) ||
    normalizeQueryValue(query.nationality) ||
    normalizeQueryValue(query.japaneseLevel),
  );
};

const buildClientDashboardPipeline = (query) => {
  const clientMatch = {};

  const staffId = normalizeStaffId(query.staffId);

  const currentStage = normalizeQueryValue(query.currentStage);

  const currentVisaStatus = normalizeQueryValue(query.currentVisaStatus);

  const preferCategory = normalizeQueryValue(query.preferCategory);

  if (staffId) {
    clientMatch.assignedStaff = staffId;
  }

  if (currentStage) {
    clientMatch.currentStage = currentStage;
  }

  if (currentVisaStatus) {
    clientMatch.currentVisaStatus = currentVisaStatus;
  }

  if (preferCategory) {
    clientMatch.preferCategory = preferCategory;
  }

  const pipeline = [
    {
      $match: clientMatch,
    },
    {
      $lookup: {
        from: Profile.collection.name,
        localField: "clientId",
        foreignField: "clientId",
        as: "profile",
      },
    },
    {
      $unwind: {
        path: "$profile",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: Staff.collection.name,
        localField: "assignedStaff",
        foreignField: "staffId",
        as: "staffDetails",
      },
    },
    {
      $unwind: {
        path: "$staffDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: ClientStage.collection.name,
        localField: "currentStage",
        foreignField: "key",
        as: "stageDetails",
      },
    },
    {
      $unwind: {
        path: "$stageDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  const nationality = normalizeQueryValue(query.nationality);

  if (nationality) {
    pipeline.push({
      $match: {
        "profile.nationality": exactRegex(nationality),
      },
    });
  }

  const japaneseLevel = normalizeQueryValue(query.japaneseLevel);

  if (japaneseLevel) {
    pipeline.push({
      $match: {
        "profile.japaneseLanguageLevel": exactRegex(japaneseLevel),
      },
    });
  }

  const freeWord = normalizeQueryValue(query.free_word);

  if (freeWord) {
    const searchRegex = {
      $regex: escapeRegex(freeWord),
      $options: "i",
    };

    pipeline.push({
      $match: {
        $or: [
          {
            clientId: searchRegex,
          },
          {
            fullName: searchRegex,
          },
          {
            phone: searchRegex,
          },
          {
            assignedStaff: searchRegex,
          },
          {
            currentVisaStatus: searchRegex,
          },
          {
            preferCategory: searchRegex,
          },
          {
            clientStatus: searchRegex,
          },
          {
            "profile.furigana": searchRegex,
          },
          {
            "profile.email": searchRegex,
          },
          {
            "profile.nationality": searchRegex,
          },
          {
            "profile.japaneseLanguageLevel": searchRegex,
          },
          {
            "profile.prefecture": searchRegex,
          },
          {
            "profile.address": searchRegex,
          },
          {
            "staffDetails.name": searchRegex,
          },
          {
            "staffDetails.email": searchRegex,
          },
          {
            "stageDetails.name": searchRegex,
          },
        ],
      },
    });
  }

  return pipeline;
};

// =================================================
// PAYMENT HELPERS
// =================================================

const buildPaymentScope = (query, filteredClientIds, useClientIds) => {
  const match = {};

  const staffId = normalizeStaffId(query.staffId);

  const paymentMethod = normalizeQueryValue(query.paymentMethod);

  const paymentStage = normalizeQueryValue(query.paymentStage);

  if (staffId) {
    match.creditedStaff = staffId;
  }

  if (paymentMethod) {
    match.paymentMethod = paymentMethod;
  }

  if (paymentStage) {
    match.stageKey = paymentStage;
  }

  if (useClientIds) {
    match.clientId = {
      $in: filteredClientIds,
    };
  }

  return match;
};

const normalizeDashboardPayment = (payment, clientNameMap = new Map()) => {
  return {
    ...payment,

    clientName: clientNameMap.get(payment.clientId) || "",

    stageKey: payment.stageKey || "",

    stageName:
      payment.stageName ||
      payment.paymentName ||
      payment.stageAtPayment ||
      "Legacy Payment",

    stageAmount:
      Number(payment.stageAmount) > 0
        ? Number(payment.stageAmount)
        : Number(payment.expectedAmount ?? payment.amountPaid ?? 0),
  };
};

// =================================================
// STAGE NAME MAP
// =================================================

const getStageNameMap = async () => {
  const stages = await ClientStage.find({}).select("key name").lean();

  return new Map(stages.map((stage) => [stage.key, stage.name]));
};

// =================================================
// ADMIN DASHBOARD
//
// GET /api/dashboard/admin
//
// Query:
// month
// free_word
// staffId
// currentStage
// currentVisaStatus
// preferCategory
// nationality
// japaneseLevel
// paymentStatus
// paymentMethod
// paymentStage
// rankingPage
// rankingLimit
// paymentPage
// paymentLimit
// =================================================

exports.getAdminDashboard = async (req, res) => {
  try {
    const selectedMonth =
      normalizeQueryValue(req.query.month) || getCurrentJapanMonth();

    if (!isValidMonth(selectedMonth)) {
      return res.status(400).json({
        success: false,
        message: "Month must be in YYYY-MM format.",
      });
    }

    const queryError = validateAdminDashboardQuery(req.query);

    if (queryError) {
      return res.status(400).json({
        success: false,
        message: queryError,
      });
    }

    const { start, end } = getJapanMonthRange(selectedMonth);

    const rankingPaginationInput = parsePagination(
      req.query.rankingPage,
      req.query.rankingLimit,
      10,
    );

    const paymentPaginationInput = parsePagination(
      req.query.paymentPage,
      req.query.paymentLimit,
      10,
    );

    // =================================================
    // FILTER OPTIONS + BASIC STAFF COUNTS
    // =================================================

    const [
      totalStaff,
      activeStaff,
      staffDocuments,
      stageDocuments,
      nationalitiesRaw,
      japaneseLevelsRaw,
    ] = await Promise.all([
      Staff.countDocuments(),

      Staff.countDocuments({
        isActive: true,
      }),

      Staff.find({})
        .select("_id staffId name email isActive")
        .sort({
          name: 1,
        })
        .lean(),

      ClientStage.find({})
        .select("key name amount isActive displayOrder")
        .sort({
          displayOrder: 1,
          name: 1,
        })
        .lean(),

      Profile.distinct("nationality"),

      Profile.distinct("japaneseLanguageLevel"),
    ]);

    const nationalities = nationalitiesRaw
      .map((value) => normalizeQueryValue(value))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const japaneseLevels = japaneseLevelsRaw
      .map((value) => normalizeQueryValue(value))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const stageNameMap = new Map(
      stageDocuments.map((stage) => [stage.key, stage.name]),
    );

    // =================================================
    // FILTERED CLIENTS
    // =================================================

    const clientPipeline = buildClientDashboardPipeline(req.query);

    const clientAggregation = await Client.aggregate([
      ...clientPipeline,
      {
        $facet: {
          ids: [
            {
              $project: {
                _id: 0,
                clientId: 1,
              },
            },
          ],

          total: [
            {
              $count: "count",
            },
          ],

          stages: [
            {
              $group: {
                _id: {
                  stage: {
                    $ifNull: ["$currentStage", ""],
                  },

                  clientStatus: {
                    $ifNull: ["$clientStatus", "Registration Pending"],
                  },
                },

                count: {
                  $sum: 1,
                },
              },
            },

            {
              $sort: {
                count: -1,
              },
            },
          ],
        },
      },
    ]);

    const clientResult = clientAggregation?.[0] || {};

    const filteredClientIds = (clientResult.ids || [])
      .map((item) => item.clientId)
      .filter(Boolean);

    const totalClients = Number(clientResult.total?.[0]?.count || 0);

    const clientFilterActive = hasClientFilters(req.query);

    const stageBreakdown = (clientResult.stages || []).map((item) => {
      const stageKey = item._id?.stage || "";

      const fallbackName =
        item._id?.clientStatus || stageKey || "Registration Pending";

      return {
        stage: stageKey,

        stageName: stageNameMap.get(stageKey) || fallbackName,

        count: item.count,
      };
    });

    // =================================================
    // COMPLETED COLLECTION SCOPE
    // =================================================

    const collectionScope = buildPaymentScope(
      req.query,
      filteredClientIds,
      clientFilterActive,
    );

    const allTimeCollectionMatch = {
      ...collectionScope,
      paymentStatus: "Completed",
    };

    const monthlyCollectionMatch = {
      ...allTimeCollectionMatch,

      paymentDate: {
        $gte: start,

        $lt: end,
      },
    };

    // =================================================
    // PAYMENT TABLE SCOPE
    // =================================================

    const paymentTableMatch = {
      ...buildPaymentScope(req.query, filteredClientIds, clientFilterActive),

      paymentDate: {
        $gte: start,

        $lt: end,
      },
    };

    const paymentStatus = normalizeQueryValue(req.query.paymentStatus);

    if (paymentStatus) {
      paymentTableMatch.paymentStatus = paymentStatus;
    }

    // =================================================
    // PAYMENT COLLECTION TOTALS
    // =================================================

    const [allTimePaymentResult, monthlyPaymentResult] = await Promise.all([
      Payment.aggregate([
        {
          $match: allTimeCollectionMatch,
        },

        {
          $group: {
            _id: null,

            totalCollected: {
              $sum: "$amountPaid",
            },

            paymentCount: {
              $sum: 1,
            },

            clientIds: {
              $addToSet: "$clientId",
            },
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: monthlyCollectionMatch,
        },

        {
          $group: {
            _id: null,

            totalCollected: {
              $sum: "$amountPaid",
            },

            paymentCount: {
              $sum: 1,
            },

            clientIds: {
              $addToSet: "$clientId",
            },
          },
        },
      ]),
    ]);

    const totalCollectedAllTime = Number(
      allTimePaymentResult?.[0]?.totalCollected || 0,
    );

    const totalCompletedPayments = Number(
      allTimePaymentResult?.[0]?.paymentCount || 0,
    );

    const totalPayingClients =
      allTimePaymentResult?.[0]?.clientIds?.length || 0;

    const monthlyCollected = Number(
      monthlyPaymentResult?.[0]?.totalCollected || 0,
    );

    const monthlyPaymentCount = Number(
      monthlyPaymentResult?.[0]?.paymentCount || 0,
    );

    const monthlyClientCount =
      monthlyPaymentResult?.[0]?.clientIds?.length || 0;

    // =================================================
    // TARGETS
    // =================================================

    const staffId = normalizeStaffId(req.query.staffId);

    const targetQuery = {
      targetMonth: selectedMonth,
    };

    if (staffId) {
      targetQuery.staffId = staffId;
    }

    const monthlyTargets = await StaffTarget.find(targetQuery).lean();

    const totalTarget = monthlyTargets.reduce(
      (total, target) => total + Number(target.targetAmount || 0),

      0,
    );

    const targetAchievement =
      totalTarget > 0
        ? Number(((monthlyCollected / totalTarget) * 100).toFixed(2))
        : 0;

    // =================================================
    // STAFF PERFORMANCE
    // =================================================

    const staffPerformanceMatch = {
      ...monthlyCollectionMatch,
    };

    const staffPayments = await Payment.aggregate([
      {
        $match: staffPerformanceMatch,
      },

      {
        $group: {
          _id: "$creditedStaff",

          staffName: {
            $last: "$creditedStaffName",
          },

          totalCollected: {
            $sum: "$amountPaid",
          },

          paymentCount: {
            $sum: 1,
          },

          clientIds: {
            $addToSet: "$clientId",
          },
        },
      },
    ]);

    const targetMap = new Map(
      monthlyTargets.map((target) => [
        target.staffId,
        Number(target.targetAmount || 0),
      ]),
    );

    const performanceMap = new Map(
      staffPayments.map((item) => [
        item._id,
        {
          totalCollected: Number(item.totalCollected || 0),

          paymentCount: Number(item.paymentCount || 0),

          clientCount: item.clientIds?.length || 0,
        },
      ]),
    );

    let rankingStaffList = staffDocuments.filter((staff) => staff.isActive);

    if (staffId) {
      rankingStaffList = staffDocuments.filter(
        (staff) => staff.staffId === staffId,
      );
    }

    let allRankings = rankingStaffList.map((staff) => {
      const paymentData = performanceMap.get(staff.staffId) || {
        totalCollected: 0,
        paymentCount: 0,
        clientCount: 0,
      };

      const targetAmount = targetMap.get(staff.staffId) || 0;

      const remainingAmount = Math.max(
        targetAmount - paymentData.totalCollected,
        0,
      );

      const achievementPercentage =
        targetAmount > 0
          ? Number(
              ((paymentData.totalCollected / targetAmount) * 100).toFixed(2),
            )
          : 0;

      let status = "No Target";

      if (targetAmount > 0) {
        if (paymentData.totalCollected >= targetAmount) {
          status = "Achieved";
        } else if (paymentData.totalCollected > 0) {
          status = "In Progress";
        } else {
          status = "Not Started";
        }
      }

      return {
        staffId: staff.staffId,

        staffName: staff.name,

        email: staff.email,

        targetAmount,

        totalCollected: paymentData.totalCollected,

        remainingAmount,

        achievementPercentage,

        paymentCount: paymentData.paymentCount,

        clientCount: paymentData.clientCount,

        status,
      };
    });

    allRankings.sort(
      (a, b) =>
        b.totalCollected - a.totalCollected ||
        b.achievementPercentage - a.achievementPercentage ||
        a.staffName.localeCompare(b.staffName),
    );

    allRankings = allRankings.map((item, index) => ({
      rank: index + 1,

      ...item,
    }));

    const rankingTotal = allRankings.length;

    const rankingTotalPages =
      rankingTotal > 0
        ? Math.ceil(rankingTotal / rankingPaginationInput.limit)
        : 0;

    const rankingPage =
      rankingTotalPages > 0
        ? Math.min(rankingPaginationInput.page, rankingTotalPages)
        : 1;

    const rankingSkip = (rankingPage - 1) * rankingPaginationInput.limit;

    const rankingItems = allRankings.slice(
      rankingSkip,
      rankingSkip + rankingPaginationInput.limit,
    );

    // =================================================
    // PAYMENT TABLE PAGINATION
    // =================================================

    const paymentTotal = await Payment.countDocuments(paymentTableMatch);

    const paymentTotalPages =
      paymentTotal > 0
        ? Math.ceil(paymentTotal / paymentPaginationInput.limit)
        : 0;

    const paymentPage =
      paymentTotalPages > 0
        ? Math.min(paymentPaginationInput.page, paymentTotalPages)
        : 1;

    const paymentSkip = (paymentPage - 1) * paymentPaginationInput.limit;

    const paymentDocuments = await Payment.find(paymentTableMatch)
      .sort({
        paymentDate: -1,
        createdAt: -1,
      })
      .skip(paymentSkip)
      .limit(paymentPaginationInput.limit)
      .select(
        [
          "clientId",
          "stageKey",
          "stageName",
          "stageAmount",
          "amountPaid",
          "paymentMethod",
          "paymentDate",
          "paymentStatus",
          "creditedStaff",
          "creditedStaffName",
          "collectedByName",
          "referenceNumber",
          "receiptNumber",
          "bankName",
          "createdAt",

          // Legacy.
          "paymentName",
          "expectedAmount",
          "stageAtPayment",
        ].join(" "),
      )
      .lean();

    const paymentClientIds = [
      ...new Set(
        paymentDocuments.map((payment) => payment.clientId).filter(Boolean),
      ),
    ];

    const paymentClients =
      paymentClientIds.length > 0
        ? await Client.find({
            clientId: {
              $in: paymentClientIds,
            },
          })
            .select("clientId fullName")
            .lean()
        : [];

    const clientNameMap = new Map(
      paymentClients.map((client) => [client.clientId, client.fullName]),
    );

    const payments = paymentDocuments.map((payment) =>
      normalizeDashboardPayment(payment, clientNameMap),
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,

      selectedMonth,

      filters: {
        free_word: normalizeQueryValue(req.query.free_word),

        staffId,

        currentStage: normalizeQueryValue(req.query.currentStage),

        currentVisaStatus: normalizeQueryValue(req.query.currentVisaStatus),

        preferCategory: normalizeQueryValue(req.query.preferCategory),

        nationality: normalizeQueryValue(req.query.nationality),

        japaneseLevel: normalizeQueryValue(req.query.japaneseLevel),

        paymentStatus,

        paymentMethod: normalizeQueryValue(req.query.paymentMethod),

        paymentStage: normalizeQueryValue(req.query.paymentStage),
      },

      filterOptions: {
        staff: staffDocuments.map((staff) => ({
          staffId: staff.staffId,

          name: staff.name,

          isActive: staff.isActive,
        })),

        stages: stageDocuments.map((stage) => ({
          key: stage.key,

          name: stage.name,

          isActive: stage.isActive,
        })),

        nationalities,

        japaneseLevels,
      },

      overview: {
        totalClients,

        totalStaff,

        activeStaff,

        totalCollectedAllTime,

        totalCompletedPayments,

        totalPayingClients,

        monthlyCollected,

        monthlyPaymentCount,

        monthlyClientCount,

        totalTarget,

        targetAchievement,
      },

      rankings: {
        data: rankingItems,

        pagination: createPagination({
          total: rankingTotal,

          page: rankingPage,

          limit: rankingPaginationInput.limit,

          count: rankingItems.length,
        }),
      },

      stageBreakdown,

      payments: {
        data: payments,

        pagination: createPagination({
          total: paymentTotal,

          page: paymentPage,

          limit: paymentPaginationInput.limit,

          count: payments.length,
        }),
      },
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to load admin dashboard.",
    });
  }
};

// =================================================
// STAFF DASHBOARD
//
// Existing staff dashboard kept compatible.
// GET /api/dashboard/staff?month=2026-09
// =================================================

exports.getStaffDashboard = async (req, res) => {
  try {
    const staffId = req.user.staffId;

    if (!staffId) {
      return res.status(400).json({
        success: false,

        message: "Staff ID is missing from the authenticated account.",
      });
    }

    const selectedMonth = String(
      req.query.month || getCurrentJapanMonth(),
    ).trim();

    if (!isValidMonth(selectedMonth)) {
      return res.status(400).json({
        success: false,

        message: "Month must be in YYYY-MM format.",
      });
    }

    const { start, end } = getJapanMonthRange(selectedMonth);

    // =================================================
    // STAFF
    // =================================================

    const staff = await Staff.findOne({
      staffId,
    })
      .select("_id staffId name email phone location isActive")
      .lean();

    if (!staff) {
      return res.status(404).json({
        success: false,

        message: "Staff account not found.",
      });
    }

    // =================================================
    // ASSIGNED CLIENTS
    // =================================================

    const assignedClients = await Client.find({
      assignedStaff: staffId,
    })
      .select(
        [
          "_id",
          "clientId",
          "fullName",
          "phone",
          "currentVisaStatus",
          "currentStage",
          "clientStatus",
          "createdAt",
        ].join(" "),
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    const totalAssignedClients = assignedClients.length;

    // =================================================
    // STAGES
    // =================================================

    const stageNameMap = await getStageNameMap();

    const stageMap = new Map();

    for (const client of assignedClients) {
      const stageKey = client.currentStage || "";

      const stageName =
        stageNameMap.get(stageKey) ||
        client.clientStatus ||
        stageKey ||
        "Registration Pending";

      const existing = stageMap.get(stageKey);

      if (existing) {
        existing.count += 1;
      } else {
        stageMap.set(stageKey, {
          stage: stageKey,

          stageName,

          count: 1,
        });
      }
    }

    const stageBreakdown = Array.from(stageMap.values()).sort(
      (a, b) => b.count - a.count,
    );

    // =================================================
    // MONTHLY TARGET
    // =================================================

    const target = await StaffTarget.findOne({
      staffId,

      targetMonth: selectedMonth,
    }).lean();

    const targetAmount = Number(target?.targetAmount || 0);

    // =================================================
    // MONTHLY PERFORMANCE
    // =================================================

    const monthlyPerformanceResult = await Payment.aggregate([
      {
        $match: {
          creditedStaff: staffId,

          paymentStatus: "Completed",

          paymentDate: {
            $gte: start,

            $lt: end,
          },
        },
      },

      {
        $group: {
          _id: null,

          totalCollected: {
            $sum: "$amountPaid",
          },

          paymentCount: {
            $sum: 1,
          },

          clientIds: {
            $addToSet: "$clientId",
          },
        },
      },
    ]);

    const totalCollected = Number(
      monthlyPerformanceResult?.[0]?.totalCollected || 0,
    );

    const paymentCount = Number(
      monthlyPerformanceResult?.[0]?.paymentCount || 0,
    );

    const payingClientCount =
      monthlyPerformanceResult?.[0]?.clientIds?.length || 0;

    const remainingAmount = Math.max(targetAmount - totalCollected, 0);

    const achievementPercentage =
      targetAmount > 0
        ? Number(((totalCollected / targetAmount) * 100).toFixed(2))
        : 0;

    let performanceStatus = "No Target";

    if (targetAmount > 0) {
      if (totalCollected >= targetAmount) {
        performanceStatus = "Achieved";
      } else if (totalCollected > 0) {
        performanceStatus = "In Progress";
      } else {
        performanceStatus = "Not Started";
      }
    }

    // =================================================
    // ALL-TIME
    // =================================================

    const allTimeStaffResult = await Payment.aggregate([
      {
        $match: {
          creditedStaff: staffId,

          paymentStatus: "Completed",
        },
      },

      {
        $group: {
          _id: null,

          totalCollected: {
            $sum: "$amountPaid",
          },

          paymentCount: {
            $sum: 1,
          },

          clientIds: {
            $addToSet: "$clientId",
          },
        },
      },
    ]);

    const allTimeCollected = Number(
      allTimeStaffResult?.[0]?.totalCollected || 0,
    );

    const allTimePaymentCount = Number(
      allTimeStaffResult?.[0]?.paymentCount || 0,
    );

    const allTimePayingClientCount =
      allTimeStaffResult?.[0]?.clientIds?.length || 0;

    // =================================================
    // RECENT PAYMENTS
    // =================================================

    const recentPaymentDocuments = await Payment.find({
      creditedStaff: staffId,

      paymentStatus: "Completed",
    })
      .sort({
        createdAt: -1,
      })
      .limit(8)
      .select(
        [
          "clientId",
          "stageKey",
          "stageName",
          "stageAmount",
          "amountPaid",
          "paymentMethod",
          "paymentDate",
          "paymentStatus",
          "referenceNumber",
          "receiptNumber",
          "bankName",
          "createdAt",

          "paymentName",
          "expectedAmount",
          "stageAtPayment",
        ].join(" "),
      )
      .lean();

    const recentPayments = recentPaymentDocuments.map((payment) =>
      normalizeDashboardPayment(payment),
    );

    // =================================================
    // RECENT CLIENTS
    // =================================================

    const recentClients = assignedClients.slice(0, 8).map((client) => {
      const stageKey = client.currentStage || "";

      return {
        clientId: client.clientId,

        fullName: client.fullName,

        phone: client.phone,

        currentVisaStatus: client.currentVisaStatus,

        currentStage: stageKey,

        currentStageName:
          stageNameMap.get(stageKey) ||
          client.clientStatus ||
          stageKey ||
          "Registration Pending",

        createdAt: client.createdAt,
      };
    });

    return res.status(200).json({
      success: true,

      selectedMonth,

      staff: {
        staffId: staff.staffId,

        name: staff.name,

        email: staff.email,

        phone: staff.phone,

        location: staff.location,

        isActive: staff.isActive,
      },

      overview: {
        totalAssignedClients,

        targetAmount,

        totalCollected,

        remainingAmount,

        achievementPercentage,

        performanceStatus,

        paymentCount,

        payingClientCount,

        allTimeCollected,

        allTimePaymentCount,

        allTimePayingClientCount,
      },

      stageBreakdown,

      recentClients,

      recentPayments,
    });
  } catch (error) {
    console.error("STAFF DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to load staff dashboard.",
    });
  }
};
