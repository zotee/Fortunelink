const mongoose = require("mongoose");

const Client = require("../model/clientSchema");
const Staff = require("../model/staffSchema");
const Payment = require("../model/paymentSchema");
const ClientStage = require("../model/clientStageSchema");
const ClientStageHistory = require("../model/clientStageHistorySchema");

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
// ACCESS
// =================================================
const canAccessClient = (req, client) => {
  if (req.user.role === "superadmin") {
    return true;
  }

  if (req.user.role === "staff") {
    return client.assignedStaff === req.user.staffId;
  }

  return false;
};

// =================================================
// HTTP ERROR
// =================================================
const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

// =================================================
// PAYMENT DATE
// =================================================
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
// GET CLIENT STAGE HISTORY
//
// GET /api/client-stages/:clientId
// =================================================
exports.getClientStageHistory = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

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
        message: "You are not authorized to access this client.",
      });
    }

    const history = await ClientStageHistory.find({
      clientId,
    })
      .populate(
        "paymentRef",
        [
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
        ].join(" "),
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    const currentStage = await ClientStage.findOne({
      key: client.currentStage,
    }).lean();

    return res.status(200).json({
      success: true,
      data: {
        clientId: client.clientId,
        currentStage: client.currentStage,
        currentStageName:
          currentStage?.name || client.clientStatus || client.currentStage,
        currentStageAmount: currentStage?.amount ?? 0,
        history,
      },
    });
  } catch (error) {
    console.error("GET CLIENT STAGE HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get client stage history.",
    });
  }
};

// =================================================
// CHANGE CLIENT STAGE
//
// POST /api/client-stages/:clientId
//
// FREE STAGE:
// {
//   "stage":"interviewFailed",
//   "note":"Interview unsuccessful"
// }
//
// PAID STAGE:
// {
//   "stage":"visaApproved",
//   "paymentMethod":"Bank Transfer",
//   "paymentDate":"2026-09-21",
//   "referenceNumber":"BANK-001",
//   "receiptNumber":"REC-001",
//   "bankName":"MUFG",
//   "note":"Payment received"
// }
//
// IMPORTANT:
// Frontend NEVER sends amount.
// Backend reads amount from Stage Master.
// =================================================
exports.updateClientStage = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const stageKey = String(req.body.stage || "").trim();
    const note = String(req.body.note || "").trim();

    const paymentMethod = String(req.body.paymentMethod || "").trim();

    const paymentDate = parsePaymentDate(req.body.paymentDate);

    const referenceNumber = String(req.body.referenceNumber || "").trim();

    const receiptNumber = String(req.body.receiptNumber || "").trim();

    const bankName = String(req.body.bankName || "").trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }

    if (!stageKey) {
      return res.status(400).json({
        success: false,
        message: "Stage is required.",
      });
    }

    if (note.length > 3000) {
      return res.status(400).json({
        success: false,
        message: "Note cannot exceed 3000 characters.",
      });
    }

    let responseData = null;

    await session.withTransaction(async () => {
      // =================================================
      // CLIENT
      // =================================================
      const client = await Client.findOne({
        clientId,
      }).session(session);

      if (!client) {
        throw createHttpError("Client not found.", 404);
      }

      if (!canAccessClient(req, client)) {
        throw createHttpError(
          "You are not authorized to update this client.",
          403,
        );
      }

      // =================================================
      // TARGET STAGE
      // =================================================
      const selectedStage = await ClientStage.findOne({
        key: stageKey,
        isActive: true,
      }).session(session);

      if (!selectedStage) {
        throw createHttpError(
          "The selected stage does not exist or is inactive.",
          400,
        );
      }

      if (client.currentStage === selectedStage.key) {
        throw createHttpError("The client is already in this stage.", 400);
      }

      const stageAmount = Number(selectedStage.amount || 0);

      const paymentRequired = stageAmount > 0;

      // =================================================
      // PAID STAGE VALIDATION
      // =================================================
      if (paymentRequired) {
        if (!PAYMENT_METHODS.includes(paymentMethod)) {
          throw createHttpError(
            "A valid payment method is required before entering this stage.",
            400,
          );
        }

        if (!paymentDate) {
          throw createHttpError("A valid payment date is required.", 400);
        }
      }

      // =================================================
      // ASSIGNED STAFF
      // Required because payment revenue is credited to
      // the staff assigned to this client.
      // =================================================
      const staff = paymentRequired
        ? await Staff.findOne({
            staffId: client.assignedStaff,
          })
            .select("_id staffId name")
            .session(session)
        : null;

      if (paymentRequired && !staff) {
        throw createHttpError("Assigned staff could not be found.", 400);
      }

      // =================================================
      // PREVIOUS STAGE
      // =================================================
      const previousStage = client.currentStage
        ? await ClientStage.findOne({
            key: client.currentStage,
          }).session(session)
        : null;

      const fromStage = client.currentStage || null;

      const fromStageName =
        previousStage?.name ||
        client.clientStatus ||
        client.currentStage ||
        null;

      // =================================================
      // CREATE HISTORY FIRST
      // Entire operation is inside one transaction.
      // =================================================
      const historyDocuments = await ClientStageHistory.create(
        [
          {
            clientRef: client._id,
            clientId: client.clientId,

            fromStage,
            fromStageName,

            toStage: selectedStage.key,
            toStageName: selectedStage.name,
            toStageAmount: stageAmount,

            paymentRef: null,

            note,

            changedBy: String(req.user.id || req.user.staffId || ""),

            changedByRole: req.user.role,

            staffId: req.user.role === "staff" ? req.user.staffId : null,

            changedByName: req.user.name || "Unknown",
          },
        ],
        {
          session,
        },
      );

      const history = historyDocuments[0];

      // =================================================
      // FULL PAYMENT
      //
      // No amount is accepted from frontend.
      // stageAmount === amountPaid
      // =================================================
      let payment = null;

      if (paymentRequired) {
        const paymentDocuments = await Payment.create(
          [
            {
              clientRef: client._id,
              clientId: client.clientId,

              stageHistoryRef: history._id,

              stageKey: selectedStage.key,

              stageName: selectedStage.name,

              stageAmount,

              amountPaid: stageAmount,

              paymentMethod,

              paymentDate,

              paymentStatus: "Completed",

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
            },
          ],
          {
            session,
          },
        );

        payment = paymentDocuments[0];

        history.paymentRef = payment._id;

        await history.save({
          session,
        });
      }

      // =================================================
      // ONLY AFTER PAYMENT SUCCEEDS:
      // UPDATE CLIENT CURRENT STAGE
      // =================================================
      client.currentStage = selectedStage.key;

      client.clientStatus = selectedStage.name;

      await client.save({
        session,
      });

      responseData = {
        client: client.toObject(),

        stage: selectedStage.toObject(),

        history: history.toObject(),

        payment: payment ? payment.toObject() : null,

        paymentRequired,

        amountPaid: paymentRequired ? stageAmount : 0,
      };
    });

    return res.status(200).json({
      success: true,

      message: responseData?.paymentRequired
        ? "Payment recorded and client stage updated successfully."
        : "Client stage updated successfully.",

      data: responseData,
    });
  } catch (error) {
    console.error("UPDATE CLIENT STAGE ERROR:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update client stage.",
    });
  } finally {
    await session.endSession();
  }
};
