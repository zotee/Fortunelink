const Client = require("../model/clientSchema");
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

const normalizePayment = (payment) => {
  const stageName =
    payment.stageName ||
    payment.paymentName ||
    payment.stageAtPayment ||
    "Legacy Payment";

  const stageAmount =
    Number(payment.stageAmount) > 0
      ? Number(payment.stageAmount)
      : Number(payment.expectedAmount ?? payment.amountPaid ?? 0);

  return {
    ...payment,
    stageKey: payment.stageKey || "",
    stageName,
    stageAmount,
  };
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
      .populate(
        "stageHistoryRef",
        "fromStage fromStageName toStage toStageName toStageAmount createdAt",
      )
      .sort({
        paymentDate: -1,
        createdAt: -1,
      })
      .lean();

    const normalizedPayments = payments.map(normalizePayment);

    const completedPayments = normalizedPayments.filter(
      (payment) => payment.paymentStatus === "Completed",
    );

    const totalCollected = completedPayments.reduce(
      (total, payment) => total + Number(payment.amountPaid || 0),
      0,
    );

    const cancelledCount = normalizedPayments.filter(
      (payment) => payment.paymentStatus === "Cancelled",
    ).length;

    const refundedCount = normalizedPayments.filter(
      (payment) => payment.paymentStatus === "Refunded",
    ).length;

    return res.status(200).json({
      success: true,
      count: normalizedPayments.length,
      summary: {
        totalCollected,
        completedCount: completedPayments.length,
        cancelledCount,
        refundedCount,
      },
      data: normalizedPayments,
    });
  } catch (error) {
    console.error("GET CLIENT PAYMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get client payments.",
    });
  }
};
