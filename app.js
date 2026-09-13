const dns = require("dns");

dns.setServers(["2400:1a00:8000:4::73"]);

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const profileRoutes = require("./routes/profileRoutes");
const clientRoutes = require("./routes/clientRoutes");
const remarkRoutes = require("./routes/remarkRoutes");
const clientStageRoutes = require("./routes/clientStageRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const clientFeeRoutes = require("./routes/clientFeeRoutes");
const staffTargetRoutes = require("./routes/staffTargetRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

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
// ROUTES
// =================================================

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/remarks", remarkRoutes);
app.use("/api/client-stages", clientStageRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/client-fees", clientFeeRoutes);
app.use("/api/staff-targets", staffTargetRoutes);
app.use("/api/dashboard", dashboardRoutes);
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

const PORT = process.env.PORT || 8001;

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB Atlas");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running successfully on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error);

    process.exit(1);
  }
};

startServer();
