const mongoose = require("mongoose");

const Client = require("../model/clientSchema");
const Staff = require("../model/staffSchema");
const Payment = require("../model/paymentSchema");
const ClientFee = require("../model/clientFeeSchema");

// =================================================
// CONSTANTS
// =================================================

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Online Payment",
  "Cheque",
  "Other",
];

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

const parsePaymentDate = (value) => {
  if (!value) {
    return new Date();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00+09:00`);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

// =================================================
// GET AMOUNT ALREADY PAID FOR FEE
// =================================================

const getFeePaidAmount = async (feeId) => {
  const result = await Payment.aggregate([
    {
      $match: {
        clientFeeRef: new mongoose.Types.ObjectId(feeId),

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

  return result[0]?.totalPaid ?? 0;
};

// =================================================
// CREATE PAYMENT
//
// POST /api/payments
// =================================================

exports.createPayment = async (req, res) => {
  try {
    const clientId = normalizeClientId(req.body.clientId);

    const feeId = String(req.body.feeId || "").trim();

    const amountPaid = Number(req.body.amountPaid);

    const paymentMethod = String(req.body.paymentMethod || "").trim();

    const paymentDate = parsePaymentDate(req.body.paymentDate);

    const referenceNumber = String(req.body.referenceNumber || "").trim();

    const receiptNumber = String(req.body.receiptNumber || "").trim();

    const bankName = String(req.body.bankName || "").trim();

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

    if (!feeId || !mongoose.Types.ObjectId.isValid(feeId)) {
      return res.status(400).json({
        success: false,
        message: "A valid fee is required.",
      });
    }

    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount paid must be greater than 0.",
      });
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date.",
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
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to record a payment for this client.",
      });
    }

    // =================================================
    // FEE
    // =================================================

    const fee = await ClientFee.findOne({
      _id: feeId,

      clientRef: client._id,

      status: "Active",
    });

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: "Active fee requirement not found for this client.",
      });
    }

    // =================================================
    // ALREADY PAID / OUTSTANDING
    // =================================================

    const alreadyPaid = await getFeePaidAmount(fee._id);

    const outstandingAmount = Math.max(fee.expectedAmount - alreadyPaid, 0);

    if (outstandingAmount <= 0) {
      return res.status(400).json({
        success: false,

        message: "This fee has already been fully paid.",
      });
    }

    if (amountPaid > outstandingAmount) {
      return res.status(400).json({
        success: false,

        message: `Payment exceeds the outstanding amount of ${outstandingAmount}.`,
      });
    }

    // =================================================
    // ASSIGNED STAFF
    // =================================================

    const staff = await Staff.findOne({
      staffId: client.assignedStaff,
    })
      .select("_id staffId name")
      .lean();

    if (!staff) {
      return res.status(400).json({
        success: false,
        message: "Assigned staff could not be found.",
      });
    }

    // =================================================
    // CREATE PAYMENT
    // =================================================

    const payment = await Payment.create({
      clientRef: client._id,

      clientId: client.clientId,

      clientFeeRef: fee._id,

      // snapshots
      paymentName: fee.feeName,

      expectedAmount: fee.expectedAmount,

      amountPaid,

      paymentMethod,

      paymentDate,

      paymentStatus: "Completed",

      stageAtPayment: client.currentStage || "Registration Pending",

      collectedBy: req.user.id,

      collectedByRole: req.user.role,

      collectedByName: req.user.name,

      creditedStaffRef: staff._id,

      creditedStaff: staff.staffId,

      creditedStaffName: staff.name,

      referenceNumber,

      receiptNumber,

      bankName,

      note,
    });

    const newTotalPaid = alreadyPaid + amountPaid;

    const newOutstanding = Math.max(fee.expectedAmount - newTotalPaid, 0);

    const populatedPayment = await Payment.findById(payment._id)
      .populate("creditedStaffRef", "staffId name email")
      .populate("clientFeeRef", "feeName expectedAmount status dueDate")
      .lean();

    return res.status(201).json({
      success: true,

      message: "Payment recorded successfully.",

      summary: {
        feeExpected: fee.expectedAmount,

        totalPaid: newTotalPaid,

        outstanding: newOutstanding,

        paymentProgressStatus: newOutstanding === 0 ? "Paid" : "Partial",
      },

      data: populatedPayment,
    });
  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to record payment.",
    });
  }
};

// =================================================
// GET CLIENT PAYMENTS
//
// GET /api/payments/client/:clientId
// =================================================

exports.getClientPayments = async (req, res) => {
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

        message: "You are not authorized to view this client's payments.",
      });
    }

    const payments = await Payment.find({
      clientRef: client._id,
    })
      .populate("creditedStaffRef", "staffId name email")
      .populate("clientFeeRef", "feeName expectedAmount status dueDate")
      .sort({
        paymentDate: -1,
        createdAt: -1,
      })
      .lean();

    const totalPaid = payments
      .filter((payment) => payment.paymentStatus === "Completed")
      .reduce((total, payment) => total + Number(payment.amountPaid || 0), 0);

    return res.status(200).json({
      success: true,

      count: payments.length,

      summary: {
        totalPaid,
      },

      data: payments,
    });
  } catch (error) {
    console.error("GET CLIENT PAYMENTS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get client payments.",
    });
  }
};
