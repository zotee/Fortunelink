const mongoose = require("mongoose");
const Client = require("../model/clientSchema");
const ClientStageHistory = require("../model/clientStageHistorySchema");
const {
  findActiveClientStage,
  findClientStage,
} = require("../services/clientStageService");
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
// GET CLIENT STAGE HISTORY
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
      .sort({
        createdAt: -1,
      })
      .lean();
    const currentStage = await findClientStage(client.currentStage);
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
// POST /api/client-stages/:clientId
// BODY:
// {
//   "stage":"visaApproved",
//   "note":"Visa approved"
// }
// =================================================
exports.updateClientStage = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();
    const stageKey = String(req.body.stage || "").trim();
    const note = String(req.body.note || "").trim();
    if (!stageKey) {
      return res.status(400).json({
        success: false,
        message: "stage is required.",
      });
    }
    const selectedStage = await findActiveClientStage(stageKey);
    if (!selectedStage) {
      return res.status(400).json({
        success: false,
        message: "The selected stage does not exist or is inactive.",
      });
    }
    let responseData = null;
    await session.withTransaction(async () => {
      const client = await Client.findOne({
        clientId,
      }).session(session);
      if (!client) {
        const error = new Error("Client not found.");
        error.statusCode = 404;
        throw error;
      }
      if (!canAccessClient(req, client)) {
        const error = new Error(
          "You are not authorized to update this client.",
        );
        error.statusCode = 403;
        throw error;
      }
      if (client.currentStage === selectedStage.key) {
        const error = new Error("The client is already in this stage.");
        error.statusCode = 400;
        throw error;
      }
      const previousStage = await findClientStage(client.currentStage);
      const fromStage = client.currentStage || null;
      const fromStageName =
        previousStage?.name ||
        client.clientStatus ||
        client.currentStage ||
        null;
      client.currentStage = selectedStage.key;
      client.clientStatus = selectedStage.name;
      await client.save({
        session,
      });
      const historyDocuments = await ClientStageHistory.create(
        [
          {
            clientRef: client._id,
            clientId: client.clientId,
            fromStage,
            fromStageName,
            toStage: selectedStage.key,
            toStageName: selectedStage.name,
            toStageAmount: selectedStage.amount || 0,
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
      responseData = {
        client: client.toObject(),
        stage: selectedStage,
        history: historyDocuments[0],
      };
    });
    return res.status(200).json({
      success: true,
      message: "Client stage updated successfully.",
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
