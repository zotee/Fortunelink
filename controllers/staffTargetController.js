const mongoose = require("mongoose");

const Staff = require("../model/staffSchema");

const StaffTarget = require("../model/staffTargetSchema");

const Payment = require("../model/paymentSchema");

// =================================================
// HELPERS
// =================================================

const normalizeStaffId = (value) => {
  return String(value || "").trim();
};

// =================================================
// JAPAN CURRENT MONTH
// =================================================

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

// =================================================
// VALIDATE YYYY-MM
// =================================================

const isValidTargetMonth = (value) => {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }

  const month = Number(value.split("-")[1]);

  return month >= 1 && month <= 12;
};

// =================================================
// MONTH RANGE IN JAPAN TIME
//
// Start inclusive
// End exclusive
// =================================================

const getJapanMonthRange = (targetMonth) => {
  const [yearString, monthString] = targetMonth.split("-");

  const year = Number(yearString);

  const month = Number(monthString);

  const nextYear = month === 12 ? year + 1 : year;

  const nextMonth = month === 12 ? 1 : month + 1;

  const paddedNextMonth = String(nextMonth).padStart(2, "0");

  const start = new Date(`${targetMonth}-01T00:00:00+09:00`);

  const end = new Date(`${nextYear}-${paddedNextMonth}-01T00:00:00+09:00`);

  return {
    start,
    end,
  };
};

// =================================================
// PERFORMANCE CALCULATION
// =================================================

const getStaffPerformance = async (staffId, targetMonth) => {
  const { start, end } = getJapanMonthRange(targetMonth);

  const result = await Payment.aggregate([
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

  return {
    totalCollected: result[0]?.totalCollected ?? 0,

    paymentCount: result[0]?.paymentCount ?? 0,

    clientCount: result[0]?.clientIds?.length ?? 0,
  };
};

// =================================================
// CREATE TARGET
//
// POST /api/staff-targets
//
// SUPERADMIN ONLY
// =================================================

exports.createStaffTarget = async (req, res) => {
  try {
    const staffId = normalizeStaffId(req.body.staffId);

    const targetMonth = String(req.body.targetMonth || "").trim();

    const targetAmount = Number(req.body.targetAmount);

    const note = String(req.body.note || "").trim();

    // =============================================
    // VALIDATION
    // =============================================

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required.",
      });
    }

    if (!isValidTargetMonth(targetMonth)) {
      return res.status(400).json({
        success: false,
        message: "Target month must be in YYYY-MM format.",
      });
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Target amount must be greater than 0.",
      });
    }

    if (note.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Note cannot exceed 2000 characters.",
      });
    }

    // =============================================
    // STAFF
    // =============================================

    const staff = await Staff.findOne({
      staffId,
    }).lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    if (staff.isActive !== true) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign a target to an inactive staff member.",
      });
    }

    // =============================================
    // DUPLICATE
    // =============================================

    const existing = await StaffTarget.findOne({
      staffId,
      targetMonth,
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A target already exists for this staff member and month.",
      });
    }

    // =============================================
    // CREATE
    // =============================================

    const target = await StaffTarget.create({
      staffRef: staff._id,

      staffId: staff.staffId,

      staffName: staff.name,

      targetMonth,

      targetAmount,

      note,

      assignedBy: req.user.id,

      assignedByName: req.user.name,
    });

    return res.status(201).json({
      success: true,

      message: "Staff target created successfully.",

      data: target,
    });
  } catch (error) {
    console.error("CREATE STAFF TARGET ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A target already exists for this staff member and month.",
      });
    }

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to create staff target.",
    });
  }
};

// =================================================
// GET STAFF PERFORMANCE
//
// GET
// /api/staff-targets/staff/W-122290?month=2026-09
//
// ADMIN:
// Any staff
//
// STAFF:
// Only themselves
// =================================================

exports.getStaffTarget = async (req, res) => {
  try {
    const staffId = normalizeStaffId(req.params.staffId);

    const targetMonth = String(
      req.query.month || getCurrentJapanMonth(),
    ).trim();

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required.",
      });
    }

    if (!isValidTargetMonth(targetMonth)) {
      return res.status(400).json({
        success: false,
        message: "Month must be in YYYY-MM format.",
      });
    }

    // =============================================
    // STAFF ACCESS
    // =============================================

    if (req.user.role === "staff" && req.user.staffId !== staffId) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view another staff member's target.",
      });
    }

    const staff = await Staff.findOne({
      staffId,
    })
      .select("_id staffId name email isActive")
      .lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    // =============================================
    // TARGET
    // =============================================

    const target = await StaffTarget.findOne({
      staffId,
      targetMonth,
    }).lean();

    // =============================================
    // ACTUAL COLLECTION
    // =============================================

    const performance = await getStaffPerformance(staffId, targetMonth);

    const targetAmount = Number(target?.targetAmount || 0);

    const totalCollected = performance.totalCollected;

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

    return res.status(200).json({
      success: true,

      staff: {
        staffId: staff.staffId,

        name: staff.name,

        email: staff.email,

        isActive: staff.isActive,
      },

      targetMonth,

      target: target || null,

      performance: {
        targetAmount,

        totalCollected,

        remainingAmount,

        achievementPercentage,

        paymentCount: performance.paymentCount,

        clientCount: performance.clientCount,

        status: performanceStatus,
      },
    });
  } catch (error) {
    console.error("GET STAFF TARGET ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get staff target.",
    });
  }
};

