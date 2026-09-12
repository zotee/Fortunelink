const Staff = require("../model/staffSchema");
const Payment = require("../model/paymentSchema");

const calculateProgress = (totalTarget, totalCollected) => {
  if (!totalTarget) {
    return 0;
  }

  return Math.round((totalCollected / totalTarget) * 100);
};

exports.getPerformanceSummary = async (req, res) => {
  try {
    const filter = req.user?.role === "staff" ? { _id: req.user.id } : {};

    const staffMembers = await Staff.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);

    const collections = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfMonth, $lt: endOfMonth },
          ...(req.user?.role === "staff"
            ? { staffId: staffMembers[0]?.staffId }
            : {}),
        },
      },
      { $group: { _id: "$staffId", collected: { $sum: "$amountPaid" } } },
    ]);
    const collectionMap = new Map(
      collections.map((item) => [item._id, item.collected]),
    );

    const staff = staffMembers.map((member) => {
      const target = Number(member.monthlyTarget ?? 500000);
      const collected = Number(collectionMap.get(member.staffId) ?? 0);

      return {
        staffId: member.staffId,
        name: member.name,
        target,
        collected,
      };
    });

    const totalTarget = staff.reduce((sum, item) => sum + item.target, 0);
    const totalCollected = staff.reduce((sum, item) => sum + item.collected, 0);

    return res.status(200).json({
      success: true,
      data: {
        staff,
        totalTarget,
        totalCollected,
        overallProgress: calculateProgress(totalTarget, totalCollected),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch performance data.",
    });
  }
};
