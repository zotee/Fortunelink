const Client = require("../model/clientSchema");
const Profile = require("../model/profileSchema");
const Staff = require("../model/staffSchema");

const CLIENT_FIELDS = [
  "fullName",
  "phone",
  "visaType",
  "coeStatus",
  "clientStatus",
  "assignedStaff",
];

const PROFILE_FIELDS = [
  "dateOfBirth",
  "gender",
  "email",
  "address",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
  "statusOfResidence",
  "lastQualification",
  "japaneseLanguageLevel",
  "schoolName",
  "course",
  "intake",
  "jobCategory",
  "jobTitle",
  "companyName",
  "workLocation",
  "sponsorName",
  "sponsorRelationship",
  "sponsorStatusOfResidence",
  "visaStatus",
  "remark",
];

const selectFields = (source, allowedFields) => {
  return allowedFields.reduce((result, field) => {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }

    return result;
  }, {});
};

const getUploadedFiles = (req) => {
  const files = {};

  if (req.files?.clientImage?.[0]?.path) {
    files.clientImage = req.files.clientImage[0].path;
  }

  if (req.files?.cv?.[0]?.path) {
    files.cv = req.files.cv[0].path;
  }

  return files;
};

// POST /api/clients
exports.createClient = async (req, res) => {
  let createdClient = null;
  let createdProfile = null;

  try {
    const clientData = selectFields(req.body, CLIENT_FIELDS);

    clientData.fullName = String(clientData.fullName || "").trim();
    clientData.phone = String(clientData.phone || "").trim();

    if (!clientData.fullName || !clientData.phone || !clientData.visaType) {
      return res.status(400).json({
        success: false,
        message: "fullName, phone and visaType are required.",
      });
    }

    if (clientData.assignedStaff) {
      clientData.assignedStaff = String(
        clientData.assignedStaff,
      ).trim();

      // Verify public staffId such as W-122261
      const staffExists = await Staff.exists({
        staffId: clientData.assignedStaff,
      });

      if (!staffExists) {
        return res.status(400).json({
          success: false,
          message: `Staff ${clientData.assignedStaff} was not found.`,
        });
      }
    } else {
      clientData.assignedStaff = null;
    }

    createdClient = await Client.create(clientData);

    const profileData = {
      ...selectFields(req.body, PROFILE_FIELDS),
      ...getUploadedFiles(req),
      clientId: createdClient.clientId,
      clientRef: createdClient._id,
    };

    createdProfile = await Profile.create(profileData);

    const staff = createdClient.assignedStaff
      ? await Staff.findOne({
          staffId: createdClient.assignedStaff,
        })
          .select("-password")
          .lean()
      : null;

    return res.status(201).json({
      success: true,
      message: "Client and profile created successfully.",
      data: {
        ...createdClient.toObject(),
        assignedStaffDetails: staff,
        profile: createdProfile.toObject(),
      },
    });
  } catch (error) {
    // Remove both documents if anything fails
    if (createdProfile?._id) {
      await Profile.findByIdAndDelete(createdProfile._id).catch(() => {});
    }

    if (createdClient?._id) {
      await Profile.deleteOne({
        clientRef: createdClient._id,
      }).catch(() => {});

      await Client.findByIdAndDelete(createdClient._id).catch(() => {});
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate data already exists.",
        duplicateFields: error.keyValue || {},
        databaseMessage: error.message,
      });
    }

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create client.",
    });
  }
};

// GET /api/clients
exports.getAllClients = async (req, res) => {
  try {
    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1,
    );

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      100,
    );

    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    const filter = search
      ? {
          $or: [
            { clientId: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { assignedStaff: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Client.countDocuments(filter),
    ]);

    const staffIds = [
      ...new Set(
        clients
          .map((client) => client.assignedStaff)
          .filter(Boolean),
      ),
    ];

    const staffMembers = await Staff.find({
      staffId: {
        $in: staffIds,
      },
    })
      .select("-password")
      .lean();

    const staffMap = new Map(
      staffMembers.map((staff) => [staff.staffId, staff]),
    );

    const data = clients.map((client) => ({
      ...client,
      assignedStaffDetails:
        staffMap.get(client.assignedStaff) || null,
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get clients.",
    });
  }
};

// GET /api/clients/staff/:staffId
exports.getClientsByStaff = async (req, res) => {
  try {
    const staffId = decodeURIComponent(
      String(req.params.staffId || ""),
    ).trim();

    const staff = await Staff.findOne({ staffId })
      .select("-password")
      .lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    const clients = await Client.find({
      assignedStaff: staffId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      staff,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get staff clients.",
    });
  }
};

// GET /api/clients/:clientId
exports.getClientDetails = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const client = await Client.findOne({ clientId }).lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    const [profile, staff] = await Promise.all([
      Profile.findOne({
        clientId: client.clientId,
      }).lean(),

      client.assignedStaff
        ? Staff.findOne({
            staffId: client.assignedStaff,
          })
            .select("-password")
            .lean()
        : Promise.resolve(null),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...client,
        assignedStaffDetails: staff,
        profile: profile || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get client details.",
    });
  }
};

// PATCH /api/clients/:clientId
exports.updateClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const existingClient = await Client.findOne({ clientId });

    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    const clientUpdates = selectFields(req.body, CLIENT_FIELDS);

    if (clientUpdates.assignedStaff !== undefined) {
      if (clientUpdates.assignedStaff) {
        clientUpdates.assignedStaff = String(
          clientUpdates.assignedStaff,
        ).trim();

        const staffExists = await Staff.exists({
          staffId: clientUpdates.assignedStaff,
        });

        if (!staffExists) {
          return res.status(400).json({
            success: false,
            message: `Staff ${clientUpdates.assignedStaff} was not found.`,
          });
        }
      } else {
        clientUpdates.assignedStaff = null;
      }
    }

    const client = await Client.findOneAndUpdate(
      { clientId },
      {
        $set: clientUpdates,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const profileUpdates = {
      ...selectFields(req.body, PROFILE_FIELDS),
      ...getUploadedFiles(req),
    };

    let profile = await Profile.findOne({
      clientId: client.clientId,
    });

    if (profile) {
      Object.assign(profile, profileUpdates);
      await profile.save();
    } else {
      profile = await Profile.create({
        clientId: client.clientId,
        clientRef: client._id,
        ...profileUpdates,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Client updated successfully.",
      data: {
        ...client.toObject(),
        profile: profile.toObject(),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate data already exists.",
        duplicateFields: error.keyValue || {},
        databaseMessage: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update client.",
    });
  }
};

// PUT /api/clients/assign/:clientId
exports.assignClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const staffId = String(req.body.staffId || "").trim();

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "staffId is required.",
      });
    }

    const staff = await Staff.findOne({ staffId })
      .select("-password")
      .lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: `Staff ${staffId} was not found.`,
      });
    }

    const client = await Client.findOneAndUpdate(
      { clientId },
      {
        $set: {
          assignedStaff: staffId,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Client assigned successfully.",
      data: {
        ...client.toObject(),
        assignedStaffDetails: staff,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to assign client.",
    });
  }
};

// DELETE /api/clients/:clientId
exports.deleteClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const client = await Client.findOne({ clientId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    await Promise.all([
      Profile.deleteOne({
        clientId: client.clientId,
      }),

      Client.deleteOne({
        _id: client._id,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Client and profile deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete client.",
    });
  }
};