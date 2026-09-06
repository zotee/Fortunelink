const Remark = require("../model/remarkSchema");
const Profile = require("../model/profileSchema");

// CREATE REMARK
exports.createRemark = async (req, res) => {
  try {
    const { clientId, staffName, remarks, medium } = req.body;

    if (!clientId || !staffName || !remarks || !medium) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const client = await Profile.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const remark = new Remark({
      clientId,
      staffName,
      remarks,
      medium,
    });

    await remark.save();

    return res.status(201).json({
      success: true,
      message: "Remark added successfully",
      data: remark,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// GET CLIENT REMARKS
exports.getClientRemarks = async (req, res) => {
  try {
    const { clientId } = req.params;

    const remarks = await Remark.find({ clientId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: remarks.length,
      data: remarks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// DELETE REMARK
exports.deleteRemark = async (req, res) => {
  try {
    const { id } = req.params;

    const remark = await Remark.findById(id);

    if (!remark) {
      return res.status(404).json({
        success: false,
        message: "Remark not found",
      });
    }

    await Remark.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Remark deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};