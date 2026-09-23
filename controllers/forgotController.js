const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const ForgotPassword = require("../model/forgotSchema");
const Staff = require("../model/staffSchema");
const Admin = require("../model/adminModel");

const sendEmail = require("../utils/send-email");

// =================================================
// CONSTANTS
// =================================================

const OTP_EXPIRY_MINUTES = 10;
const RESET_TOKEN_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

// =================================================
// HELPERS
// =================================================

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const hashValue = (value) => {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
};

const findAccountByEmail = async (email) => {
  /*
   * Check Admin first, then Staff.
   * This assumes the same email should not represent both accounts.
   */
  const admin = await Admin.findOne({
    email,
  }).lean();

  if (admin) {
    return {
      account: admin,
      accountId: String(
        admin.adminId ||
          admin._id,
      ),
      accountType: "admin",
    };
  }

  const staff = await Staff.findOne({
    email,
  }).lean();

  if (staff) {
    return {
      account: staff,
      accountId: String(
        staff.staffId ||
          staff._id,
      ),
      accountType: "staff",
    };
  }

  return null;
};

const updateAccountPassword = async ({
  accountId,
  accountType,
  hashedPassword,
}) => {
  if (accountType === "staff") {
    /*
     * Staff is normally identified by staffId.
     * updateOne avoids triggering the password hashing hook again.
     */
    const result = await Staff.updateOne(
      {
        staffId: accountId,
      },
      {
        $set: {
          password: hashedPassword,
        },
      },
    );

    return result.matchedCount === 1;
  }

  if (accountType === "admin") {
    /*
     * Support either a custom adminId or MongoDB _id.
     */
    let result;

    if (accountId.match(/^[a-f\d]{24}$/i)) {
      result = await Admin.updateOne(
        {
          _id: accountId,
        },
        {
          $set: {
            password: hashedPassword,
          },
        },
      );
    } else {
      result = await Admin.updateOne(
        {
          adminId: accountId,
        },
        {
          $set: {
            password: hashedPassword,
          },
        },
      );
    }

    return result.matchedCount === 1;
  }

  return false;
};

// =================================================
// FORGOT PASSWORD
//
// POST /api/forgot/forgot-password
// BODY: { "email": "user@example.com" }
// =================================================

