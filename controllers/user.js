const usermodel = require("../models/user.js");
const bcrypt = require("bcryptjs");
const publicUser = require("../utils/public-user.js");
const uploadFile = require("../utils/upload.js");
const { changeEmail } = require("../utils/send-to-email.js");
const { generateCode, codeExpiry } = require("../utils/generate-otp.js");

const getMe = async (req, res) => {
  return res
    .status(200)
    .json({ success: true, message: "Profile", data: publicUser(req.user) });
};

const updateProfile = async (req, res) => {
  const { userName, bio, age, image } = req.body;
  try {
    const user = req.user;

    if (userName !== undefined) {
      if (!userName.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Name can't be empty" });
      }
      user.userName = userName.trim();
    }

    if (bio !== undefined) user.bio = String(bio).trim().slice(0, 300);

    if (age !== undefined) {
      const parsedAge = Number(age);
      if (Number.isNaN(parsedAge) || parsedAge < 13 || parsedAge > 99) {
        return res
          .status(400)
          .json({ success: false, message: "Select a valid age" });
      }
      user.age = parsedAge;
    }

    if (image) {
      user.profileImage = await uploadFile(image, "cineverse/users");
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: publicUser(user),
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not update profile" });
  }
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 8 characters",
    });
  }
  try {
    const user = req.user;

    if (user.googleSub || !user.password) {
      return res.status(400).json({
        success: false,
        message: "This account signs in with Google, so it has no password",
      });
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(oldPassword || "", user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Current password is wrong" });
      }
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password changed" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const requestEmailChange = async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res
      .status(400)
      .json({ success: false, message: "Enter a valid email" });
  }
  try {
    const user = req.user;

    if (user.googleSub) {
      return res.status(400).json({
        success: false,
        message: "Google accounts use the Google email",
      });
    }
    if (email === user.email) {
      return res
        .status(400)
        .json({ success: false, message: "That is already your email" });
    }
    if (await usermodel.exists({ email })) {
      return res
        .status(409)
        .json({ success: false, message: "That email is already in use" });
    }

    const code = generateCode();
    user.changeEmail = email;
    user.emailIsChanging = true;
    user.otp = code;
    user.otpExpiry = codeExpiry();
    await user.save();

    const send = await changeEmail(email, code, user.userName);
    if (!send.success) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to send the code" });
    }

    return res.status(200).json({
      success: true,
      message: `Code sent to ${email}`,
      data: { email, mailer: user.email },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getMe, updateProfile, changePassword, requestEmailChange };
