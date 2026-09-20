const Client = require("../model/clientSchema");
const Staff = require("../model/staffSchema");
const Payment = require("../model/paymentSchema");
const StaffTarget = require("../model/staffTargetSchema");
const ClientStage = require("../model/clientStageSchema");

// =================================================
// HELPERS
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
  const paddedNextMonth = String(nextMonth).padStart(2, "0");

  return {
    start: new Date(`${targetMonth}-01T00:00:00+09:00`),
    end: new Date(`${nextYear}-${paddedNextMonth}-01T00:00:00+09:00`),
  };
};

const getStageNameMap = async () => {
  const stages = await ClientStage.find({}).select("key name").lean();

  return new Map(stages.map((stage) => [stage.key, stage.name]));
};

const normalizeRecentPayment = (payment) => {
  return {
    ...payment,

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
// ADMIN DASHBOARD
//
// GET /api/dashboard/admin?month=2026-09
// =================================================

exports.getAdminDashboard = async (req, res) => {
  try {
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
    // BASIC COUNTS
    // =================================================

    const [totalClients, totalStaff, activeStaff, stageNameMap] =
      await Promise.all([
        Client.countDocuments(),

        Staff.countDocuments(),

        Staff.countDocuments({
          isActive: true,
        }),

        getStageNameMap(),
      ]);

    // =================================================
    // CLIENT STAGE BREAKDOWN
    // =================================================

    const stageBreakdownRaw = await Client.aggregate([
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
    ]);

    const stageBreakdown = stageBreakdownRaw.map((item) => {
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
    // ALL-TIME COMPLETED PAYMENTS
    //
    // No ClientFee / outstanding calculation.
    // =================================================

    const allTimePaymentResult = await Payment.aggregate([
      {
        $match: {
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

    const totalCollectedAllTime = Number(
      allTimePaymentResult[0]?.totalCollected || 0,
    );

    const totalCompletedPayments = Number(
      allTimePaymentResult[0]?.paymentCount || 0,
    );

    const totalPayingClients = allTimePaymentResult[0]?.clientIds?.length || 0;

    // =================================================
    // SELECTED MONTH PAYMENTS
    // =================================================

    const monthlyPaymentResult = await Payment.aggregate([
      {
        $match: {
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

    const monthlyCollected = Number(
      monthlyPaymentResult[0]?.totalCollected || 0,
    );

    const monthlyPaymentCount = Number(
      monthlyPaymentResult[0]?.paymentCount || 0,
    );

    const monthlyClientCount = monthlyPaymentResult[0]?.clientIds?.length || 0;

    // =================================================
    // MONTHLY TARGETS
    // =================================================

    const monthlyTargets = await StaffTarget.find({
      targetMonth: selectedMonth,
    }).lean();

    const totalTarget = monthlyTargets.reduce(
      (total, target) => total + Number(target.targetAmount || 0),
      0,
    );

    const targetAchievement =
      totalTarget > 0
        ? Number(((monthlyCollected / totalTarget) * 100).toFixed(2))
        : 0;

    // =================================================
    // STAFF PAYMENT PERFORMANCE
    // =================================================

    const staffPayments = await Payment.aggregate([
      {
        $match: {
          paymentStatus: "Completed",

          paymentDate: {
            $gte: start,
            $lt: end,
          },
        },
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

    const paymentPerformanceMap = new Map(
      staffPayments.map((item) => [
        item._id,

        {
          totalCollected: Number(item.totalCollected || 0),

          paymentCount: Number(item.paymentCount || 0),

          clientCount: item.clientIds?.length || 0,
        },
      ]),
    );

    // =================================================
    // ACTIVE STAFF RANKING
    // =================================================

    const staffList = await Staff.find({
      isActive: true,
    })
      .select("_id staffId name email")
      .lean();

    let rankings = staffList.map((staff) => {
      const paymentData = paymentPerformanceMap.get(staff.staffId) || {
        totalCollected: 0,
        paymentCount: 0,
        clientCount: 0,
      };

      const targetAmount = targetMap.get(staff.staffId) || 0;

      // This is TARGET remaining,
      // not client outstanding.
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

    rankings.sort(
      (a, b) =>
        b.totalCollected - a.totalCollected ||
        b.achievementPercentage - a.achievementPercentage,
    );

    rankings = rankings.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    // =================================================
    // RECENT COMPLETED PAYMENTS
    // =================================================

    const recentPaymentDocuments = await Payment.find({
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
          "creditedStaff",
          "creditedStaffName",
          "collectedByName",
          "referenceNumber",
          "receiptNumber",
          "bankName",
          "createdAt",

          // Legacy fallbacks.
          "paymentName",
          "expectedAmount",
          "stageAtPayment",
        ].join(" "),
      )
      .lean();

    const recentPayments = recentPaymentDocuments.map(normalizeRecentPayment);

    return res.status(200).json({
      success: true,

      selectedMonth,

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

      rankings,

      stageBreakdown,

      recentPayments,
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
    // STAGE NAMES
    // =================================================

    const stageNameMap = await getStageNameMap();

    // =================================================
    // STAGE BREAKDOWN
    // =================================================

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
    // MONTHLY COMPLETED PAYMENTS
    //
    // Performance follows creditedStaff snapshot.
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
      monthlyPerformanceResult[0]?.totalCollected || 0,
    );

    const paymentCount = Number(monthlyPerformanceResult[0]?.paymentCount || 0);

    const payingClientCount =
      monthlyPerformanceResult[0]?.clientIds?.length || 0;

    // Staff target remaining.
    // This is NOT client outstanding.
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
    // ALL-TIME STAFF COMPLETED COLLECTIONS
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

    const allTimeCollected = Number(allTimeStaffResult[0]?.totalCollected || 0);

    const allTimePaymentCount = Number(
      allTimeStaffResult[0]?.paymentCount || 0,
    );

    const allTimePayingClientCount =
      allTimeStaffResult[0]?.clientIds?.length || 0;

    // =================================================
    // RECENT COMPLETED PAYMENTS
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

          // Legacy fallbacks.
          "paymentName",
          "expectedAmount",
          "stageAtPayment",
        ].join(" "),
      )
      .lean();

    const recentPayments = recentPaymentDocuments.map(normalizeRecentPayment);

    // =================================================
    // RECENT ASSIGNED CLIENTS
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
