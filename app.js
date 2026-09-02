require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const staffRoutes = require("./routes/staffRoutes");
const profileRoutes = require("./routes/profileRoutes");
const clientRoutes = require("./routes/clientRoutes");
const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json()); // no need for body-parser anymore

// MongoDB connection
mongoose
  .connect("mongodb://127.0.0.1:27017/backend")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Database connection error:", err));

// Routes
app.use("/api", authRoutes);   // super admin login
app.use("/api", staffRoutes);  // staff APIs
app.use("/api", profileRoutes); // profile APIs
app.use("/api", clientRoutes);  // client APIs

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Internal Server Error",
  });
});

// Start server
const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});