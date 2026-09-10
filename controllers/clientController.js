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

const selectFields = (source, fields) => {
  return fields.reduce((result, field) => {
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

const normalizeStaffId = (staffId) => {
  if (staffId === undefined) {
    return undefined;
  }

  if (staffId === null || staffId === "") {
    return null;
  }

  return String(staffId).trim().toUpperCase();
};

const findStaffByStaffId = async (staffId) => {
  if (!staffId) {
    return null;
  }

  return Staff.findOne({ staffId })
    .select("-password")
    .lean();
};

const attachStaffDetails = async (clients) => {
  const staffIds = [
    ...new Set(
      clients
        .map((client) => client.assignedStaff)
        .filter(Boolean),
    ),
  ];

  if (staffIds.length === 0) {
    return clients.map((client) => ({
      ...client,
      assignedStaffDetails: null,
    }));
  }

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

  return clients.map((client) => ({
    ...client,
    assignedStaffDetails:
      staffMap.get(client.assignedStaff) || null,
  }));
};

// Helper to parse pagination query params
const parsePagination = (query) => {
  const page = Math.max(
    Number.parseInt(query.page, 10) || 1,
    1,
  );

  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 10, 1),
    100,
  );

  const skip = (page - 1) * limit;
  const search = String(query.search || "").trim();

  return { page, limit, skip, search };
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

    clientData.assignedStaff = normalizeStaffId(
      clientData.assignedStaff,
    );

    if (clientData.assignedStaff) {
      const staff = await findStaffByStaffId(
        clientData.assignedStaff,
      );

      if (!staff) {
        return res.status(404).json({
          success: false,
          message: `Staff ${clientData.assignedStaff} not found.`,
        });
      }

      if (staff.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "The selected staff member is inactive.",
        });
      }
    }

    createdClient = await Client.create(clientData);

    createdProfile = await Profile.create({
      clientId: createdClient.clientId,
      clientRef: createdClient._id,
      ...selectFields(req.body, PROFILE_FIELDS),
      ...getUploadedFiles(req),
    });

    const staffDetails = await findStaffByStaffId(
      createdClient.assignedStaff,
    );

    return res.status(201).json({
      success: true,
      message: "Client and profile created successfully.",
      data: {
        ...createdClient.toObject(),
        assignedStaffDetails: staffDetails,
        profile: createdProfile.toObject(),
      },
    });
  } catch (error) {
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
        message: "Duplicate client or profile data exists.",
        duplicateFields: error.keyValue || {},
      });
    }

    if (error.name === "ValidationError") {
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

// Admin: GET /api/clients
exports.getAllClients = async (req, res) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query);

    const filter = search
      ? {
          $or: [
            {
              clientId: {
                $regex: search,
                $options: "i",
              },
            },
            {
              fullName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              phone: {
                $regex: search,
                $options: "i",
              },
            },
            {
              assignedStaff: {
                $regex: search,
                $options: "i",
              },
            },
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

    const data = await attachStaffDetails(clients);

    return res.status(200).json({
      success: true,
      count: data.length,
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

// Staff: GET /api/clients/staff/W-122261
exports.getClientsByStaff = async (req, res) => {
  try {
    const staffId = normalizeStaffId(req.params.staffId);

    const staff = await findStaffByStaffId(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: `Staff ${staffId} not found.`,
      });
    }

    const { page, limit, skip, search } = parsePagination(req.query);

    const baseFilter = { assignedStaff: staffId };

    const filter = search
      ? {
          ...baseFilter,
          $or: [
            {
              clientId: {
                $regex: search,
                $options: "i",
              },
            },
            {
              fullName: {
                $regex: search,
                $options: "i",
              },
            },
            {
              phone: {
                $regex: search,
                $options: "i",
              },
            },
          ],
        }
      : baseFilter;

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Client.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      staff,
      count: clients.length,
      data: clients,
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
      message: error.message || "Failed to get staff clients.",
    });
  }
};

// GET /api/clients/J-176587345
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

    const [profile, staffDetails] = await Promise.all([
      Profile.findOne({
        clientId: client.clientId,
      }).lean(),

      findStaffByStaffId(client.assignedStaff),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...client,
        assignedStaffDetails: staffDetails,
        profile: profile || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get client.",
    });
  }
};

// PATCH /api/clients/J-176587345
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
      clientUpdates.assignedStaff = normalizeStaffId(
        clientUpdates.assignedStaff,
      );

      if (clientUpdates.assignedStaff) {
        const staff = await findStaffByStaffId(
          clientUpdates.assignedStaff,
        );

        if (!staff) {
          return res.status(404).json({
            success: false,
            message: `Staff ${clientUpdates.assignedStaff} not found.`,
          });
        }

        if (staff.isActive === false) {
          return res.status(400).json({
            success: false,
            message: "The selected staff member is inactive.",
          });
        }
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

    const staffDetails = await findStaffByStaffId(
      client.assignedStaff,
    );

    return res.status(200).json({
      success: true,
      message: "Client updated successfully.",
      data: {
        ...client.toObject(),
        assignedStaffDetails: staffDetails,
        profile: profile.toObject(),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate data exists.",
        duplicateFields: error.keyValue || {},
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update client.",
    });
  }
};

// PUT /api/clients/assign/J-176587345
exports.assignClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const staffId = normalizeStaffId(req.body.staffId);

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "staffId is required.",
      });
    }

    const staff = await findStaffByStaffId(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: `Staff ${staffId} not found.`,
      });
    }

    if (staff.isActive === false) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign a client to an inactive staff member.",
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

// DELETE /api/clients/J-176587345
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