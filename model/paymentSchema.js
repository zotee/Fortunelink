const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    clientId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    attributedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },

    staffId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    milestone: {
      type: String,
      required: true,
      trim: true,
    },

    totalCharge: {
      type: Number,
      required: true,
      min: 0,
    },

    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Card", "Online", "Other"],
      default: "Other",
    },

    receivedBy: {
      type: String,
      required: true,
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

paymentSchema.virtual("balance").get(function () {
  return Math.max(this.totalCharge - this.amountPaid, 0);
});

paymentSchema.virtual("status").get(function () {
  if (this.amountPaid >= this.totalCharge) return "Paid";
  if (this.amountPaid > 0) return "Partial";
  return "Unpaid";
});

paymentSchema.set("toJSON", { virtuals: true });
paymentSchema.set("toObject", { virtuals: true });
paymentSchema.index({ staffId: 1, paymentDate: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
