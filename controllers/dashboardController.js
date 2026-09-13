const Client = require("../model/clientSchema");
const Staff = require("../model/staffSchema");
const ClientFee = require("../model/clientFeeSchema");
const Payment = require("../model/paymentSchema");
const StaffTarget = require("../model/staffTargetSchema");

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

    const [totalClients, totalStaff, activeStaff] = await Promise.all([
      Client.countDocuments(),

      Staff.countDocuments(),

      Staff.countDocuments({
        isActive: true,
      }),
    ]);

    // =================================================
    // CLIENT STAGE BREAKDOWN
    // =================================================

    const stageBreakdownRaw = await Client.aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$currentStage", "Registration Pending"],
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

    const stageBreakdown = stageBreakdownRaw.map((item) => ({
      stage: item._id,
      count: item.count,
    }));

    // =================================================
    // ACTIVE FEES
    // =================================================

    const activeFees = await ClientFee.find({
      status: "Active",
    })
      .select("_id expectedAmount")
      .lean();

    const activeFeeIds = activeFees.map((fee) => fee._id);

    const totalExpected = activeFees.reduce(
      (total, fee) => total + Number(fee.expectedAmount || 0),
      0,
    );

    // =================================================
    // PAID BY ACTIVE FEE
    // =================================================

    let paidByFee = [];

    if (activeFeeIds.length > 0) {
      paidByFee = await Payment.aggregate([
        {
          $match: {
            clientFeeRef: {
              $in: activeFeeIds,
            },

            paymentStatus: "Completed",
          },
        },

        {
          $group: {
            _id: "$clientFeeRef",

            totalPaid: {
              $sum: "$amountPaid",
            },
          },
        },
      ]);
    }

    const paidMap = new Map(
      paidByFee.map((item) => [String(item._id), Number(item.totalPaid || 0)]),
    );

    let totalPaidAgainstFees = 0;
    let totalOutstanding = 0;

    for (const fee of activeFees) {
      const paidAmount = paidMap.get(String(fee._id)) || 0;

      totalPaidAgainstFees += paidAmount;

      totalOutstanding += Math.max(
        Number(fee.expectedAmount || 0) - paidAmount,
        0,
      );
    }

    // =================================================
    // CURRENT MONTH PAYMENTS
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
    // ACTIVE STAFF FOR RANKING
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

    // Rank primarily by collected amount.
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
    // RECENT PAYMENTS
    // =================================================

    const recentPayments = await Payment.find({
      paymentStatus: "Completed",
    })
      .sort({
        createdAt: -1,
      })
      .limit(8)
      .select(
        "clientId paymentName amountPaid paymentMethod paymentDate creditedStaff creditedStaffName collectedByName stageAtPayment createdAt",
      )
      .lean();

    return res.status(200).json({
      success: true,

      selectedMonth,

      overview: {
        totalClients,
        totalStaff,
        activeStaff,

        totalExpected: totalExpected,

        totalPaid: totalPaidAgainstFees,

        totalOutstanding,

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
