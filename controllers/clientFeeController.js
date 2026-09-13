const mongoose = require("mongoose");

const Client = require("../model/clientSchema");
const ClientFee = require("../model/clientFeeSchema");
const Payment = require("../model/paymentSchema");
// =================================================
// HELPERS
// =================================================

const normalizeClientId = (value) => {
  if (!value) {
    return "";
  }

  return decodeURIComponent(String(value)).trim();
};

const canAccessClient = (req, client) => {
  if (req.user.role === "superadmin") {
    return true;
  }

  if (req.user.role === "staff") {
    return client.assignedStaff === req.user.staffId;
  }

  return false;
};

const parseDueDate = (value) => {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00+09:00`);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

// =================================================
// CREATE FEE REQUIREMENT
//
// POST /api/client-fees
//
// SUPERADMIN ONLY
// =================================================

exports.createClientFee = async (req, res) => {
  try {
    const clientId = normalizeClientId(req.body.clientId);

    const feeName = String(req.body.feeName || "").trim();

    const expectedAmount = Number(req.body.expectedAmount);

    const dueDate = parseDueDate(req.body.dueDate);

    const note = String(req.body.note || "").trim();

    // =================================================
    // VALIDATION
    // =================================================

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }

    if (!feeName) {
      return res.status(400).json({
        success: false,
        message: "Fee name is required.",
      });
    }

    if (feeName.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Fee name cannot exceed 150 characters.",
      });
    }

    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Expected amount must be greater than 0.",
      });
    }

    if (req.body.dueDate && !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date.",
      });
    }

    if (note.length > 3000) {
      return res.status(400).json({
        success: false,
        message: "Note cannot exceed 3000 characters.",
      });
    }

    // =================================================
    // CLIENT
    // =================================================

    const client = await Client.findOne({
      clientId,
    }).lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    // =================================================
    // CHECK DUPLICATE ACTIVE FEE
    // =================================================

    const existingFee = await ClientFee.findOne({
      clientRef: client._id,

      feeName: {
        $regex: new RegExp(
          `^${feeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      },

      status: "Active",
    }).lean();

    if (existingFee) {
      return res.status(409).json({
        success: false,
        message: "An active fee with this name already exists for this client.",
      });
    }

    // =================================================
    // CREATE
    // =================================================

    const fee = await ClientFee.create({
      clientRef: client._id,

      clientId: client.clientId,

      feeName,

      expectedAmount,

      dueDate,

      note,

      status: "Active",

      createdBy: req.user.id,

      createdByRole: req.user.role,

      createdByName: req.user.name,
    });

    return res.status(201).json({
      success: true,

      message: "Client fee requirement created successfully.",

      data: fee,
    });
  } catch (error) {
    console.error("CREATE CLIENT FEE ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to create client fee requirement.",
    });
  }
};

// =================================================
// GET CLIENT FEES
//
// GET /api/client-fees/client/:clientId
//
// SUPERADMIN + ASSIGNED STAFF
// =================================================

exports.getClientFees = async (req, res) => {
  try {
    const clientId = normalizeClientId(req.params.clientId);

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }

    const client = await Client.findOne({
      clientId,
    }).lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to view this client's fees.",
      });
    }

    // =================================================
    // FEES
    // =================================================

    const fees = await ClientFee.find({
      clientRef: client._id,
    })
      .sort({
        status: 1,
        createdAt: -1,
      })
      .lean();

    const feeIds = fees.map((fee) => fee._id);

    // =================================================
    // PAYMENT TOTALS GROUPED BY FEE
    // =================================================

    let paidByFee = [];

    if (feeIds.length > 0) {
      paidByFee = await Payment.aggregate([
        {
          $match: {
            clientRef: client._id,

            clientFeeRef: {
              $in: feeIds,
            },

            paymentStatus: "Completed",
          },
        },

        {
          $group: {
            _id: "$clientFeeRef",

            paidAmount: {
              $sum: "$amountPaid",
            },
          },
        },
      ]);
    }

    const paidMap = new Map(
      paidByFee.map((item) => [String(item._id), Number(item.paidAmount || 0)]),
    );

    // =================================================
    // ENRICH FEES
    // =================================================

    const enrichedFees = fees.map((fee) => {
      const paidAmount = paidMap.get(String(fee._id)) || 0;

      const outstandingAmount =
        fee.status === "Cancelled"
          ? 0
          : Math.max(Number(fee.expectedAmount) - paidAmount, 0);

      let paymentProgressStatus;

      if (fee.status === "Cancelled") {
        paymentProgressStatus = "Cancelled";
      } else if (paidAmount <= 0) {
        paymentProgressStatus = "Unpaid";
      } else if (paidAmount < fee.expectedAmount) {
        paymentProgressStatus = "Partial";
      } else {
        paymentProgressStatus = "Paid";
      }

      return {
        ...fee,

        paidAmount,

        outstandingAmount,

        paymentProgressStatus,
      };
    });

    // =================================================
    // SUMMARY
    // =================================================

    const activeFees = enrichedFees.filter((fee) => fee.status === "Active");

    const totalExpected = activeFees.reduce(
      (total, fee) => total + Number(fee.expectedAmount || 0),
      0,
    );

    const totalPaid = activeFees.reduce(
      (total, fee) => total + Number(fee.paidAmount || 0),
      0,
    );

    const totalOutstanding = activeFees.reduce(
      (total, fee) => total + Number(fee.outstandingAmount || 0),
      0,
    );

    return res.status(200).json({
      success: true,

      count: enrichedFees.length,

      summary: {
        totalExpected,
        totalPaid,
        totalOutstanding,
      },

      data: enrichedFees,
    });
  } catch (error) {
    console.error("GET CLIENT FEES ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get client fees.",
    });
  }
};

