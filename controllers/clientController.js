const mongoose = require("mongoose");
const fs = require("fs");

const Client = require("../model/clientSchema");

const ProfileModule = require("../model/profileSchema");
const Profile = ProfileModule.Profile || ProfileModule;

const Staff = require("../model/staffSchema");
const ClientStage = require("../model/clientStageSchema");
const ClientStageHistory = require("../model/clientStageHistorySchema");
const Payment = require("../model/paymentSchema");

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// =================================================
// REGISTRATION CONFIG
// =================================================

const REGISTRATION_STAGE_KEY = "registeredPaid";

const PAYMENT_METHODS = ["Bank Transfer", "Cash"];

// =================================================
// CREATE CLIENT FIELDS
//
// currentStage is intentionally NOT accepted.
// New clients always start from registeredPaid.
// =================================================

const CREATE_CLIENT_FIELDS = [
  "fullName",
  "phone",
  "currentVisaStatus",
  "preferCategory",
];

// =================================================
// UPDATE CLIENT FIELDS
// =================================================

const UPDATE_CLIENT_FIELDS = [
  "fullName",
  "phone",
  "currentVisaStatus",
  "preferCategory",
];

// =================================================
// PROFILE FIELDS
// =================================================

const PROFILE_FIELDS = [
  "furigana",
  "dateOfBirth",
  "gender",
  "email",
  "nationality",

  "postalCode",
  "prefecture",
  "address",

  "passportNumber",
  "passportExpiryDate",
  "residenceExpiryDate",

  // Legacy
  "statusOfResidence",

  "education",

  "japaneseLanguageLevel",
  "qualifications",

  "skills",

  "employmentHistory",
  "careerSummary",

  "motivation",
  "selfPR",
  "desiredConditions",

  "intake",
];

// =================================================
// HTTP ERROR
// =================================================

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

// =================================================
// SELECT FIELDS
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
// REMOVE EMPTY STRINGS
// =================================================

const removeEmptyStrings = (data) => {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        !(typeof value === "string" && value.trim() === ""),
    ),
  );
};

// =================================================
// JSON ARRAY
// =================================================

const parseJsonArray = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      throw createHttpError(`${fieldName} must be an array.`);
    }

    return parsed;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    throw createHttpError(`${fieldName} must contain a valid JSON array.`);
  }
};

// =================================================
// PROFILE DATA - CREATE
// =================================================

const prepareProfileData = (source) => {
  const profileData = removeEmptyStrings(selectFields(source, PROFILE_FIELDS));

  if (profileData.education !== undefined) {
    profileData.education = parseJsonArray(profileData.education, "education");
  }

  if (profileData.employmentHistory !== undefined) {
    profileData.employmentHistory = parseJsonArray(
      profileData.employmentHistory,
      "employmentHistory",
    );
  }

  if (profileData.qualifications !== undefined) {
    profileData.qualifications = parseJsonArray(
      profileData.qualifications,
      "qualifications",
    );
  }

  if (profileData.skills !== undefined) {
    profileData.skills = parseJsonArray(profileData.skills, "skills")
      .map((skill) => String(skill || "").trim())
      .filter(Boolean);
  }

  return profileData;
};

// =================================================
// PROFILE DATA - UPDATE
// =================================================

const prepareProfileUpdateData = (source) => {
  const profileData = selectFields(source, PROFILE_FIELDS);

  if (profileData.education !== undefined) {
    profileData.education = parseJsonArray(profileData.education, "education");
  }

  if (profileData.employmentHistory !== undefined) {
    profileData.employmentHistory = parseJsonArray(
      profileData.employmentHistory,
      "employmentHistory",
    );
  }

  if (profileData.qualifications !== undefined) {
    profileData.qualifications = parseJsonArray(
      profileData.qualifications,
      "qualifications",
    );
  }

  if (profileData.skills !== undefined) {
    profileData.skills = parseJsonArray(profileData.skills, "skills")
      .map((skill) => String(skill || "").trim())
      .filter(Boolean);
  }

  return profileData;
};

// =================================================
// FILES
// =================================================

