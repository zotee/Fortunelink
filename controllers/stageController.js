const ClientStage = require("../model/clientStageSchema");
const Client = require("../model/clientSchema");

// =================================================
// HELPERS
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

      return (
        lower.charAt(0).toUpperCase() +
        lower.slice(1)
      );
    })
    .join("");
};

const normalizeStageId = (stageId) => {
  return String(stageId || "")
    .trim()
    .toUpperCase();
};

const parseAmount = (value) => {
  const amount = Number(value ?? 0);

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isInteger(amount)
  ) {
    return null;
  }

  return amount;
};

const parseDisplayOrder = (value) => {
  const displayOrder = Number(value);

  if (
    !Number.isInteger(displayOrder) ||
    displayOrder < 1
  ) {
    return null;
  }

  return displayOrder;
};

const escapeRegex = (value) => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
};

const getActorId = (req) => {
  return String(
    req.user.staffId ||
      req.user.adminId ||
      req.user.userId ||
      req.user.id ||
      "",
  );
};

// =================================================
// GET STAGES
//
// GET /api/stages
// GET /api/stages?includeInactive=true
// =================================================

exports.getStages = async (req, res) => {
  try {
    const filter = {};

    const includeInactive =
      req.user.role === "superadmin" &&
      String(
        req.query.includeInactive || "",
      ).toLowerCase() === "true";

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
      message:
        error.message || "Failed to get stages.",
    });
  }
};

// =================================================
// GET ONE STAGE
//
// GET /api/stages/:stageId
// =================================================

exports.getStageById = async (req, res) => {
  try {
    const stageId = normalizeStageId(
      req.params.stageId,
    );

    if (!stageId) {
      return res.status(400).json({
        success: false,
        message: "Stage ID is required.",
      });
    }

    const stage = await ClientStage.findOne({
      stageId,
    }).lean();

    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: stage,
    });
  } catch (error) {
    console.error("GET STAGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to get stage.",
    });
  }
};

// =================================================
// CREATE STAGE
//
// POST /api/stages
// SUPERADMIN ONLY
//
// BODY:
// {
//   "name": "Document Collection",
//   "amount": 40000,
//   "displayOrder": 1
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

    const key = createStageKey(name);

    if (!key) {
      return res.status(400).json({
        success: false,
        message:
          "A valid stage name is required to generate the stage key.",
      });
    }

    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) {
      return res.status(400).json({
        success: false,
        message:
          "The generated stage key is invalid.",
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

    let displayOrder;

    if (
      req.body.displayOrder !== undefined &&
      req.body.displayOrder !== null &&
      req.body.displayOrder !== ""
    ) {
      displayOrder = parseDisplayOrder(
        req.body.displayOrder,
      );

      if (displayOrder === null) {
        return res.status(400).json({
          success: false,
          message:
            "displayOrder must be a positive whole number.",
        });
      }
    } else {
      const lastStage = await ClientStage.findOne({})
        .sort({
          displayOrder: -1,
        })
        .lean();

      displayOrder =
        (lastStage?.displayOrder || 0) + 1;
    }

    const duplicateStage =
      await ClientStage.findOne({
        $or: [
          {
            key,
          },
          {
            name: {
              $regex: `^${escapeRegex(name)}$`,
              $options: "i",
            },
          },
        ],
      }).lean();

    if (duplicateStage) {
      return res.status(409).json({
        success: false,
        message:
          "A stage with the same name already exists.",
      });
    }

    const stage = await ClientStage.create({
      key,
      name,
      amount,
      displayOrder,
      isActive: true,
      isSystem: false,
      createdById: getActorId(req),
      createdByName: req.user.name || null,
      updatedById: null,
      updatedByName: null,
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
        message:
          "A stage with the same key or stage ID already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to create stage.",
    });
  }
};

// =================================================
// UPDATE STAGE
//
// PATCH /api/stages/:stageId
// SUPERADMIN ONLY
//
// BODY:
// {
//   "name": "Document Collection Updated",
//   "amount": 50000,
//   "displayOrder": 2
// }
// =================================================

exports.updateStage = async (req, res) => {
  try {
    const stageId = normalizeStageId(
      req.params.stageId,
    );

    if (!stageId) {
      return res.status(400).json({
        success: false,
        message: "Stage ID is required.",
      });
    }

    const stage = await ClientStage.findOne({
      stageId,
    });

    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found.",
      });
    }

    if (req.body.stageId !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Stage ID cannot be changed.",
      });
    }

    if (req.body.key !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Stage key cannot be changed.",
      });
    }

    if (req.body.name !== undefined) {
      const name = String(
        req.body.name || "",
      ).trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Stage name cannot be empty.",
        });
      }

      const duplicateName =
        await ClientStage.findOne({
          stageId: {
            $ne: stage.stageId,
          },
          name: {
            $regex: `^${escapeRegex(name)}$`,
            $options: "i",
          },
        }).lean();

      if (duplicateName) {
        return res.status(409).json({
          success: false,
          message:
            "A stage with the same name already exists.",
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
      const displayOrder = parseDisplayOrder(
        req.body.displayOrder,
      );

      if (displayOrder === null) {
        return res.status(400).json({
          success: false,
          message:
            "displayOrder must be a positive whole number.",
        });
      }

      stage.displayOrder = displayOrder;
    }

    stage.updatedById = getActorId(req);
    stage.updatedByName = req.user.name || null;

    await stage.save();

    return res.status(200).json({
      success: true,
      message: "Stage updated successfully.",
      data: stage,
    });
  } catch (error) {
    console.error("UPDATE STAGE ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A stage with the same value already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to update stage.",
    });
  }
};

