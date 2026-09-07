const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Counter = require("./CounterModel");

const staffSchema = new mongoose.Schema(
  {
    staffId: {
      type: String,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      enum: ["USA", "Japan", "Nepal", "Other"],
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ["staff"],
      default: "staff",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

//
// ✅ AUTO GENERATE STAFF ID (FIXED - NO next())
// 
staffSchema.pre("save", async function () {
  if (!this.isNew) return;

  const counter = await Counter.findOneAndUpdate(
    { _id: "StaffId" },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );

  const startValue = 122255;
  this.staffId = `W-${startValue + counter.sequence_value}`;
});

//
// ✅ HASH PASSWORD (FIXED)
//
staffSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
});

//
// ✅ PASSWORD CHECK
//
staffSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("Staff", staffSchema);