exports.forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(
      req.body.email,
    );

    if (!normalizedEmail) {
      return res.status(400).json({
        status: "error",
        message: "Email is required.",
      });
    }

    const accountResult =
      await findAccountByEmail(normalizedEmail);

    /*
     * Always return the same response when an account does
     * not exist to prevent email/account enumeration.
     */
    if (!accountResult) {
      return res.status(200).json({
        status: "success",
        message:
          "If the email exists, a password reset OTP has been sent.",
      });
    }

    const {
      accountId,
      accountType,
    } = accountResult;

    const code = crypto
      .randomInt(100000, 1000000)
      .toString();

    const resetCodeHash = hashValue(code);

    const resetCodeExpires = new Date(
      Date.now() +
        OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    const resetRecord =
      await ForgotPassword.findOneAndUpdate(
        {
          email: normalizedEmail,
          accountType,
        },
        {
          $set: {
            accountId,
            email: normalizedEmail,
            accountType,
            resetCodeHash,
            resetCodeExpires,
            resetAttempts: 0,
            resetTokenHash: null,
            resetTokenExpires: null,
          },
        },
        {
          returnDocument: "after",
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Password Reset OTP",
        text:
          `Your password reset OTP is ${code}. ` +
          `It is valid for ${OTP_EXPIRY_MINUTES} minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Password Reset</h2>
            <p>Your password reset OTP is:</p>
            <p style="font-size: 26px; font-weight: 700;">
              ${code}
            </p>
            <p>
              This OTP is valid for
              ${OTP_EXPIRY_MINUTES} minutes.
            </p>
            <p>
              If you did not request this reset,
              you can ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      await ForgotPassword.deleteOne({
        _id: resetRecord._id,
      });

      console.error(
        "PASSWORD RESET EMAIL ERROR:",
        emailError,
      );

      return res.status(500).json({
        status: "error",
        message:
          "The reset email could not be sent. Please try again.",
      });
    }

    return res.status(200).json({
      status: "success",
      message:
        "If the email exists, a password reset OTP has been sent.",
    });
  } catch (error) {
    console.error(
      "FORGOT PASSWORD ERROR:",
      error,
    );

    return res.status(500).json({
      status: "error",
      message: "Failed to process password reset.",
    });
  }
};

// =================================================
// VERIFY OTP
//
// POST /api/forgot/verify-reset-code
// BODY:
// {
//   "email": "user@example.com",
//   "code": "123456"
// }
// =================================================

exports.verifyResetCode = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(
      req.body.email,
    );

    const code = String(
      req.body.code || "",
    ).trim();

    if (!normalizedEmail || !code) {
      return res.status(400).json({
        status: "error",
        message: "Email and OTP are required.",
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        status: "error",
        message: "OTP must contain exactly 6 digits.",
      });
    }

    const record =
      await ForgotPassword.findOne({
        email: normalizedEmail,
      }).select(
        "+resetCodeHash +resetCodeExpires +resetAttempts",
      );

    if (!record || !record.resetCodeHash) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid or expired password reset request.",
      });
    }

    if (
      !record.resetCodeExpires ||
      record.resetCodeExpires.getTime() <=
        Date.now()
    ) {
      await ForgotPassword.deleteOne({
        _id: record._id,
      });

      return res.status(400).json({
        status: "error",
        message: "OTP has expired.",
      });
    }

    if (
      record.resetAttempts >=
      MAX_OTP_ATTEMPTS
    ) {
      await ForgotPassword.deleteOne({
        _id: record._id,
      });

      return res.status(429).json({
        status: "error",
        message:
          "Too many invalid attempts. Request a new OTP.",
      });
    }

    const providedCodeHash = hashValue(code);

    const storedHashBuffer = Buffer.from(
      record.resetCodeHash,
      "hex",
    );

    const providedHashBuffer = Buffer.from(
      providedCodeHash,
      "hex",
    );

    const codeMatches =
      storedHashBuffer.length ===
        providedHashBuffer.length &&
      crypto.timingSafeEqual(
        storedHashBuffer,
        providedHashBuffer,
      );

    if (!codeMatches) {
      record.resetAttempts += 1;

      await record.save({
        validateBeforeSave: false,
      });

      const attemptsRemaining =
        MAX_OTP_ATTEMPTS -
        record.resetAttempts;

      return res.status(400).json({
        status: "error",
        message: "Invalid OTP.",
        attemptsRemaining: Math.max(
          attemptsRemaining,
          0,
        ),
      });
    }

    const resetToken = crypto
      .randomBytes(32)
      .toString("hex");

    record.resetTokenHash =
      hashValue(resetToken);

    record.resetTokenExpires = new Date(
      Date.now() +
        RESET_TOKEN_EXPIRY_MINUTES *
          60 *
          1000,
    );

    record.resetCodeHash = null;
    record.resetCodeExpires = null;
    record.resetAttempts = 0;

    await record.save({
      validateBeforeSave: false,
    });

    return res.status(200).json({
      status: "success",
      message: "OTP verified successfully.",
      reset_token: resetToken,
    });
  } catch (error) {
    console.error(
      "VERIFY RESET CODE ERROR:",
      error,
    );

    return res.status(500).json({
      status: "error",
      message: "Failed to verify OTP.",
    });
  }
};

// =================================================
// RESET PASSWORD
//
// POST /api/forgot/reset-password
// BODY:
// {
//   "reset_token": "...",
//   "password": "NewPassword123",
//   "confirm_password": "NewPassword123"
// }
// =================================================

exports.resetPassword = async (req, res) => {
  try {
    const {
      reset_token,
      password,
      confirm_password,
    } = req.body;

    if (
      !reset_token ||
      !password ||
      !confirm_password
    ) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required.",
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        status: "error",
        message: "Passwords do not match.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message:
          "Password must contain at least 8 characters.",
      });
    }

    const resetTokenHash =
      hashValue(reset_token);

    const record =
      await ForgotPassword.findOne({
        resetTokenHash,
        resetTokenExpires: {
          $gt: new Date(),
        },
      }).select(
        "+resetTokenHash +resetTokenExpires",
      );

    if (!record) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid or expired reset token.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12,
    );

    const accountUpdated =
      await updateAccountPassword({
        accountId: record.accountId,
        accountType: record.accountType,
        hashedPassword,
      });

    if (!accountUpdated) {
      await ForgotPassword.deleteOne({
        _id: record._id,
      });

      return res.status(404).json({
        status: "error",
        message: "Account not found.",
      });
    }

    await ForgotPassword.deleteOne({
      _id: record._id,
    });

    return res.status(200).json({
      status: "success",
      message:
        "Password reset successfully.",
    });
  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error,
    );

    return res.status(500).json({
      status: "error",
      message: "Failed to reset password.",
    });
  }
};