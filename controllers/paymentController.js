const Client = require("../model/clientSchema");
const Staff = require("../model/staffSchema");
const Payment = require("../model/paymentSchema");

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

  // YYYY-MM-DD treated as Japan date
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00+09:00`);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

// =================================================
// CREATE PAYMENT
//
// POST /api/payments
// =================================================

exports.createPayment = async (req, res) => {
  try {
    const clientId = normalizeClientId(req.body.clientId);

    const paymentName = String(req.body.paymentName || "").trim();

    const expectedAmount = Number(req.body.expectedAmount);

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

    if (!paymentName) {
      return res.status(400).json({
        success: false,
        message: "Payment name is required.",
      });
    }

    if (!Number.isFinite(expectedAmount) || expectedAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Expected amount must be a valid positive amount.",
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
    // FIND CLIENT
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

    // =================================================
    // ACCESS
    // =================================================

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to record a payment for this client.",
      });
    }

    // =================================================
    // CREDIT CURRENT ASSIGNED STAFF
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

      paymentName,

      expectedAmount,

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

    const populatedPayment = await Payment.findById(payment._id)
      .populate("creditedStaffRef", "staffId name email")
      .lean();

    return res.status(201).json({
      success: true,

      message: "Payment recorded successfully.",

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
      .sort({
        paymentDate: -1,
        createdAt: -1,
      })
      .lean();

    // =================================================
    // SUMMARY
    // Only completed payments count here.
    // =================================================

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
