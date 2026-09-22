require("dotenv").config();

const dns = require("dns");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

// =================================================
// DNS
// =================================================

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

// =================================================
// ROUTES
// =================================================

const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const profileRoutes = require("./routes/profileRoutes");
const clientRoutes = require("./routes/clientRoutes");
const remarkRoutes = require("./routes/remarkRoutes");
const clientStageRoutes = require("./routes/clientStageRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const staffTargetRoutes = require("./routes/staffTargetRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const stageRoutes = require("./routes/stageRoutes");

// =================================================
// SCRIPTS
// =================================================

const createAdmin = require("./scripts/createAdmin");

// =================================================
// EXPRESS APP
// =================================================

const app = express();

// =================================================
// REQUIRED ENVIRONMENT VARIABLES
// =================================================

const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(
      `Missing required environment variable: ${key}`,
    );

    process.exit(1);
  }
}

// =================================================
// CORS
// =================================================

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow Postman and server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const corsError = new Error(
        `Origin ${origin} is not allowed by CORS.`,
      );

      corsError.status = 403;

      return callback(corsError);
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  }),
);

// =================================================
// BODY PARSERS
// =================================================

app.use(
  express.json({
    limit: "10mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

// =================================================
// STATIC UPLOADS
// =================================================

app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), "uploads"),
  ),
);

// =================================================
// API ROUTES
// =================================================

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/remarks", remarkRoutes);
app.use("/api/client-stages", clientStageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/staff-targets", staffTargetRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/stages", stageRoutes);

// =================================================
// HEALTH CHECK
// =================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// =================================================
// ROUTE NOT FOUND
// Must be after all valid routes.
// =================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =================================================
// GLOBAL ERROR HANDLER
// Must be the final Express middleware.
// =================================================

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  // -----------------------------------------------
  // Multer errors
  // -----------------------------------------------

  if (err instanceof multer.MulterError) {
    let message = err.message;

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size must not exceed 10 MB.";
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      message = "Too many files were uploaded.";
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message =
        typeof err.field === "string" &&
        err.field.includes("must be")
          ? err.field
          : `Invalid or unexpected file: ${
              err.field || "unknown"
            }.`;
    }

    return res.status(400).json({
      success: false,
      message,
      code: err.code,
    });
  }

  // -----------------------------------------------
  // Invalid JSON
  // -----------------------------------------------

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body.",
    });
  }

  // -----------------------------------------------
  // Mongoose validation
  // -----------------------------------------------

  if (err.name === "ValidationError") {
    const errors = Object.values(
      err.errors || {},
    ).map((item) => item.message);

    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors,
    });
  }

  // -----------------------------------------------
  // Duplicate MongoDB value
  // -----------------------------------------------

  if (err.code === 11000) {
    const duplicateFields = Object.keys(
      err.keyPattern || err.keyValue || {},
    );

    return res.status(409).json({
      success: false,
      message:
        duplicateFields.length > 0
          ? `${duplicateFields.join(", ")} already exists.`
          : "A record with the same value already exists.",
    });
  }

  // -----------------------------------------------
  // Invalid MongoDB ID/value
  // -----------------------------------------------

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${err.path}.`,
    });
  }

  // -----------------------------------------------
  // Other application errors
  // -----------------------------------------------

  const requestedStatus =
    err.statusCode || err.status;

  const statusCode =
    Number.isInteger(requestedStatus) &&
    requestedStatus >= 400 &&
    requestedStatus < 600
      ? requestedStatus
      : 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal Server Error"
        : err.message || "Request failed.",
  });
});

// =================================================
// SERVER
// =================================================

const PORT = Number(process.env.PORT) || 8001;

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB Atlas");

    // Ensure the initial superadmin exists.
    await createAdmin();

    /*
     * No stage seeding is executed here.
     * Stages are created manually by the superadmin.
     */
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Server running successfully on port ${PORT}`,
      );
    });
  } catch (error) {
    console.error("Server startup failed:");
    console.error(error);

    process.exit(1);
  }
};

startServer();