const mongoose = require("mongoose");
const Counter = require("./CounterModel");

const profileSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      unique: true,
    },

    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },

    nationality: { type: String, default: "Nepali" },

    passportNumber: { type: String, trim: true },
    passportExpiryDate: { type: Date },

    visaType: {
      type: String,
      required: true,
      enum: ["Student", "Working", "Dependent"],
    },

    statusOfResidence: String,
    lastQualification: String,
    japaneseLanguageLevel: String,

    schoolName: String,
    course: String,
    intake: String,

    jobCategory: String,
    jobTitle: String,
    companyName: String,
    workLocation: String,

    sponsorName: String,
    sponsorRelationship: String,
    sponsorStatusOfResidence: String,

    coeStatus: {
      type: String,
      enum: ["Not Applied", "Applied", "Processing", "Received", "Rejected"],
      default: "Not Applied",
    },

    visaStatus: {
      type: String,
      enum: ["Not Applied", "Applied", "Processing", "Approved", "Rejected"],
      default: "Not Applied",
    },

    clientStatus: {
      type: String,
      enum: [
        "New",
        "Document Collection",
        "Processing",
        "COE Applied",
        "COE Received",
        "Visa Applied",
        "Visa Approved",
        "Visa Rejected",
        "Departed",
        "Arrived in Japan",
      ],
      default: "New",
    },

    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },

    clientImage: String,
    cv: String,
  },
  { timestamps: true }
);

//
// ✅ AUTO GENERATE SAME CLIENT ID SYSTEM
//
profileSchema.pre("save", async function () {
  if (!this.isNew) return;

  const counter = await Counter.findOneAndUpdate(
    { _id: "ClientId" },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );

  this.clientId = `J-${counter.sequence_value}`;
});

module.exports = mongoose.model("Profile", profileSchema);