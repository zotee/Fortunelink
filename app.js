const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const profileRoutes = require("./routes/profileRoutes");
const clientRoutes = require("./routes/clientRoutes");
const remarkRoutes = require("./routes/remarkRoutes");

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
  );

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROUTES
// =====================================
// DATABASE CONNECTION
// =====================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Connected to MongoDB");

    // Drop old counters collection once (because schema changed)
    // You can comment this out after running successfully one time
    try {
      await mongoose.connection.db.collection("counters").drop();
      console.log("Old counters collection dropped successfully");
    } catch (err) {
      // Collection might not exist — ignore the error
      console.log("Counters collection already clean or does not exist");
    }
  })
  .catch((err) => console
  .log("MongoDB connection error:", err));

// =====================================
// ROUTES
// =====================================
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/remarks", remarkRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

// =====================================
// ERROR HANDLER
// =====================================
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

const PORT = process.env.PORT || 8001;


const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB Atlas");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running successfully on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error);
    process.exit(1);
  }
};

startServer();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

