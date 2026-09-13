const Client = require("../model/clientSchema");
const Profile = require("../model/profileSchema");
const Staff = require("../model/staffSchema");

// =================================================
// CLIENT MODEL FIELDS
// =================================================

const CLIENT_FIELDS = [
  "fullName",
  "phone",
  "visaType",
  "coeStatus",
  "clientStatus",
];

// =================================================
// PROFILE MODEL FIELDS
// =================================================

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
];

// =================================================
// SELECT ALLOWED FIELDS
// =================================================

const selectFields = (source, fields) => {
  return fields.reduce((result, field) => {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }

    return result;
  }, {});
};

// =================================================
// REMOVE EMPTY VALUES
//
// This prevents optional enum fields such as
// visaStatus: ""
// from causing Mongoose validation errors.
// =================================================

const removeEmptyStrings = (data) => {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );
};

// =================================================
// UPLOADED FILES
// =================================================

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

// =================================================
// NORMALIZE STAFF ID
// =================================================

const normalizeStaffId = (staffId) => {
  if (staffId === undefined || staffId === null || staffId === "") {
    return null;
  }

  return String(staffId).trim().toUpperCase();
};

// =================================================
// FIND STAFF
// =================================================

const findStaffByStaffId = async (staffId) => {
  if (!staffId) {
    return null;
  }

  return Staff.findOne({
    staffId,
  })
    .select("-password")
    .lean();
};

// =================================================
// CHECK CLIENT ACCESS
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
// ATTACH STAFF INFORMATION
// =================================================

const attachStaffDetails = async (clients) => {
  const staffIds = [
    ...new Set(clients.map((client) => client.assignedStaff).filter(Boolean)),
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

  const staffMap = new Map(staffMembers.map((staff) => [staff.staffId, staff]));

  return clients.map((client) => ({
    ...client,

    assignedStaffDetails: staffMap.get(client.assignedStaff) || null,
  }));
};

// =================================================
// PAGINATION
// =================================================

const parsePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);

  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 10, 1),
    100,
  );

  const skip = (page - 1) * limit;

  const search = String(query.search || "").trim();

  return {
    page,
    limit,
    skip,
    search,
  };
};

// =================================================
// CREATE CLIENT
//
// SUPERADMIN:
// must choose assignedStaff
//
// STAFF:
// automatically assigned to themselves
//
// POST /api/clients
// =================================================

exports.createClient = async (req, res) => {
  let createdClient = null;
  let createdProfile = null;

  try {
    // =================================================
    // CLIENT DATA
    // =================================================

    const clientData = selectFields(req.body, CLIENT_FIELDS);

    clientData.fullName = String(clientData.fullName || "").trim();

    clientData.phone = String(clientData.phone || "").trim();

    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (!clientData.fullName || !clientData.phone || !clientData.visaType) {
      return res.status(400).json({
        success: false,

        message: "fullName, phone and visaType are required.",
      });
    }

    // =================================================
    // SUPERADMIN
    //
    // Admin MUST choose Staff
    // =================================================

    if (req.user.role === "superadmin") {
      const assignedStaff = normalizeStaffId(req.body.assignedStaff);

      if (!assignedStaff) {
        return res.status(400).json({
          success: false,

          message: "Please select a staff member.",
        });
      }

      const staff = await findStaffByStaffId(assignedStaff);

      if (!staff) {
        return res.status(404).json({
          success: false,

          message: `Staff ${assignedStaff} not found.`,
        });
      }

      if (!staff.isActive) {
        return res.status(400).json({
          success: false,

          message: "The selected staff member is inactive.",
        });
      }

      clientData.assignedStaff = assignedStaff;
    }

    // =================================================
    // STAFF
    //
    // Automatically assign to logged-in Staff
    // Any assignedStaff sent from frontend is ignored.
    // =================================================

    if (req.user.role === "staff") {
      if (!req.user.staffId) {
        return res.status(400).json({
          success: false,

          message: "Staff ID was not found for the logged-in user.",
        });
      }

      clientData.assignedStaff = req.user.staffId;
    }

    // =================================================
    // CREATE CLIENT
    // =================================================

    createdClient = await Client.create(clientData);

    // =================================================
    // PREPARE PROFILE DATA
    //
    // IMPORTANT:
    // Remove empty optional values.
    //
    // visaStatus: ""
    // becomes removed completely.
    // =================================================

    const profileData = removeEmptyStrings(
      selectFields(req.body, PROFILE_FIELDS),
    );

    // =================================================
    // CREATE PROFILE
    // =================================================

    createdProfile = await Profile.create({
      clientId: createdClient.clientId,

      clientRef: createdClient._id,

      ...profileData,

      ...getUploadedFiles(req),
    });

    // =================================================
    // STAFF DETAILS
    // =================================================

    const staffDetails = await findStaffByStaffId(createdClient.assignedStaff);

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
    // =================================================
    // ROLLBACK PROFILE
    // =================================================

    if (createdProfile?._id) {
      await Profile.findByIdAndDelete(createdProfile._id).catch(() => {});
    }

    // =================================================
    // ROLLBACK CLIENT
    // =================================================

    if (createdClient?._id) {
      await Profile.deleteOne({
        clientRef: createdClient._id,
      }).catch(() => {});

      await Client.findByIdAndDelete(createdClient._id).catch(() => {});
    }

    console.error("CREATE CLIENT ERROR:", error);

    // =================================================
    // DUPLICATE
    // =================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "Duplicate client or profile data exists.",

        duplicateFields: error.keyValue || {},
      });
    }

    // =================================================
    // VALIDATION
    // =================================================

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

