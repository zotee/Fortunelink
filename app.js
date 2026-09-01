const express = require("express");
const mongoose = require("mongoose");

const app = express();

// Middleware
app.use(express.json());

// MongoDB connection
mongoose
  .connect("mongodb://127.0.0.1:27017/backend")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Database connection error:", err));

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Server
const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