const getUploadedFiles = (req) => {
  const files = {};

  const clientImage =
    req.files?.clientImage?.[0];

  const cv =
    req.files?.cv?.[0];

  if (clientImage?.filename) {
    files.clientImage =
      `uploads/${clientImage.filename}`;
  }

  if (cv?.filename) {
    files.cv =
      `uploads/${cv.filename}`;
  }

  return files;
};

const cleanupUploadedFiles = (files) => {
  Object.values(files).forEach((filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }

    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("UPLOAD CLEANUP ERROR:", error.message);
    }
  });
};

// =================================================
// STAFF
// =================================================

const normalizeStaffId = (staffId) => {
  if (staffId === undefined || staffId === null || staffId === "") {
    return null;
  }

  return String(staffId).trim().toUpperCase();
};

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
// PAYMENT DATE
// =================================================

const parsePaymentDate = (value) => {
  if (!value) {
    throw createHttpError("Payment date is required.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createHttpError("Payment date is invalid.");
  }

  return date;
};

// =================================================
// REGISTRATION PAYMENT VALIDATION
// =================================================

const validateRegistrationPayment = (body) => {
  const paymentMethod = String(body.paymentMethod || "").trim();

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw createHttpError("Payment method must be Bank Transfer or Cash.");
  }

  const paymentDate = parsePaymentDate(body.paymentDate);

  return {
    paymentMethod,
    paymentDate,

    bankName: String(body.bankName || "").trim(),

    referenceNumber: String(body.referenceNumber || "").trim(),

    receiptNumber: String(body.receiptNumber || "").trim(),

    note: String(body.paymentNote || "").trim(),
  };
};

// =================================================
// REGEX
// =================================================

const escapeRegex = (value) => {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const exactRegex = (value) => ({
  $regex: `^${escapeRegex(value)}$`,

  $options: "i",
});

// =================================================
// PAGINATION
// =================================================

const parseClientListQuery = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);

  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 10, 1),
    100,
  );

  const skip = (page - 1) * limit;

  const freeWord = String(query.free_word || "").trim();

  const sortFieldMap = {
    createdAt: "createdAt",

    updatedAt: "updatedAt",

    name: "fullName",

    fullName: "fullName",

    clientId: "clientId",
  };

  const sortBy = sortFieldMap[query.sortBy] || "createdAt";

  const sortOrder =
    String(query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  return {
    page,
    limit,
    skip,
    freeWord,
    sortBy,
    sortOrder,
  };
};

// =================================================
// FILTER PIPELINE
// =================================================