// =================================================
// GET CLIENT LIST
//
// SUPERADMIN:
// sees all clients
//
// STAFF:
// only sees own assigned clients
//
// GET /api/clients
// =================================================

exports.getAllClients = async (req, res) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query);

    const baseFilter = {};

    // =================================================
    // STAFF FILTER
    // =================================================

    if (req.user.role === "staff") {
      baseFilter.assignedStaff = req.user.staffId;
    }

    // =================================================
    // ADMIN OPTIONAL STAFF FILTER
    //
    // /clients?staffId=W-122290
    // =================================================

    if (req.user.role === "superadmin" && req.query.staffId) {
      baseFilter.assignedStaff = normalizeStaffId(req.query.staffId);
    }

    const filter = {
      ...baseFilter,
    };

    // =================================================
    // SEARCH
    // =================================================

    if (search) {
      filter.$or = [
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
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .sort({
          createdAt: -1,
        })
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
    console.error("GET CLIENTS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get clients.",
    });
  }
};

// =================================================
// GET CLIENT DETAILS
//
// SUPERADMIN:
// can access any client
//
// STAFF:
// only own assigned client
//
// GET /api/clients/:clientId
// =================================================

exports.getClientDetails = async (req, res) => {
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

    // =================================================
    // ACCESS
    // =================================================

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to access this client.",
      });
    }

    // =================================================
    // PROFILE + STAFF
    // =================================================

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
    console.error("GET CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to get client.",
    });
  }
};

// =================================================
// UPDATE CLIENT
//
// SUPERADMIN:
// can edit any client
//
// STAFF:
// can edit own client
//
// STAFF cannot reassign.
//
// PATCH /api/clients/:clientId
// =================================================

