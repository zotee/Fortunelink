const mongoose = require("mongoose");

const forgotSchema = new mongoose.Schema(
  {
    accountId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    accountType: {
      type: String,
      required: true,
      enum: ["admin", "staff"],
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    resetCodeHash: {
      type: String,
      default: null,
      select: false,
    },

    resetCodeExpires: {
      type: Date,
      default: null,
      select: false,
    },

    resetAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    resetTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    resetTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// One active reset request per email.
forgotSchema.index(
  {
    email: 1,
    accountType: 1,
  },
  {
    unique: true,
  },
);

/*
 * Automatically remove expired reset records.
 * MongoDB TTL cleanup is asynchronous and may take a short time.
 */
forgotSchema.index(
  {
    createdAt: 1,
  },
  {
    expireAfterSeconds: 60 * 60,
  },
);

module.exports = mongoose.model(
  "ForgotPassword",
  forgotSchema,
);