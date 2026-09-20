const Client = require("../model/clientSchema");
const ProfileModule = require("../model/profileSchema");
const Profile = ProfileModule.Profile || ProfileModule;
const Staff = require("../model/staffSchema");
const ClientStage = require("../model/clientStageSchema");
const ClientStageHistory = require("../model/clientStageHistorySchema");
const fs = require("fs");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { findActiveClientStage } = require("../services/clientStageService");
// =================================================
// CREATE CLIENT FIELDS
// =================================================
const CREATE_CLIENT_FIELDS = [
  "fullName",
  "phone",
  "currentVisaStatus",
  "preferCategory",
  "currentStage",
];
// =================================================
// UPDATE CLIENT FIELDS
// Stage changes are handled through Progress.
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
];
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
      const error = new Error(`${fieldName} must be an array.`);
      error.statusCode = 400;
      throw error;
    }
    return parsed;
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
// PROFILE DATA
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
  return profileData;
};
// =================================================
// FILES
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
// STAFF ID
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
// COMMON FILTER PIPELINE
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
          { "currentStageDetails.name": searchRegex },
          { "profile.email": searchRegex },
          { "profile.address": searchRegex },
          { "profile.prefecture": searchRegex },
          { "profile.nationality": searchRegex },
          { "profile.passportNumber": searchRegex },
          { "profile.statusOfResidence": searchRegex },
          { "profile.education.schoolName": searchRegex },
          { "profile.education.educationType": searchRegex },
          { "profile.education.major": searchRegex },
          { "profile.employmentHistory.employmentType": searchRegex },
          { "profile.employmentHistory.companyName": searchRegex },
          { "profile.japaneseLanguageLevel": searchRegex },
          { "profile.intake": searchRegex },
          { "assignedStaffDetails.name": searchRegex },
          { "assignedStaffDetails.email": searchRegex },
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
// =================================================
// DYNAMIC EDUCATION EXPORT
// =================================================
const formatEducationHistory = (education = []) => {
  if (!Array.isArray(education)) {
    return "";
  }
  return education
    .map((item, index) => {
      const values = [
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
      ].filter(Boolean);
      return values.join(" | ");
    })
    .filter(Boolean)
    .join("; ");
};
// =================================================
// DYNAMIC EMPLOYMENT EXPORT
// =================================================
const formatEmploymentHistory = (employmentHistory = []) => {
  if (!Array.isArray(employmentHistory)) {
    return "";
  }
  return employmentHistory
    .map((item, index) => {
      const values = [
        `Employment ${index + 1}`,
        item.companyName ? `Company: ${item.companyName}` : "",
        item.employmentType ? `Type: ${item.employmentType}` : "",
        item.startDate ? `Start: ${formatDate(item.startDate)}` : "",
        item.endDate ? `End: ${formatDate(item.endDate)}` : "",
      ].filter(Boolean);
      return values.join(" | ");
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
    value: (row) => formatDate(row.profile?.dateOfBirth),
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
    value: (row) => formatDate(row.profile?.passportExpiryDate),
  },
  {
    header: "Status of Residence",
    value: (row) => row.profile?.statusOfResidence,
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
    header: "Intake",
    value: (row) => row.profile?.intake,
  },
  {
    header: "Employment History",
    value: (row) => formatEmploymentHistory(row.profile?.employmentHistory),
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
// EXCEL COLUMN
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
  let createdHistory = null;
  try {
    const clientData = selectFields(req.body, CREATE_CLIENT_FIELDS);
    clientData.fullName = String(clientData.fullName || "").trim();
    clientData.phone = String(clientData.phone || "").trim();
    clientData.currentVisaStatus = String(
      clientData.currentVisaStatus || "",
    ).trim();
    clientData.currentStage = String(clientData.currentStage || "").trim();
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
    // VALIDATE STAGE
    // =================================================
    const selectedStage = await findActiveClientStage(clientData.currentStage);
    if (!selectedStage) {
      return res.status(400).json({
        success: false,
        message: "The selected current stage does not exist or is inactive.",
      });
    }
    clientData.currentStage = selectedStage.key;
    clientData.clientStatus = selectedStage.name;
    // =================================================
    // ASSIGN STAFF
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
    // =================================================
    // INITIAL STAGE HISTORY
    // =================================================
    createdHistory = await ClientStageHistory.create({
      clientRef: createdClient._id,
      clientId: createdClient.clientId,
      fromStage: null,
      fromStageName: null,
      toStage: selectedStage.key,
      toStageName: selectedStage.name,
      toStageAmount: selectedStage.amount || 0,
      note: "Initial client stage",
      changedBy: String(req.user.id || req.user.staffId || ""),
      changedByRole: req.user.role,
      staffId: req.user.role === "staff" ? req.user.staffId : null,
      changedByName: req.user.name || "Unknown",
    });
    const staffDetails = await findStaffByStaffId(createdClient.assignedStaff);
    return res.status(201).json({
      success: true,
      message: "Client and profile created successfully.",
      data: {
        ...createdClient.toObject(),
        assignedStaffDetails: staffDetails,
        currentStageDetails: selectedStage,
        profile: createdProfile.toObject(),
        initialStageHistory: createdHistory.toObject(),
      },
    });
  } catch (error) {
    if (createdHistory?._id) {
      await ClientStageHistory.findByIdAndDelete(createdHistory._id).catch(
        () => {},
      );
    }
    if (createdProfile?._id) {
      await Profile.findByIdAndDelete(createdProfile._id).catch(() => {});
    }
    if (createdClient?._id) {
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
    if (error.name === "ValidationError" || error.statusCode === 400) {
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
    // EXCEL
    // =================================================
    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Fortune Link";
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet("Clients");
      const widths = {
        "Client ID": 18,
        "Full Name": 28,
        Phone: 22,
        "Current Visa Status": 35,
        "Preferred Category": 25,
        "Current Stage Key": 28,
        "Current Stage": 35,
        "Current Stage Amount": 22,
        "Assigned Staff ID": 20,
        "Assigned Staff Name": 28,
        "Assigned Staff Email": 35,
        "Assigned Staff Phone": 22,
        "Assigned Staff Location": 22,
        "Date of Birth": 18,
        Gender: 15,
        Email: 35,
        Prefecture: 20,
        Address: 40,
        Nationality: 20,
        "Passport Number": 24,
        "Passport Expiry Date": 22,
        "Status of Residence": 35,
        "Education History": 55,
        "Japanese Language Level": 28,
        Intake: 20,
        "Employment History": 55,
        "Client Image": 40,
        CV: 40,
        "Created At": 25,
        "Updated At": 25,
      };
      worksheet.columns = CLIENT_EXPORT_COLUMNS.map((column, index) => ({
        header: column.header,
        key: `column_${index}`,
        width: widths[column.header] || 22,
      }));
      for (const client of clients) {
        const values = CLIENT_EXPORT_COLUMNS.map((column) => {
          const value = column.value(client);
          if (value === null || value === undefined) {
            return "";
          }
          return String(value);
        });
        worksheet.addRow(values);
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
          const value = cell.value;
          if (value !== null && value !== undefined) {
            cell.value = String(value);
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
    // PDF
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
    // =================================================
    // STAGE CHANGES MUST USE PROGRESS
    // =================================================
    if (
      req.body.currentStage !== undefined &&
      String(req.body.currentStage).trim() !== existingClient.currentStage
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Change the client stage from the Progress section so stage history is preserved.",
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
// TEMPORARY.
// We should replace this with archive before production
// because client financial/history records now exist.
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