// =================================================
// UPDATE TARGET
//
// PATCH /api/staff-targets/:targetId
//
// SUPERADMIN ONLY
// =================================================

exports.updateStaffTarget = async (req, res) => {
  try {
    const { targetId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target ID.",
      });
    }

    const target = await StaffTarget.findById(targetId);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Staff target not found.",
      });
    }

    if (req.body.targetAmount !== undefined) {
      const targetAmount = Number(req.body.targetAmount);

      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Target amount must be greater than 0.",
        });
      }

      target.targetAmount = targetAmount;
    }

    if (req.body.note !== undefined) {
      const note = String(req.body.note || "").trim();

      if (note.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Note cannot exceed 2000 characters.",
        });
      }

      target.note = note;
    }

    target.updatedBy = req.user.id;

    target.updatedByName = req.user.name;

    await target.save();

    return res.status(200).json({
      success: true,

      message: "Staff target updated successfully.",

      data: target,
    });
  } catch (error) {
    console.error("UPDATE STAFF TARGET ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to update staff target.",
    });
  }
};

// =================================================
// GET STAFF PERFORMANCE HISTORY
//
// GET
// /api/staff-targets/staff/W-122290/history?limit=12
//
// ADMIN:
// Any staff
//
// STAFF:
// Only themselves
// =================================================

exports.getStaffPerformanceHistory = async (req, res) => {
  try {
    const staffId = normalizeStaffId(req.params.staffId);

    const requestedLimit = Number(req.query.limit || 12);

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 60)
        : 12;

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required.",
      });
    }

    // =============================================
    // ACCESS
    // =============================================

    if (req.user.role === "staff" && req.user.staffId !== staffId) {
      return res.status(403).json({
        success: false,

        message:
          "You are not authorized to view another staff member's performance.",
      });
    }

    // =============================================
    // STAFF
    // =============================================

    const staff = await Staff.findOne({
      staffId,
    })
      .select("_id staffId name email isActive")
      .lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    // =============================================
    // TARGETS
    // =============================================

    const targets = await StaffTarget.find({
      staffId,
    })
      .sort({
        targetMonth: -1,
      })
      .lean();

    // =============================================
    // PAYMENTS GROUPED BY JAPAN MONTH
    // =============================================

    const paymentHistory = await Payment.aggregate([
      {
        $match: {
          creditedStaff: staffId,

          paymentStatus: "Completed",
        },
      },

      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",

              date: "$paymentDate",

              timezone: "Asia/Tokyo",
            },
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

      {
        $sort: {
          _id: -1,
        },
      },
    ]);

    // =============================================
    // MAP TARGETS
    // =============================================

    const targetMap = new Map(
      targets.map((target) => [target.targetMonth, target]),
    );

    // =============================================
    // MAP PAYMENTS
    // =============================================

    const paymentMap = new Map(
      paymentHistory.map((item) => [
        item._id,
        {
          totalCollected: Number(item.totalCollected || 0),

          paymentCount: Number(item.paymentCount || 0),

          clientCount: item.clientIds?.length || 0,
        },
      ]),
    );

    // =============================================
    // UNION OF ALL MONTHS
    // =============================================

    const months = Array.from(
      new Set([
        ...targets.map((target) => target.targetMonth),

        ...paymentHistory.map((item) => item._id),
      ]),
    ).sort((a, b) => b.localeCompare(a));

    // =============================================
    // BUILD HISTORY
    // =============================================

    const history = months
      .map((month) => {
        const target = targetMap.get(month);

        const payment = paymentMap.get(month);

        const targetAmount = Number(target?.targetAmount || 0);

        const totalCollected = Number(payment?.totalCollected || 0);

        const remainingAmount = Math.max(targetAmount - totalCollected, 0);

        const achievementPercentage =
          targetAmount > 0
            ? Number(((totalCollected / targetAmount) * 100).toFixed(2))
            : 0;

        let status = "No Target";

        if (targetAmount > 0) {
          if (totalCollected >= targetAmount) {
            status = "Achieved";
          } else if (totalCollected > 0) {
            status = "In Progress";
          } else {
            status = "Not Started";
          }
        }

        return {
          month,

          targetId: target?._id || null,

          targetAmount,

          totalCollected,

          remainingAmount,

          achievementPercentage,

          paymentCount: payment?.paymentCount || 0,

          clientCount: payment?.clientCount || 0,

          status,

          note: target?.note || "",

          assignedByName: target?.assignedByName || null,
        };
      })
      .slice(0, limit);

    return res.status(200).json({
      success: true,

      staff: {
        staffId: staff.staffId,

        name: staff.name,

        email: staff.email,

        isActive: staff.isActive,
      },

      count: history.length,

      data: history,
    });
  } catch (error) {
    console.error("GET STAFF PERFORMANCE HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get staff performance history.",
    });
  }
};
