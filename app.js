require("dotenv").config();

const dns = require("dns");

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const profileRoutes = require("./routes/profileRoutes");
const clientRoutes = require("./routes/clientRoutes");
const remarkRoutes = require("./routes/remarkRoutes");
const clientStageRoutes = require("./routes/clientStageRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const staffTargetRoutes = require("./routes/staffTargetRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const createAdmin = require("./scripts/createAdmin");
const stageRoutes = require("./routes/stageRoutes");
const app = express();
const multer = require("multer");
const forgotRoutes = require("./routes/forgotRoutes");


// =================================================
// REQUIRED ENVIRONMENT VARIABLES
// =================================================

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
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
    origin: function (origin, callback) {
      // Allow Postman/server-to-server requests without origin
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// =================================================
// BODY PARSERS
// =================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =================================================
// STATIC UPLOADS
// =================================================

app.use(
  "/uploads",
  express.static(
    path.join(process.cwd(), "uploads"),
  ),
);


app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err instanceof multer.MulterError) {
    let message = err.message;

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size must not exceed 10 MB";
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      message = "Too many files uploaded";
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message =
        typeof err.field === "string" &&
        err.field.includes("must be")
          ? err.field
          : `Invalid or unexpected file: ${err.field}`;
    }
return res.status(400).json({
      success: false,
      message,
      code: err.code,
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});


// =================================================
// ROUTES
// =================================================

app.use("/api/auth", authRoutes);
app.use("/api", forgotRoutes);
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
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// =================================================
// ERROR HANDLER
// =================================================

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
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