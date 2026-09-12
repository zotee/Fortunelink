const mongoose = require("mongoose");
const Client = require("../model/clientSchema");
const Payment = require("../model/paymentSchema");
const Staff = require("../model/staffSchema");

const getMonthRange = (value) => {
  const date = value ? new Date(`${value}-01T00:00:00.000Z`) : new Date();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  };
};

const getStaff = async (req, staffId) => {
  if (req.user?.role === "staff") {
    return Staff.findById(req.user.id).select("staffId name").lean();
  }

  if (!staffId) return null;
  return Staff.findOne({ staffId: String(staffId).trim().toUpperCase() })
    .select("staffId name")
    .lean();
};

exports.createPayment = async (req, res) => {
  try {
    const {
      clientId,
      milestone,
      totalCharge,
      amountPaid,
      paymentDate,
      paymentMethod,
      notes,
      staffId,
    } = req.body;

    if (
      !clientId ||
      !milestone ||
      totalCharge === undefined ||
      amountPaid === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "clientId, milestone, totalCharge and amountPaid are required.",
      });
    }

    const charge = Number(totalCharge);
    const paid = Number(amountPaid);
    if (
      !Number.isFinite(charge) ||
      !Number.isFinite(paid) ||
      charge < 0 ||
      paid < 0 ||
      paid > charge
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amounts must be valid and amountPaid cannot exceed totalCharge.",
      });
    }

    const client = await Client.findOne({ clientId: String(clientId).trim() });
    if (!client)
      return res
        .status(404)
        .json({ success: false, message: "Client not found." });

    const staff = await getStaff(req, staffId || client.assignedStaff);
    if (!staff)
      return res
        .status(404)
        .json({
          success: false,
          message: "Responsible staff member not found.",
        });

    if (req.user?.role === "staff" && client.assignedStaff !== staff.staffId) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You can only record payments for your own clients.",
        });
    }

    const payment = await Payment.create({
      client: client._id,
      clientId: client.clientId,
      attributedStaff: staff._id,
      staffId: staff.staffId,
      milestone: String(milestone).trim(),
      totalCharge: charge,
      amountPaid: paid,
      paymentDate: paymentDate || undefined,
      paymentMethod: paymentMethod || "Other",
      receivedBy: req.user?.name || req.user?.email || "System",
      notes: notes || "",
    });

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to create payment.",
      });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const filter = {};
    if (req.user?.role === "staff") {
      const staff = await Staff.findById(req.user.id).select("staffId").lean();
      if (!staff)
        return res
          .status(403)
          .json({ success: false, message: "Staff session is invalid." });
      filter.staffId = staff.staffId;
    } else if (req.query.staffId) {
      filter.staffId = String(req.query.staffId).trim().toUpperCase();
    }

    if (req.query.clientId) filter.clientId = String(req.query.clientId).trim();

    const payments = await Payment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();
    return res
      .status(200)
      .json({ success: true, count: payments.length, data: payments });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: error.message || "Failed to fetch payments.",
      });
  }
};

exports.deletePayment = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid payment ID." });
  }

  const payment = await Payment.findByIdAndDelete(req.params.id);
  if (!payment)
    return res
      .status(404)
      .json({ success: false, message: "Payment not found." });
  return res
    .status(200)
    .json({ success: true, message: "Payment deleted successfully." });
};

exports.getMonthRange = getMonthRange;
