const Client = require("../model/clientSchema");
const { Profile } = require("../model/profileSchema");
const fs = require("fs");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const Staff = require("../model/staffSchema");

// =================================================
// CLIENT MODEL FIELDS
// =================================================
const CLIENT_FIELDS = [
  "fullName",
  "phone",
  "currentVisaStatus",
  "preferCategory",
  "currentStage",
  "assignedStaff",
];

// =================================================
// PROFILE MODEL FIELDS
// =================================================
const PROFILE_FIELDS = [
  "dateOfBirth",
  "gender",
  "email",
  "address",
  "prefecture",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
  "statusOfResidence",
  "education",
  "japaneseLanguageLevel",
  "employmentHistory",
  "intake",
  "remark",
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
// PARSE JSON ARRAY FROM MULTIPART FORM DATA
// =================================================
const parseJsonArray = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      const error = new Error(`${fieldName} must be an array.`);
      error.statusCode = 400;
      throw error;
    }

    return parsedValue;
  } catch (error) {
    if (error.statusCode === 400) {
      throw error;
    }

    const parseError = new Error(
      `${fieldName} must contain a valid JSON array.`,
    );
    parseError.statusCode = 400;
    throw parseError;
  }
};

// =================================================
// PREPARE PROFILE DATA
// =================================================
const prepareProfileData = (source) => {
  const profileData = removeEmptyStrings(
    selectFields(source, PROFILE_FIELDS),
  );

  // The client form uses currentVisaStatus, while Profile stores the same
  // value as statusOfResidence. Keep an explicitly submitted
  // statusOfResidence, otherwise copy currentVisaStatus into the profile.
  if (
    profileData.statusOfResidence === undefined &&
    source.currentVisaStatus !== undefined &&
    source.currentVisaStatus !== null &&
    String(source.currentVisaStatus).trim() !== ""
  ) {
    profileData.statusOfResidence = String(
      source.currentVisaStatus,
    ).trim();
  }

  // Accept the frontend/query naming while preserving the Profile schema's
  // existing japaneseLanguageLevel field.
  if (
    profileData.japaneseLanguageLevel === undefined &&
    source.japaneseLevel !== undefined &&
    source.japaneseLevel !== null &&
    String(source.japaneseLevel).trim() !== ""
  ) {
    profileData.japaneseLanguageLevel = String(
      source.japaneseLevel,
    ).trim();
  }

  if (profileData.education !== undefined) {
    profileData.education = parseJsonArray(
      profileData.education,
      "education",
    );
  }

  if (profileData.employmentHistory !== undefined) {
    profileData.employmentHistory = parseJsonArray(
      profileData.employmentHistory,
      "employmentHistory",
    );
  }

  return profileData;
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
// ESCAPE REGEX
// =================================================
const escapeRegex = (value) => {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// =================================================
// EXACT CASE-INSENSITIVE REGEX
// =================================================
const exactRegex = (value) => {
  return {
    $regex: `^${escapeRegex(value)}$`,
    $options: "i",
  };
};

// =================================================
// PARSE CLIENT LIST QUERY
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
// BUILD COMMON CLIENT FILTER PIPELINE
// =================================================
const buildClientFilterPipeline = (req) => {
  const clientFilter = {};

  // =================================================
  // ROLE ACCESS
  // =================================================
  if (req.user.role === "staff") {
    clientFilter.assignedStaff = req.user.staffId;
  }

  if (req.user.role === "superadmin" && req.query.staffId) {
    const staffId = normalizeStaffId(req.query.staffId);

    if (staffId) {
      clientFilter.assignedStaff = staffId;
    }
  }

  // =================================================
  // CURRENT VISA STATUS
  // =================================================
  if (req.query.currentVisaStatus) {
    clientFilter.currentVisaStatus = String(
      req.query.currentVisaStatus,
    ).trim();
  }

  // =================================================
  // PREFERRED CATEGORY
  // =================================================
  if (req.query.preferCategory) {
    clientFilter.preferCategory = String(req.query.preferCategory).trim();
  }

  // =================================================
  // CURRENT STAGE
  // =================================================
  if (req.query.currentStage) {
    clientFilter.currentStage = String(req.query.currentStage).trim();
  }

  // =================================================
  // CLIENT STATUS
  // =================================================
  if (req.query.clientStatus) {
    clientFilter.clientStatus = String(req.query.clientStatus).trim();
  }

  // =================================================
  // PROFILE FILTERS
  // =================================================
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

  // =================================================
  // PIPELINE
  // =================================================
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
  ];

  if (Object.keys(profileFilter).length > 0) {
    pipeline.push({
      $match: profileFilter,
    });
  }

  // =================================================
  // FREE WORD SEARCH
  // =================================================
  const freeWord = String(req.query.free_word || "").trim();

  if (freeWord) {
    const searchRegex = {
      $regex: escapeRegex(freeWord),
      $options: "i",
    };

    pipeline.push({
      $match: {
        $or: [
          {
            clientId: searchRegex,
          },
          {
            fullName: searchRegex,
          },
          {
            phone: searchRegex,
          },
          {
            assignedStaff: searchRegex,
          },
          {
            currentVisaStatus: searchRegex,
          },
          {
            preferCategory: searchRegex,
          },
          {
            currentStage: searchRegex,
          },
          {
            clientStatus: searchRegex,
          },
          {
            "profile.email": searchRegex,
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
            "profile.statusOfResidence": searchRegex,
          },
          {
            "profile.education.schoolName": searchRegex,
          },
          {
            "profile.education.degree": searchRegex,
          },
          {
            "profile.education.educationType": searchRegex,
          },
          {
            "profile.education.major": searchRegex,
          },
          {
            "profile.employmentHistory.employmentType": searchRegex,
          },
          {
            "profile.employmentHistory.companyName": searchRegex,
          },
          {
            "profile.japaneseLanguageLevel": searchRegex,
          },
          {
            "profile.intake": searchRegex,
          },
          {
            "profile.remark": searchRegex,
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

  // Remove password from joined staff information.
  pipeline.push({
    $unset: ["assignedStaffDetails.password"],
  });

  return pipeline;
};

// =================================================
// EXPORT VALUE
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

// =================================================
// PROTECT CSV / EXCEL FROM FORMULA INJECTION
// =================================================
const spreadsheetSafeValue = (value) => {
  let text = normalizeExportValue(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return text;
};

// =================================================
// CSV VALUE
// =================================================
const csvValue = (value) => {
  const safeValue = spreadsheetSafeValue(value);
  const escaped = safeValue.replace(/"/g, '""');

  return `"${escaped}"`;
};

// =================================================
// FORMAT EMPLOYMENT HISTORY FOR EXPORT
// =================================================
const formatEmploymentHistory = (employmentHistory = []) => {
  if (!Array.isArray(employmentHistory)) {
    return "";
  }

  return employmentHistory
    .map((item) => {
      const companyName = normalizeExportValue(item.companyName);
      const employmentType = normalizeExportValue(item.employmentType);
      const startDate = normalizeExportValue(item.startDate);
      const endDate = normalizeExportValue(item.endDate);

      return [companyName, employmentType, startDate, endDate]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean)
    .join("; ");
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
    header: "Phone",
    value: (row) => row.phone,
  },
  {
    header: "Current Visa Status",
    value: (row) => row.currentVisaStatus,
  },
  {
    header: "Preferred Category",
    value: (row) => row.preferCategory,
  },
  {
    header: "Current Stage",
    value: (row) => row.currentStage,
  },
  {
    header: "Client Status",
    value: (row) => row.clientStatus,
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
    header: "Assigned Staff Email",
    value: (row) => row.assignedStaffDetails?.email,
  },
  {
    header: "Assigned Staff Phone",
    value: (row) => row.assignedStaffDetails?.phone,
  },
  {
    header: "Assigned Staff Location",
    value: (row) => row.assignedStaffDetails?.location,
  },
  {
    header: "Date of Birth",
    value: (row) => row.profile?.dateOfBirth,
  },
  {
    header: "Gender",
    value: (row) => row.profile?.gender,
  },
  {
    header: "Email",
    value: (row) => row.profile?.email,
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
    header: "Nationality",
    value: (row) => row.profile?.nationality,
  },
  {
    header: "Passport Number",
    value: (row) => row.profile?.passportNumber,
  },
  {
    header: "Passport Expiry Date",
    value: (row) => row.profile?.passportExpiryDate,
  },
  {
    header: "Status of Residence",
    value: (row) => row.profile?.statusOfResidence,
  },
  {
    header: "School Name",
    value: (row) => row.profile?.education?.schoolName,
  },
  {
    header: "Education Type",
    value: (row) => row.profile?.education?.educationType,
  },
  {
    header: "Education Enrollment Date",
    value: (row) => row.profile?.education?.enrollmentDate,
  },
  {
    header: "Education Graduation Date",
    value: (row) => row.profile?.education?.graduationDate,
  },
  {
    header: "Degree",
    value: (row) => row.profile?.education?.degree,
  },
  {
    header: "Major",
    value: (row) => row.profile?.education?.major,
  },
  {
    header: "Japanese Language Level",
    value: (row) => row.profile?.japaneseLanguageLevel,
  },
  {
    header: "Intake",
    value: (row) => row.profile?.intake,
  },
  {
    header: "Employment History",
    value: (row) => formatEmploymentHistory(row.profile?.employmentHistory),
  },
  {
    header: "Remark",
    value: (row) => row.profile?.remark,
  },
  {
    header: "Client Image",
    value: (row) => row.profile?.clientImage,
  },
  {
    header: "CV",
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
// GET ALL FILTERED CLIENTS FOR EXPORT
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
// EXCEL COLUMN NAME
// =================================================
const getExcelColumnName = (columnNumber) => {
  let number = columnNumber;
  let result = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;

    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
};

// =================================================
// CREATE CLIENT
// =================================================
exports.createClient = async (req, res) => {
  let createdClient = null;
  let createdProfile = null;

  try {
    const clientData = selectFields(req.body, CLIENT_FIELDS);

    clientData.fullName = String(clientData.fullName || "").trim();
    clientData.phone = String(clientData.phone || "").trim();

    // =================================================
    // REQUIRED FIELDS
    // =================================================
    if (
      !clientData.fullName ||
      !clientData.phone ||
      !clientData.currentVisaStatus ||
      !clientData.currentStage
    ) {
      return res.status(400).json({
        success: false,
        message:
          "fullName, phone, currentVisaStatus and currentStage are required.",
      });
    }

    // =================================================
    // SUPERADMIN ASSIGNMENT
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
    // STAFF ASSIGNMENT
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
    // CREATE PROFILE
    // =================================================
    const profileData = prepareProfileData(req.body);

    createdProfile = await Profile.create({
      clientId: createdClient.clientId,
      clientRef: createdClient._id,
      ...profileData,
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

    console.error("CREATE CLIENT ERROR:", error);

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

    if (error.statusCode === 400) {
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
        clientStatus: req.query.clientStatus || null,
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
//
// GET /api/clients/export/csv
// GET /api/clients/export/pdf
// GET /api/clients/export/xlsx
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
    // CSV EXPORT
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
    // EXCEL EXPORT
    // =================================================
    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Fortune Link";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Clients");

      worksheet.columns = CLIENT_EXPORT_COLUMNS.map((column, index) => ({
        header: column.header,
        key: `column_${index}`,
        width: 24,
      }));

      for (const client of clients) {
        const values = CLIENT_EXPORT_COLUMNS.map((column) =>
          spreadsheetSafeValue(column.value(client)),
        );

        worksheet.addRow(values);
      }

      worksheet.getRow(1).font = {
        bold: true,
      };

      worksheet.views = [
        {
          state: "frozen",
          ySplit: 1,
        },
      ];

      const lastColumn = getExcelColumnName(
        CLIENT_EXPORT_COLUMNS.length,
      );

      worksheet.autoFilter = `A1:${lastColumn}1`;

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
    // PDF EXPORT
    // =================================================
    if (format === "pdf") {
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
    }
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

    if (
      req.user.role === "staff" &&
      req.body.assignedStaff !== undefined
    ) {
      return res.status(403).json({
        success: false,
        message: "Staff cannot reassign clients.",
      });
    }

    const clientUpdates = removeEmptyStrings(
      selectFields(req.body, CLIENT_FIELDS),
    );

    // =================================================
    // SUPERADMIN REASSIGNMENT
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

    Object.assign(existingClient, clientUpdates);

    await existingClient.save();

    const profileUpdates = removeEmptyStrings({
      ...prepareProfileData(req.body),
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

    const staffDetails = await findStaffByStaffId(
      existingClient.assignedStaff,
    );

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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate data exists.",
        duplicateFields: error.keyValue || {},
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.statusCode === 400) {
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
// ASSIGN OR REASSIGN CLIENT
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

// UPDATE CLIENT STATUS MANUALLY
// PATCH /api/clients/:clientId/status

exports.updateClientStatus = async (req, res) => {
  try {
    const clientId = String(req.params.clientId || "").trim();
    const { clientStatus } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required",
      });
    }

    if (!clientStatus || clientStatus.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "clientStatus is required",
      });
    }

    const updatedClient = await Client.findOneAndUpdate(
      { clientId },
      { $set: { clientStatus: clientStatus.trim() } },
      {
        returnDocument: "after", // ✅ correct (no deprecation warning)
        runValidators: true,
      }
    );

    if (!updatedClient) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Client status updated manually",
      data: updatedClient,
    });
  } catch (error) {
    console.error("UPDATE CLIENT STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update status",
    });
  }
};