// =================================================
// UPDATE FEE
//
// PATCH /api/client-fees/:feeId
//
// SUPERADMIN ONLY
// =================================================

exports.updateClientFee = async (req, res) => {
  try {
    const { feeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(feeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fee ID.",
      });
    }

    const fee = await ClientFee.findById(feeId);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: "Fee requirement not found.",
      });
    }

    if (fee.status === "Cancelled") {
      return res.status(400).json({
        success: false,

        message: "A cancelled fee cannot be edited.",
      });
    }

    // =================================================
    // FEE NAME
    // =================================================

    if (req.body.feeName !== undefined) {
      const feeName = String(req.body.feeName).trim();

      if (!feeName) {
        return res.status(400).json({
          success: false,
          message: "Fee name cannot be empty.",
        });
      }

      if (feeName.length > 150) {
        return res.status(400).json({
          success: false,

          message: "Fee name cannot exceed 150 characters.",
        });
      }

      fee.feeName = feeName;
    }

    // =================================================
    // EXPECTED AMOUNT
    // =================================================

    if (req.body.expectedAmount !== undefined) {
      const expectedAmount = Number(req.body.expectedAmount);

      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        return res.status(400).json({
          success: false,

          message: "Expected amount must be greater than 0.",
        });
      }

      // ===============================================
      // DO NOT ALLOW EXPECTED BELOW ALREADY PAID
      // ===============================================

      const paymentSummary = await Payment.aggregate([
        {
          $match: {
            clientFeeRef: fee._id,

            paymentStatus: "Completed",
          },
        },

        {
          $group: {
            _id: null,

            totalPaid: {
              $sum: "$amountPaid",
            },
          },
        },
      ]);

      const alreadyPaid = paymentSummary[0]?.totalPaid ?? 0;

      if (expectedAmount < alreadyPaid) {
        return res.status(400).json({
          success: false,

          message: `Expected amount cannot be less than the already paid amount of ${alreadyPaid}.`,
        });
      }

      fee.expectedAmount = expectedAmount;
    }

    // =================================================
    // DUE DATE
    // =================================================

    if (req.body.dueDate !== undefined) {
      if (!req.body.dueDate) {
        fee.dueDate = null;
      } else {
        const dueDate = parseDueDate(req.body.dueDate);

        if (!dueDate) {
          return res.status(400).json({
            success: false,
            message: "Invalid due date.",
          });
        }

        fee.dueDate = dueDate;
      }
    }

    // =================================================
    // NOTE
    // =================================================

    if (req.body.note !== undefined) {
      const note = String(req.body.note || "").trim();

      if (note.length > 3000) {
        return res.status(400).json({
          success: false,

          message: "Note cannot exceed 3000 characters.",
        });
      }

      fee.note = note;
    }

    await fee.save();

    return res.status(200).json({
      success: true,

      message: "Client fee requirement updated successfully.",

      data: fee,
    });
  } catch (error) {
    console.error("UPDATE CLIENT FEE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to update client fee requirement.",
    });
  }
};

// =================================================
// CANCEL FEE
//
// PATCH /api/client-fees/:feeId/cancel
//
// SUPERADMIN ONLY
// =================================================

exports.cancelClientFee = async (req, res) => {
  try {
    const { feeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(feeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fee ID.",
      });
    }

    const fee = await ClientFee.findById(feeId);

    if (!fee) {
      return res.status(404).json({
        success: false,

        message: "Fee requirement not found.",
      });
    }

    if (fee.status === "Cancelled") {
      return res.status(400).json({
        success: false,

        message: "Fee is already cancelled.",
      });
    }

    fee.status = "Cancelled";

    fee.cancelledAt = new Date();

    fee.cancelledBy = req.user.id;

    fee.cancelledByName = req.user.name;

    await fee.save();

    return res.status(200).json({
      success: true,

      message: "Client fee requirement cancelled successfully.",

      data: fee,
    });
  } catch (error) {
    console.error("CANCEL CLIENT FEE ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to cancel client fee requirement.",
    });
  }
};
