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

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

// ROUTES 
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/remarks", remarkRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});