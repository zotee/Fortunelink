const ClientStage = require("../model/clientStageSchema");
// =================================================
// KEY GENERATOR
// =================================================
const createStageKey = (name) => {
  const words = String(name || "")
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return "";
  }
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
};
// =================================================
// AMOUNT
// =================================================
const parseAmount = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
    return null;
  }
  return amount;
};
// =================================================
// GET STAGES
// GET /api/stages
// GET /api/stages?includeInactive=true
// =================================================
exports.getStages = async (req, res) => {
  try {
    const filter = {};
    const includeInactive =
      req.user.role === "superadmin" &&
      String(req.query.includeInactive || "").toLowerCase() === "true";
    if (!includeInactive) {
      filter.isActive = true;
    }
    const stages = await ClientStage.find(filter)
      .sort({
        displayOrder: 1,
        createdAt: 1,
      })
      .lean();
    return res.status(200).json({
      success: true,
      count: stages.length,
      data: stages,
    });
  } catch (error) {
    console.error("GET STAGES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get stages.",
    });
  }
};
// =================================================
// CREATE STAGE
// SUPERADMIN ONLY
// POST /api/stages
// BODY:
// {
//   "name":"Document Collection",
//   "key":"documentCollection", optional
//   "amount":50000,
//   "displayOrder":18
// }
// =================================================
exports.createStage = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Stage name is required.",
      });
    }
    const key = String(req.body.key || createStageKey(name)).trim();
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "A valid stage key is required.",
      });
    }
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) {
      return res.status(400).json({
        success: false,
        message: "Stage key must use camelCase letters and numbers only.",
      });
    }
    const amount = parseAmount(req.body.amount);
    if (amount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Stage amount must be a whole number greater than or equal to 0.",
      });
    }
    const duplicate = await ClientStage.findOne({
      $or: [
        { key },
        {
          name: {
            $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
          },
        },
      ],
    }).lean();
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "A stage with the same key or name already exists.",
      });
    }
    const lastStage = await ClientStage.findOne({})
      .sort({
        displayOrder: -1,
      })
      .lean();
    const requestedOrder = Number(req.body.displayOrder);
    const displayOrder =
      Number.isInteger(requestedOrder) && requestedOrder > 0
        ? requestedOrder
        : (lastStage?.displayOrder || 0) + 1;
    const stage = await ClientStage.create({
      key,
      name,
      amount,
      displayOrder,
      isActive: true,
      isSystem: false,
      createdById: String(req.user.id || ""),
      createdByName: req.user.name || null,
    });
    return res.status(201).json({
      success: true,
      message: "Stage created successfully.",
      data: stage,
    });
  } catch (error) {
    console.error("CREATE STAGE ERROR:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Stage key already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create stage.",
    });
  }
};
// =================================================
// UPDATE STAGE
// Key stays immutable.
// PATCH /api/stages/:stageId
// =================================================
exports.updateStage = async (req, res) => {
  try {
    const stage = await ClientStage.findById(req.params.stageId);
    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found.",
      });
    }
    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Stage name cannot be empty.",
        });
      }
      stage.name = name;
    }
    if (req.body.amount !== undefined) {
      const amount = parseAmount(req.body.amount);
      if (amount === null) {
        return res.status(400).json({
          success: false,
          message:
            "Stage amount must be a whole number greater than or equal to 0.",
        });
      }
      stage.amount = amount;
    }
    if (req.body.displayOrder !== undefined) {
      const displayOrder = Number(req.body.displayOrder);
      if (!Number.isInteger(displayOrder) || displayOrder < 1) {
        return res.status(400).json({
          success: false,
          message: "displayOrder must be a positive whole number.",
        });
      }
      stage.displayOrder = displayOrder;
    }
    stage.updatedById = String(req.user.id || "");
    stage.updatedByName = req.user.name || null;
    await stage.save();
    return res.status(200).json({
      success: true,
      message: "Stage updated successfully.",
      data: stage,
    });
  } catch (error) {
    console.error("UPDATE STAGE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update stage.",
    });
  }
};
// =================================================
// ACTIVATE / DEACTIVATE STAGE
// PATCH /api/stages/:stageId/status
// BODY: { "isActive": false }
// =================================================
exports.updateStageStatus = async (req, res) => {
  try {
    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }
    const stage = await ClientStage.findById(req.params.stageId);
    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found.",
      });
    }
    if (stage.key === "registeredPaid" && req.body.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "The default Registered / Paid stage cannot be disabled.",
      });
    }
    stage.isActive = req.body.isActive;
    stage.updatedById = String(req.user.id || "");
    stage.updatedByName = req.user.name || null;
    await stage.save();
    return res.status(200).json({
      success: true,
      message: stage.isActive
        ? "Stage activated successfully."
        : "Stage deactivated successfully.",
      data: stage,
    });
  } catch (error) {
    console.error("UPDATE STAGE STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update stage status.",
    });
  }
};