const buildClientFilterPipeline = (req) => {
  const clientFilter = {};

  if (req.user.role === "staff") {
    clientFilter.assignedStaff = req.user.staffId;
  }

  if (req.user.role === "superadmin" && req.query.staffId) {
    const staffId = normalizeStaffId(req.query.staffId);

    if (staffId) {
      clientFilter.assignedStaff = staffId;
    }
  }

  if (req.query.currentVisaStatus) {
    clientFilter.currentVisaStatus = String(req.query.currentVisaStatus).trim();
  }

  if (req.query.preferCategory) {
    clientFilter.preferCategory = String(req.query.preferCategory).trim();
  }

  if (req.query.currentStage) {
    clientFilter.currentStage = String(req.query.currentStage).trim();
  }

  if (req.query.clientStatus) {
    clientFilter.clientStatus = String(req.query.clientStatus).trim();
  }

  const profileFilter = {};

  if (req.query.japaneseLevel) {
    profileFilter["profile.japaneseLanguageLevel"] = exactRegex(
      req.query.japaneseLevel,
    );
  }

  if (req.query.nationality) {
    profileFilter["profile.nationality"] = {
      $regex: escapeRegex(req.query.nationality),

      $options: "i",
    };
  }

  const pipeline = [
    {
      $match: clientFilter,
    },

    {
      $lookup: {
        from: Profile.collection.name,

        localField: "clientId",

        foreignField: "clientId",

        as: "profile",
      },
    },

    {
      $unwind: {
        path: "$profile",

        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: Staff.collection.name,

        localField: "assignedStaff",

        foreignField: "staffId",

        as: "assignedStaffDetails",
      },
    },

    {
      $unwind: {
        path: "$assignedStaffDetails",

        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: ClientStage.collection.name,

        localField: "currentStage",

        foreignField: "key",

        as: "currentStageDetails",
      },
    },

    {
      $unwind: {
        path: "$currentStageDetails",

        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (Object.keys(profileFilter).length > 0) {
    pipeline.push({
      $match: profileFilter,
    });
  }

  const freeWord = String(req.query.free_word || "").trim();

  if (freeWord) {
    const searchRegex = {
      $regex: escapeRegex(freeWord),

      $options: "i",
    };

    pipeline.push({
      $match: {
        $or: [
          { clientId: searchRegex },
          { fullName: searchRegex },
          { phone: searchRegex },
          { assignedStaff: searchRegex },
          { currentVisaStatus: searchRegex },
          { preferCategory: searchRegex },
          { currentStage: searchRegex },
          { clientStatus: searchRegex },

          {
            "currentStageDetails.name": searchRegex,
          },

          {
            "profile.furigana": searchRegex,
          },

          {
            "profile.email": searchRegex,
          },

          {
            "profile.postalCode": searchRegex,
          },

          {
            "profile.address": searchRegex,
          },

          {
            "profile.prefecture": searchRegex,
          },

          {
            "profile.nationality": searchRegex,
          },

          {
            "profile.passportNumber": searchRegex,
          },

          {
            "profile.education.schoolName": searchRegex,
          },

          {
            "profile.education.major": searchRegex,
          },

          {
            "profile.employmentHistory.companyName": searchRegex,
          },

          {
            "profile.employmentHistory.department": searchRegex,
          },

          {
            "profile.employmentHistory.jobTitle": searchRegex,
          },

          {
            "profile.qualifications.name": searchRegex,
          },

          {
            "profile.skills": searchRegex,
          },

          {
            "profile.japaneseLanguageLevel": searchRegex,
          },

          {
            "profile.intake": searchRegex,
          },

          {
            "assignedStaffDetails.name": searchRegex,
          },

          {
            "assignedStaffDetails.email": searchRegex,
          },
        ],
      },
    });
  }

  pipeline.push({
    $unset: ["assignedStaffDetails.password"],
  });

  return pipeline;
};

// =================================================
// EXPORT HELPERS
// =================================================

const normalizeExportValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
};

const spreadsheetSafeValue = (value) => {
  let text = normalizeExportValue(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return text;
};

const csvValue = (value) => {
  const safeValue = spreadsheetSafeValue(value);

  return `"${safeValue.replace(/"/g, '""')}"`;
};

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeExportValue(value);
  }

  return date.toISOString().slice(0, 10);
};

const formatEducationHistory = (education = []) => {
  if (!Array.isArray(education)) {
    return "";
  }

  return education
    .map((item, index) => {
      return [
        `Education ${index + 1}`,

        item.educationType ? `Type: ${item.educationType}` : "",

        item.schoolName ? `School: ${item.schoolName}` : "",

        item.major ? `Major: ${item.major}` : "",

        item.enrollmentDate
          ? `Enrollment: ${formatDate(item.enrollmentDate)}`
          : "",

        item.graduationDate
          ? `Graduation: ${formatDate(item.graduationDate)}`
          : "",

        item.graduationStatus ? `Status: ${item.graduationStatus}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean)
    .join("; ");
};

const formatEmploymentHistory = (employmentHistory = []) => {
  if (!Array.isArray(employmentHistory)) {
    return "";
  }

  return employmentHistory
    .map((item, index) => {
      return [
        `Employment ${index + 1}`,

        item.companyName ? `Company: ${item.companyName}` : "",

        item.employmentType ? `Type: ${item.employmentType}` : "",

        item.department ? `Department: ${item.department}` : "",

        item.jobTitle ? `Job Title: ${item.jobTitle}` : "",

        item.workLocation ? `Location: ${item.workLocation}` : "",

        item.startDate ? `Start: ${formatDate(item.startDate)}` : "",

        item.isCurrent
          ? "Currently Employed"
          : item.endDate
            ? `End: ${formatDate(item.endDate)}`
            : "",

        item.responsibilities
          ? `Responsibilities: ${item.responsibilities}`
          : "",

        item.achievements ? `Achievements: ${item.achievements}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean)
    .join("; ");
};

const formatQualifications = (qualifications = []) => {
  if (!Array.isArray(qualifications)) {
    return "";
  }

  return qualifications
    .map((item, index) => {
      return [
        `Qualification ${index + 1}`,

        item.name ? `Name: ${item.name}` : "",

        item.levelOrScore ? `Level/Score: ${item.levelOrScore}` : "",

        item.acquiredDate ? `Acquired: ${formatDate(item.acquiredDate)}` : "",

        item.expiryDate ? `Expiry: ${formatDate(item.expiryDate)}` : "",

        item.issuer ? `Issuer: ${item.issuer}` : "",

        item.note ? `Note: ${item.note}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean)
    .join("; ");
};

const formatSkills = (skills = []) => {
  if (!Array.isArray(skills)) {
    return "";
  }

  return skills
    .map((skill) => String(skill || "").trim())
    .filter(Boolean)
    .join(", ");
};

// =================================================
// EXPORT COLUMNS
// =================================================

const CLIENT_EXPORT_COLUMNS = [
  {
    header: "Client ID",
    value: (row) => row.clientId,
  },

  {
    header: "Full Name",
    value: (row) => row.fullName,
  },

  {
    header: "Furigana",
    value: (row) => row.profile?.furigana,
  },

  {
    header: "Phone",
    value: (row) => row.phone,
  },

  {
    header: "Email",
    value: (row) => row.profile?.email,
  },

  {
    header: "Current Visa Status",

    value: (row) => row.currentVisaStatus,
  },

  {
    header: "Residence Expiry Date",

    value: (row) => formatDate(row.profile?.residenceExpiryDate),
  },

  {
    header: "Preferred Category",

    value: (row) => row.preferCategory,
  },

  {
    header: "Current Stage Key",

    value: (row) => row.currentStage,
  },

  {
    header: "Current Stage",

    value: (row) => row.currentStageDetails?.name || row.clientStatus,
  },

  {
    header: "Current Stage Amount",

    value: (row) => row.currentStageDetails?.amount ?? 0,
  },

  {
    header: "Assigned Staff ID",

    value: (row) => row.assignedStaff,
  },

  {
    header: "Assigned Staff Name",

    value: (row) => row.assignedStaffDetails?.name,
  },

  {
    header: "Date of Birth",

    value: (row) => formatDate(row.profile?.dateOfBirth),
  },

  {
    header: "Gender",
    value: (row) => row.profile?.gender,
  },

  {
    header: "Nationality",
    value: (row) => row.profile?.nationality,
  },

  {
    header: "Postal Code",
    value: (row) => row.profile?.postalCode,
  },

  {
    header: "Prefecture",
    value: (row) => row.profile?.prefecture,
  },

  {
    header: "Address",
    value: (row) => row.profile?.address,
  },

  {
    header: "Passport Number",

    value: (row) => row.profile?.passportNumber,
  },

  {
    header: "Passport Expiry Date",

    value: (row) => formatDate(row.profile?.passportExpiryDate),
  },

  {
    header: "Education History",

    value: (row) => formatEducationHistory(row.profile?.education),
  },

  {
    header: "Japanese Language Level",

    value: (row) => row.profile?.japaneseLanguageLevel,
  },

  {
    header: "Qualifications",

    value: (row) => formatQualifications(row.profile?.qualifications),
  },

  {
    header: "Skills",

    value: (row) => formatSkills(row.profile?.skills),
  },

  {
    header: "Employment History",

    value: (row) => formatEmploymentHistory(row.profile?.employmentHistory),
  },

  {
    header: "Career Summary",

    value: (row) => row.profile?.careerSummary,
  },

  {
    header: "Motivation",

    value: (row) => row.profile?.motivation,
  },

  {
    header: "Self PR",

    value: (row) => row.profile?.selfPR,
  },

  {
    header: "Desired Conditions",

    value: (row) => row.profile?.desiredConditions,
  },

  {
    header: "Intake",

    value: (row) => row.profile?.intake,
  },

  {
    header: "Client Image",

    value: (row) => row.profile?.clientImage,
  },

  {
    header: "Original CV",

    value: (row) => row.profile?.cv,
  },

  {
    header: "Created At",

    value: (row) => row.createdAt,
  },

  {
    header: "Updated At",

    value: (row) => row.updatedAt,
  },
];

// =================================================
// EXPORT DATA
// =================================================

const getFilteredClientsForExport = async (req) => {
  const { sortBy, sortOrder } = parseClientListQuery(req.query);

  const pipeline = buildClientFilterPipeline(req);

  pipeline.push({
    $sort: {
      [sortBy]: sortOrder,
    },
  });

  return Client.aggregate(pipeline);
};

// =================================================
// CREATE CLIENT + REGISTRATION PAYMENT
//
// New client can only be created after the full
// registration-stage amount has been confirmed.
//
// Transaction:
// Client
// Profile
// Initial Stage History
// Payment
// =================================================

exports.createClient = async (req, res) => {
  const uploadedFiles = getUploadedFiles(req);

  let committed = false;

  const session = await mongoose.startSession();

  try {
    // =================================================
    // BASIC CLIENT DATA
    // =================================================

    const clientData = selectFields(req.body, CREATE_CLIENT_FIELDS);

    clientData.fullName = String(clientData.fullName || "").trim();

    clientData.phone = String(clientData.phone || "").trim();

    clientData.currentVisaStatus = String(
      clientData.currentVisaStatus || "",
    ).trim();

    if (
      !clientData.fullName ||
      !clientData.phone ||
      !clientData.currentVisaStatus
    ) {
      throw createHttpError(
        "fullName, phone and currentVisaStatus are required.",
      );
    }

    // =================================================
    // PROFILE DATA
    // =================================================

    const profileData = prepareProfileData(req.body);

    // =================================================
    // PAYMENT INPUT
    // =================================================

    const paymentInput = validateRegistrationPayment(req.body);

    // =================================================
    // ASSIGNED STAFF
    // =================================================

    let assignedStaffId = null;

    if (req.user.role === "superadmin") {
      assignedStaffId = normalizeStaffId(req.body.assignedStaff);

      if (!assignedStaffId) {
        throw createHttpError("Please select a staff member.");
      }
    }

    if (req.user.role === "staff") {
      assignedStaffId = normalizeStaffId(req.user.staffId);

      if (!assignedStaffId) {
        throw createHttpError("Staff ID was not found for the logged-in user.");
      }
    }

    const assignedStaff = await Staff.findOne({
      staffId: assignedStaffId,
    })
      .select("-password")
      .lean();

    if (!assignedStaff) {
      throw createHttpError(`Staff ${assignedStaffId} not found.`, 404);
    }

    if (!assignedStaff.isActive) {
      throw createHttpError("The selected staff member is inactive.");
    }

    // =================================================
    // AUTH USER ID
    // =================================================

    if (!req.user.id) {
      throw createHttpError("Authenticated user ID was not found.", 401);
    }

    let createdClient;
    let createdProfile;
    let createdHistory;
    let createdPayment;
    let registrationStage;

    // =================================================
    // TRANSACTION
    // =================================================

    await session.withTransaction(async () => {
      // =================================================
      // REGISTRATION STAGE
      // =================================================

      registrationStage = await ClientStage.findOne({
        key: REGISTRATION_STAGE_KEY,

        isActive: true,
      })
        .session(session)
        .lean();

      if (!registrationStage) {
        throw createHttpError(
          'Registration stage "registeredPaid" does not exist or is inactive.',
        );
      }

      const registrationAmount = Number(registrationStage.amount || 0);

      // Registration is explicitly a paid stage.
      if (!Number.isFinite(registrationAmount) || registrationAmount <= 0) {
        throw createHttpError(
          'The "Registered / Paid" stage must have an amount greater than ¥0.',
        );
      }

      // =================================================
      // CLIENT
      // =================================================

      clientData.currentStage = registrationStage.key;

      clientData.clientStatus = registrationStage.name;

      clientData.assignedStaff = assignedStaffId;

      const clientDocuments = await Client.create([clientData], {
        session,
      });

      createdClient = clientDocuments[0];

      // =================================================
      // PROFILE
      // =================================================

      const profileDocuments = await Profile.create(
        [
          {
            clientId: createdClient.clientId,

            clientRef: createdClient._id,

            ...profileData,

            ...uploadedFiles,
          },
        ],
        {
          session,
        },
      );

      createdProfile = profileDocuments[0];

      // =================================================
      // INITIAL STAGE HISTORY
      // =================================================

      const historyDocuments = await ClientStageHistory.create(
        [
          {
            clientRef: createdClient._id,

            clientId: createdClient.clientId,

            fromStage: null,

            fromStageName: null,

            toStage: registrationStage.key,

            toStageName: registrationStage.name,

            toStageAmount: registrationAmount,

            paymentRef: null,

            note: "Initial registration after full registration payment.",

            changedBy: String(req.user.id),

            changedByRole: req.user.role,

            staffId: assignedStaffId,

            changedByName: req.user.name || "Unknown",
          },
        ],
        {
          session,
        },
      );

      createdHistory = historyDocuments[0];

      // =================================================
      // REGISTRATION PAYMENT
      // =================================================

      const paymentDocuments = await Payment.create(
        [
          {
            clientRef: createdClient._id,

            clientId: createdClient.clientId,

            stageHistoryRef: createdHistory._id,

            stageKey: registrationStage.key,

            stageName: registrationStage.name,

            stageAmount: registrationAmount,

            // Full payment only
            amountPaid: registrationAmount,

            paymentMethod: paymentInput.paymentMethod,

            paymentDate: paymentInput.paymentDate,

            paymentStatus: "Completed",

            collectedBy: req.user.id,

            collectedByRole: req.user.role,

            collectedByName: req.user.name || "Unknown",

            creditedStaffRef: assignedStaff._id,

            creditedStaff: assignedStaff.staffId,

            creditedStaffName: assignedStaff.name,

            referenceNumber: paymentInput.referenceNumber,

            receiptNumber: paymentInput.receiptNumber,

            bankName: paymentInput.bankName,

            note: paymentInput.note,
          },
        ],
        {
          session,
        },
      );

      createdPayment = paymentDocuments[0];

      // =================================================
      // LINK HISTORY -> PAYMENT
      // =================================================

      createdHistory.paymentRef = createdPayment._id;

      await createdHistory.save({
        session,
      });
    });

    committed = true;

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        "Registration payment confirmed and client registered successfully.",

      data: {
        ...createdClient.toObject(),

        assignedStaffDetails: assignedStaff,

        currentStageDetails: registrationStage,

        profile: createdProfile.toObject(),

        initialStageHistory: createdHistory.toObject(),

        registrationPayment: createdPayment.toObject(),
      },
    });
  } catch (error) {
    if (!committed) {
      cleanupUploadedFiles(uploadedFiles);
    }

    console.error("CREATE CLIENT ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "Duplicate client, profile or payment data exists.",

        duplicateFields: error.keyValue || {},
      });
    }

    if (error.name === "ValidationError" || error.statusCode) {
      return res.status(error.statusCode || 400).json({
        success: false,

        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to register client.",
    });
  } finally {
    await session.endSession();
  }
};

// =================================================
// GET CLIENT LIST
// =================================================

exports.getAllClients = async (req, res) => {
  try {
    const { page, limit, skip, freeWord, sortBy, sortOrder } =
      parseClientListQuery(req.query);

    const pipeline = buildClientFilterPipeline(req);

    pipeline.push({
      $facet: {
        data: [
          {
            $sort: {
              [sortBy]: sortOrder,
            },
          },

          {
            $skip: skip,
          },

          {
            $limit: limit,
          },
        ],

        pagination: [
          {
            $count: "total",
          },
        ],
      },
    });

    const result = await Client.aggregate(pipeline);

    const data = result?.[0]?.data || [];

    const total = result?.[0]?.pagination?.[0]?.total || 0;

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      success: true,

      count: data.length,

      data,

      pagination: {
        current_page: page,

        last_page: totalPages,

        per_page: limit,

        total,

        from: total === 0 ? null : skip + 1,

        to: total === 0 ? null : Math.min(skip + data.length, total),

        has_next_page: page < totalPages,

        has_previous_page: page > 1,
      },

      filters: {
        free_word: freeWord || null,

        staffId:
          req.user.role === "staff"
            ? req.user.staffId
            : req.query.staffId || null,

        currentVisaStatus: req.query.currentVisaStatus || null,

        preferCategory: req.query.preferCategory || null,

        currentStage: req.query.currentStage || null,

        japaneseLevel: req.query.japaneseLevel || null,

        nationality: req.query.nationality || null,

        sortBy,

        sortOrder: sortOrder === 1 ? "asc" : "desc",
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
// EXPORT CLIENTS
// =================================================

exports.exportClients = async (req, res) => {
  try {
    const format = String(req.params.format || "")
      .trim()
      .toLowerCase();

    const allowedFormats = ["csv", "pdf", "xlsx"];

    if (!allowedFormats.includes(format)) {
      return res.status(400).json({
        success: false,

        message: "Export format must be csv, pdf or xlsx.",
      });
    }

    const clients = await getFilteredClientsForExport(req);

    const date = new Date().toISOString().slice(0, 10);

    // =================================================
    // CSV
    // =================================================

    if (format === "csv") {
      const header = CLIENT_EXPORT_COLUMNS.map((column) =>
        csvValue(column.header),
      ).join(",");

      const rows = clients.map((client) =>
        CLIENT_EXPORT_COLUMNS.map((column) =>
          csvValue(column.value(client)),
        ).join(","),
      );

      const csv = [header, ...rows].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="clients-${date}.csv"`,
      );

      return res.status(200).send(`\uFEFF${csv}`);
    }

    // =================================================
    // XLSX
    // =================================================

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Fortune Link";

      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Clients");

      worksheet.columns = CLIENT_EXPORT_COLUMNS.map((column, index) => ({
        header: column.header,

        key: `column_${index}`,

        width: [
          "Education History",
          "Qualifications",
          "Employment History",
          "Career Summary",
          "Motivation",
          "Self PR",
          "Desired Conditions",
        ].includes(column.header)
          ? 55
          : 24,
      }));

      for (const client of clients) {
        worksheet.addRow(
          CLIENT_EXPORT_COLUMNS.map((column) => {
            const value = column.value(client);

            return value === undefined || value === null ? "" : String(value);
          }),
        );
      }

      const headerRow = worksheet.getRow(1);

      headerRow.font = {
        bold: true,
      };

      headerRow.height = 30;

      headerRow.alignment = {
        vertical: "middle",

        horizontal: "center",

        wrapText: true,
      };

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        row.eachCell((cell) => {
          if (cell.value !== null && cell.value !== undefined) {
            cell.value = String(cell.value);
          }

          cell.numFmt = "@";

          cell.alignment = {
            vertical: "top",

            horizontal: "left",

            wrapText: true,
          };
        });
      });

      worksheet.views = [
        {
          state: "frozen",

          ySplit: 1,
        },
      ];

      worksheet.autoFilter = {
        from: {
          row: 1,

          column: 1,
        },

        to: {
          row: 1,

          column: CLIENT_EXPORT_COLUMNS.length,
        },
      };

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="clients-${date}.xlsx"`,
      );

      await workbook.xlsx.write(res);

      return res.end();
    }

    // =================================================
    // PDF LIST EXPORT
    // =================================================

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="clients-${date}.pdf"`,
    );

    const doc = new PDFDocument({
      size: "A4",

      margin: 40,

      info: {
        Title: "Filtered Client Export",
      },
    });

    doc.pipe(res);

    const pdfFontPath = process.env.PDF_FONT_PATH;

    if (pdfFontPath && fs.existsSync(pdfFontPath)) {
      doc.font(pdfFontPath);
    } else {
      doc.font("Helvetica");
    }

    doc.fontSize(18).text("Filtered Client Export");

    doc.moveDown(0.25);

    doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`);

    doc.text(`Total Clients: ${clients.length}`);

    doc.moveDown();

    for (let index = 0; index < clients.length; index += 1) {
      const client = clients[index];

      if (index > 0) {
        doc.addPage();
      }

      doc
        .fontSize(14)
        .text(`${client.clientId || "-"} - ${client.fullName || "-"}`);

      doc.moveDown(0.5);

      for (const column of CLIENT_EXPORT_COLUMNS) {
        if (doc.y > doc.page.height - 70) {
          doc.addPage();
        }

        const value = normalizeExportValue(column.value(client));

        doc.fontSize(9).text(`${column.header}: ${value || "-"}`, {
          width: doc.page.width - 80,
        });
      }
    }

    doc.end();

    return;
  } catch (error) {
    console.error("EXPORT CLIENTS ERROR:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,

        message: error.message || "Failed to export clients.",
      });
    }

    return;
  }
};

// =================================================
// GET CLIENT DETAILS
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

    if (!canAccessClient(req, client)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to access this client.",
      });
    }

    const [profile, staffDetails, stageDetails] = await Promise.all([
      Profile.findOne({
        clientId: client.clientId,
      }).lean(),

      findStaffByStaffId(client.assignedStaff),

      ClientStage.findOne({
        key: client.currentStage,
      }).lean(),
    ]);

    return res.status(200).json({
      success: true,

      data: {
        ...client,

        assignedStaffDetails: staffDetails,

        currentStageDetails: stageDetails || null,

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
// =================================================

exports.updateClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const existingClient = await Client.findOne({
      clientId,
    });

    if (!existingClient) {
      return res.status(404).json({
        success: false,

        message: "Client not found.",
      });
    }

    if (!canAccessClient(req, existingClient)) {
      return res.status(403).json({
        success: false,

        message: "You are not authorized to edit this client.",
      });
    }

    if (req.user.role === "staff" && req.body.assignedStaff !== undefined) {
      return res.status(403).json({
        success: false,

        message: "Staff cannot reassign clients.",
      });
    }

    if (
      req.body.currentStage !== undefined &&
      String(req.body.currentStage).trim() !== existingClient.currentStage
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Change the client stage from the Progress section so stage history and payment rules are preserved.",
      });
    }

    const clientUpdates = removeEmptyStrings(
      selectFields(req.body, UPDATE_CLIENT_FIELDS),
    );

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

    Object.assign(existingClient, clientUpdates);

    await existingClient.save();

    const profileUpdates = {
      ...prepareProfileUpdateData(req.body),

      ...getUploadedFiles(req),
    };

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

    const [staffDetails, stageDetails] = await Promise.all([
      findStaffByStaffId(existingClient.assignedStaff),

      ClientStage.findOne({
        key: existingClient.currentStage,
      }).lean(),
    ]);

    return res.status(200).json({
      success: true,

      message: "Client updated successfully.",

      data: {
        ...existingClient.toObject(),

        assignedStaffDetails: staffDetails,

        currentStageDetails: stageDetails || null,

        profile: profile.toObject(),
      },
    });
  } catch (error) {
    console.error("UPDATE CLIENT ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message: "Duplicate data exists.",

        duplicateFields: error.keyValue || {},
      });
    }

    if (error.name === "ValidationError" || error.statusCode === 400) {
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
// ASSIGN CLIENT
// =================================================

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

    if (!staff.isActive) {
      return res.status(400).json({
        success: false,

        message: "Cannot assign a client to an inactive staff member.",
      });
    }

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
// Financial clients should eventually use archive.
// If payments exist, hard deletion is blocked.
// =================================================

exports.deleteClient = async (req, res) => {
  try {
    const clientId = decodeURIComponent(
      String(req.params.clientId || ""),
    ).trim();

    const client = await Client.findOne({
      clientId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,

        message: "Client not found.",
      });
    }

    const paymentCount = await Payment.countDocuments({
      clientId: client.clientId,
    });

    if (paymentCount > 0) {
      return res.status(409).json({
        success: false,

        message:
          "This client has payment records and cannot be permanently deleted. Use archive when archive support is added.",
      });
    }

    await Promise.all([
      Profile.deleteOne({
        clientId: client.clientId,
      }),

      ClientStageHistory.deleteMany({
        clientId: client.clientId,
      }),

      Client.deleteOne({
        _id: client._id,
      }),
    ]);

    return res.status(200).json({
      success: true,

      message: "Client, profile and stage history deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE CLIENT ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to delete client.",
    });
  }
};
