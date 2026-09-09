const Client = require("../model/clientSchema");   // ← fix path if needed
const Profile = require("../model/profileSchema"); // ← fix path if needed

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
  "clientImage",
  "cv",
];

const getProfileData = (body) => {
  return PROFILE_FIELDS.reduce((result, field) => {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }
    return result;
  }, {});
};

// POST /api/clients
exports.createClient = async (req, res) => {
  let createdClient = null;

  try {
    const {
      fullName,
      phone,
      visaType,
      coeStatus,
      clientStatus,
      assignedStaff,
    } = req.body;

    if (!fullName || !phone || !visaType) {
      return res.status(400).json({
        success: false,
        message: "fullName, phone and visaType are required.",
      });
    }

    createdClient = await Client.create({
      fullName,
      phone,
      visaType,
      coeStatus,
      clientStatus,
      assignedStaff: assignedStaff || null,
    });

    const profile = await Profile.create({
      _id: createdClient._id,
      clientId: createdClient.clientId,
      ...getProfileData(req.body),
    });

    return res.status(201).json({
      success: true,
      message: "Client created successfully.",
      data: {
        ...createdClient.toObject(),
        profile: profile.toObject(),
      },
    });
  } catch (error) {
    if (createdClient?._id) {
      await Client.findByIdAndDelete(createdClient._id).catch(() => {});
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A client or profile with this ID already exists.",
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
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const search = String(req.query.search || "").trim();

    const filter = search
      ? {
          $or: [
            { clientId: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Client.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
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
      message: error.message || "Failed to get clients.",
    });
  }
};

// GET /api/clients/:clientId
exports.getClientDetails = async (req, res) => {
  try {
    const clientId = decodeURIComponent(req.params.clientId).trim();

    const client = await Client.findOne({ clientId }).lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    const profile = await Profile.findOne({
      clientId: client.clientId,
    }).lean();

    return res.status(200).json({
      success: true,
      data: {
        ...client,
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
    const clientId = decodeURIComponent(req.params.clientId).trim();

    const clientFields = [
      "fullName",
      "phone",
      "visaType",
      "coeStatus",
      "clientStatus",
      "assignedStaff",
    ];

    const clientUpdates = {};
    clientFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        clientUpdates[field] = req.body[field];
      }
    });

    const client = await Client.findOneAndUpdate(
      { clientId },
      { $set: clientUpdates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    const profileUpdates = getProfileData(req.body);

    const profile = await Profile.findOneAndUpdate(
      { clientId: client.clientId },
      {
        $set: profileUpdates,
        $setOnInsert: {
          _id: client._id,
          clientId: client.clientId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Client updated successfully.",
      data: {
        ...client.toObject(),
        profile: profile.toObject(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update client.",
    });
  }
};

// DELETE /api/clients/:clientId
exports.deleteClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(req.params.clientId).trim();

    const client = await Client.findOneAndDelete({ clientId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    await Profile.deleteOne({ clientId: client.clientId });

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