// =================================================
// ACTIVATE OR DEACTIVATE STAGE
//
// PATCH /api/stages/:stageId/status
// SUPERADMIN ONLY
//
// BODY:
// {
//   "isActive": false
// }
// =================================================

exports.updateStageStatus = async (req, res) => {
  try {
    const stageId = normalizeStageId(
      req.params.stageId,
    );

    if (!stageId) {
      return res.status(400).json({
        success: false,
        message: "Stage ID is required.",
      });
    }

    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    const stage = await ClientStage.findOne({
      stageId,
    });

    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found.",
      });
    }

    stage.isActive = req.body.isActive;
    stage.updatedById = getActorId(req);
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
    console.error(
      "UPDATE STAGE STATUS ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update stage status.",
    });
  }
};

// =================================================
// DELETE STAGE
//
// DELETE /api/stages/:stageId
// SUPERADMIN ONLY
// =================================================

exports.deleteStage = async (req, res) => {
  try {
    const stageId = normalizeStageId(
      req.params.stageId,
    );

    if (!stageId) {
      return res.status(400).json({
        success: false,
        message: "Stage ID is required.",
      });
    }

    const stage = await ClientStage.findOne({
      stageId,
    });

    if (!stage) {
      return res.status(404).json({
        success: false,
        message: "Stage not found.",
      });
    }

    /*
     * Client.currentStage stores ClientStage.stageId.
     * Prevent deletion if any client currently uses it.
     */
    const clientsUsingStage =
      await Client.countDocuments({
        currentStage: stage.stageId,
      });

    if (clientsUsingStage > 0) {
      return res.status(409).json({
        success: false,
        message:
          `This stage cannot be deleted because ` +
          `${clientsUsingStage} client(s) currently use it. ` +
          "Deactivate it instead.",
      });
    }

    await ClientStage.deleteOne({
      stageId: stage.stageId,
    });

    return res.status(200).json({
      success: true,
      message: "Stage deleted successfully.",
      data: {
        stageId: stage.stageId,
        key: stage.key,
        name: stage.name,
      },
    });
  } catch (error) {
    console.error("DELETE STAGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to delete stage.",
    });
  }
};