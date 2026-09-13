const mongoose = require("mongoose");

const Client = require("../model/clientSchema");

const ClientStageHistory = require("../model/clientStageHistorySchema");

const { CLIENT_STAGES } = require("../constants/clientStages");

// =================================================
// HELPERS
// =================================================

const normalizeClientId = (clientId) => {
  if (!clientId) {
    return "";
  }

  return decodeURIComponent(String(clientId)).trim();
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

// =================================================
// GET CLIENT STAGE HISTORY
//
// GET
// /api/client-stages/J-176587355
// =================================================

exports.getClientStages = async (req, res) => {
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
        message: "You are not authorized to access this client's progress.",
      });
    }

    const history = await ClientStageHistory.find({
      clientRef: client._id,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,

      currentStage: client.currentStage || "Registration Pending",

      count: history.length,

      data: history,
    });
  } catch (error) {
    console.error("GET CLIENT STAGES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get client progress.",
    });
  }
};

// =================================================
// CHANGE CLIENT STAGE
//
// POST
// /api/client-stages/J-176587355
//
// BODY:
// {
//   "stage": "Interview Fixed / Preparation",
//   "note": "Interview scheduled for Monday."
// }
// =================================================

exports.changeClientStage = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const clientId = normalizeClientId(req.params.clientId);

    const stage = String(req.body.stage || "").trim();

    const note = String(req.body.note || "").trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required.",
      });
    }

    if (!stage) {
      return res.status(400).json({
        success: false,
        message: "Stage is required.",
      });
    }

    if (!CLIENT_STAGES.includes(stage)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client stage.",
      });
    }

    if (note.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Note cannot exceed 2000 characters.",
      });
    }

    session.startTransaction();

    const client = await Client.findOne({
      clientId,
    }).session(session);

    if (!client) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    if (!canAccessClient(req, client)) {
      await session.abortTransaction();

      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this client's progress.",
      });
    }

    const previousStage = client.currentStage || "Registration Pending";

    if (previousStage === stage) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Client is already at this stage.",
      });
    }

    // =================================================
    // UPDATE CURRENT STAGE
    // =================================================

    client.currentStage = stage;

    await client.save({
      session,
    });

    // =================================================
    // CREATE IMMUTABLE HISTORY
    // =================================================

    const [history] = await ClientStageHistory.create(
      [
        {
          clientRef: client._id,

          clientId: client.clientId,

          fromStage: previousStage,

          toStage: stage,

          note,

          changedBy: req.user.id,

          changedByRole: req.user.role,

          staffId: req.user.role === "staff" ? req.user.staffId : null,

          changedByName: req.user.name,
        },
      ],
      {
        session,
      },
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,

      message: "Client stage updated successfully.",

      currentStage: client.currentStage,

      data: history,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("CHANGE CLIENT STAGE ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update client stage.",
    });
  } finally {
    await session.endSession();
  }
};