exports.updateClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    // =================================================
    // FIND CLIENT
    // =================================================

    const existingClient = await Client.findOne({
      clientId,
    });

    if (!existingClient) {
      return res.status(404).json({
        success: false,

        message: "Client not found.",
      });
    }

    // =================================================
    // ACCESS
    // =================================================

    if (!canAccessClient(req, existingClient)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to edit this client.",
      });
    }

    // =================================================
    // STAFF CANNOT REASSIGN
    // =================================================

    if (req.user.role === "staff" && req.body.assignedStaff !== undefined) {
      return res.status(403).json({
        success: false,

        message: "Staff cannot reassign clients.",
      });
    }

    // =================================================
    // CLIENT UPDATES
    // =================================================

    const clientUpdates = removeEmptyStrings(
      selectFields(req.body, CLIENT_FIELDS),
    );

    // =================================================
    // ADMIN MAY CHANGE ASSIGNED STAFF
    // =================================================

    if (
      req.user.role === "superadmin" &&
      req.body.assignedStaff !== undefined
    ) {
      const assignedStaff = normalizeStaffId(req.body.assignedStaff);

      if (!assignedStaff) {
        return res.status(400).json({
          success: false,

          message: "assignedStaff cannot be empty.",
        });
      }

      const staff = await findStaffByStaffId(assignedStaff);

      if (!staff) {
        return res.status(404).json({
          success: false,

          message: `Staff ${assignedStaff} not found.`,
        });
      }

      if (!staff.isActive) {
        return res.status(400).json({
          success: false,

          message: "The selected staff member is inactive.",
        });
      }

      clientUpdates.assignedStaff = assignedStaff;
    }

    // =================================================
    // SAVE CLIENT
    // =================================================

    Object.assign(existingClient, clientUpdates);

    await existingClient.save();

    // =================================================
    // PROFILE UPDATES
    //
    // Empty strings are ignored.
    // This also prevents enum validation errors
    // during Edit Client.
    // =================================================

    const profileUpdates = removeEmptyStrings({
      ...selectFields(req.body, PROFILE_FIELDS),

      ...getUploadedFiles(req),
    });

    let profile = await Profile.findOne({
      clientId: existingClient.clientId,
    });

    if (profile) {
      Object.assign(profile, profileUpdates);

      await profile.save();
    } else {
      profile = await Profile.create({
        clientId: existingClient.clientId,

        clientRef: existingClient._id,

        ...profileUpdates,
      });
    }

    // =================================================
    // STAFF DETAILS
    // =================================================

    const staffDetails = await findStaffByStaffId(existingClient.assignedStaff);

    return res.status(200).json({
      success: true,

      message: "Client updated successfully.",

      data: {
        ...existingClient.toObject(),

        assignedStaffDetails: staffDetails,

        profile: profile.toObject(),
      },
    });
  } catch (error) {
    console.error("UPDATE CLIENT ERROR:", error);

    // =================================================
    // DUPLICATE
    // =================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "Duplicate data exists.",

        duplicateFields: error.keyValue || {},
      });
    }

    // =================================================
    // VALIDATION
    // =================================================

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to update client.",
    });
  }
};

// =================================================
// ASSIGN / REASSIGN CLIENT
//
// SUPERADMIN ONLY
//
// PATCH /api/clients/:clientId/assign
//
// BODY:
// {
//   "staffId": "W-122290"
// }
// =================================================

exports.assignClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const staffId = normalizeStaffId(req.body.staffId);

    // =================================================
    // STAFF ID REQUIRED
    // =================================================

    if (!staffId) {
      return res.status(400).json({
        success: false,

        message: "staffId is required.",
      });
    }

    // =================================================
    // FIND STAFF
    // =================================================

    const staff = await findStaffByStaffId(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,

        message: `Staff ${staffId} not found.`,
      });
    }

    // =================================================
    // ACTIVE CHECK
    // =================================================

    if (!staff.isActive) {
      return res.status(400).json({
        success: false,

        message: "Cannot assign a client to an inactive staff member.",
      });
    }

    // =================================================
    // ASSIGN CLIENT
    // =================================================

    const client = await Client.findOneAndUpdate(
      {
        clientId,
      },
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
    console.error("ASSIGN CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to assign client.",
    });
  }
};

// =================================================
// DELETE CLIENT
//
// SUPERADMIN ONLY
//
// DELETE /api/clients/:clientId
//
// Temporary hard delete.
// Later we'll change this to archive/soft-delete
// before adding payment/history records.
// =================================================

exports.deleteClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

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
    // DELETE PROFILE + CLIENT
    // =================================================

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
    console.error("DELETE CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to delete client.",
    });
  }
};
