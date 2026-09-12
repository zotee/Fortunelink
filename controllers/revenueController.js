const Staff = require("../model/staffSchema");
const Payment = require("../model/paymentSchema");

const calculateBalance = (billed, collected) => Math.max(billed - collected, 0);

exports.getRevenueSummary = async (req, res) => {
  try {
    const staffFilter = req.user?.role === "staff" ? { _id: req.user.id } : {};
    const staffMembers = await Staff.find(staffFilter)
      .select("-password")
      .lean();
    const staffMap = new Map(
      staffMembers.map((staff) => [staff.staffId, staff]),
    );
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
    const paymentFilter = {
      paymentDate: { $gte: startOfMonth, $lt: endOfMonth },
      ...(req.user?.role === "staff"
        ? { staffId: staffMembers[0]?.staffId }
        : {}),
    };
    const payments = await Payment.find(paymentFilter)
      .sort({ paymentDate: -1 })
      .lean();

    const milestones = payments.map((payment) => ({
      id: String(payment._id),
      clientName: payment.clientId,
      clientId: payment.clientId,
      milestone: payment.milestone,
      totalCharge: payment.totalCharge,
      amountPaid: payment.amountPaid,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      receivedBy:
        payment.receivedBy || staffMap.get(payment.staffId)?.name || "System",
      status:
        payment.amountPaid >= payment.totalCharge
          ? "Paid"
          : payment.amountPaid > 0
            ? "Partial"
            : "Unpaid",
    }));

    const summary = milestones.reduce(
      (result, milestone) => ({
        totalBilled: result.totalBilled + milestone.totalCharge,
        totalCollected: result.totalCollected + milestone.amountPaid,
        totalOutstanding:
          result.totalOutstanding +
          calculateBalance(milestone.totalCharge, milestone.amountPaid),
      }),
      { totalBilled: 0, totalCollected: 0, totalOutstanding: 0 },
    );

    return res.status(200).json({
      success: true,
      data: {
        milestones,
        summary,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch revenue data.",
    });
  }
};
