const usermodel = require("../models/user.js");
const bcrypt = require("bcryptjs");
const {
  sendForgotPasswordEmail,
  changeEmail,
} = require("../utils/send-to-email.js");
const { generateCode, codeExpiry } = require("../utils/generate-otp.js");

const codeIsValid = (user, otp) =>
  user.otpExpiry &&
  user.otpExpiry > Date.now() &&
  String(user.otp).trim() === String(otp).trim();

const getResetCode = async (req, res) => {
  const { email } = req.params;
  try {
    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.googleSub || !user.password) {
      return res.status(400).json({
        success: false,
        message: "This account signs in with Google. Use Continue with Google",
      });
    }

    const code = generateCode();
    user.otp = code;
    user.otpExpiry = codeExpiry();
    user.passwordIsForogtten = true;
    await user.save();

    const send = await sendForgotPasswordEmail(user.email, code, user.userName);
    if (!send.success) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to send the reset code" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Reset code sent to your email" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const verifyResetPassword = async (req, res) => {
  const { email } = req.params;
  const { otp } = req.body;
  if (!otp) {
    return res.status(400).json({ success: false, message: "OTP is required" });
  }
  try {
    const user = await usermodel.findOne({ email });
    if (!user || !user.passwordIsForogtten) {
      return res
        .status(400)
        .json({ success: false, message: "No password reset was requested" });
    }
    if (!codeIsValid(user, otp)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired code" });
    }

    user.otp = null;
    user.otpExpiry = null;
    user.resetAllowedUntil = codeExpiry();
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Code confirmed, set a new password" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { email } = req.params;
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });
  }
  try {
    const user = await usermodel.findOne({ email });
    if (
      !user ||
      !user.resetAllowedUntil ||
      user.resetAllowedUntil < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "Reset time ran out, request a new code",
      });
    }

    user.password = await bcrypt.hash(password, 12);
    user.passwordIsForogtten = false;
    user.resetAllowedUntil = null;
    user.token = null;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password changed, log in now" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMailChangedCode = async (req, res) => {
  const { email } = req.params;
  try {
    const user = await usermodel.findOne({
      changeEmail: email,
      emailIsChanging: true,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No email change was requested" });
    }

    const code = generateCode();
    user.otp = code;
    user.otpExpiry = codeExpiry();
    await user.save();

    const send = await changeEmail(email, code, user.userName);
    if (!send.success) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to send the code" });
    }

    return res
      .status(200)
      .json({ success: true, message: `Code sent to ${email}` });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const verifyUserEmail = async (req, res) => {
  const { mailer } = req.params;
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Email and OTP are required" });
  }
  try {
    const user = await usermodel.findOne({
      email: mailer,
      changeEmail: email,
      emailIsChanging: true,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No email change was requested" });
    }
    if (!codeIsValid(user, otp)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired code" });
    }
    if (await usermodel.exists({ email })) {
      return res
        .status(409)
        .json({ success: false, message: "That email is already in use" });
    }

    user.email = email;
    user.changeEmail = null;
    user.emailIsChanging = false;
    user.otp = null;
    user.otpExpiry = null;
    user.token = null;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Email changed, log in again" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getResetCode,
  verifyResetPassword,
  resetPassword,
  getMailChangedCode,
  verifyUserEmail,
};
