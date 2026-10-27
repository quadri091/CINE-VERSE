const usermodel = require("../models/user.js");
const { OAuth2Client } = require("google-auth-library");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const client = new OAuth2Client(
  process.env.googleClientId,
  process.env.googleClientSecret,
  "postmessage",
);
const { sendEmail } = require("../utils/send-to-email.js");
const publicUser = require("../utils/public-user.js");
const generateOTP = require("otp-generator");
const CLIENT_ID = process.env.googleClientId;

const TOKEN_LIFE = 60 * 60 * 24 * 7;

const signupInfo = (user) => ({
  ...publicUser(user),
  banned: user.banned,
  suspendedUntil: user.suspendedUntil,
  createdAt: user.createdAt,
});
const generate = async () => {
  const code = generateOTP.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  return code;
};

const makeToken = (user) =>
  jwt.sign({ email: user.email, id: user._id }, process.env.jwtSecretKey, {
    expiresIn: TOKEN_LIFE,
  });

const blockedMessage = (user) => {
  if (user.banned) return "User has been banned";
  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    return `User has been suspended till ${user.suspendedUntil.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}`;
  }
  return null;
};

const userExist = async (req, res) => {
  const { email } = req.params;

  try {
    const user = await usermodel.findOne({ email });

    return res.status(200).json({
      success: true,
      message: "Check complete",
      data: user ? { email: user.email, google: !!user.googleSub } : null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const verifyGoogleToken = async (req, res) => {
  const { idToken, age } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: "Missing Google token" });
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.log("Google token verification failed:", error.message);
    console.log("Expected audience (CLIENT_ID):", CLIENT_ID);
    return res
      .status(401)
      .json({ message: "Invalid Google Token", error: error.message });
  }

  try {
    const { sub: userId, email, name, picture: profileImage } = payload;

    let user = await usermodel.findOne({ email });

    if (user && user.googleSub == null) {
      return res.status(400).json({ message: "Sign in manually" });
    }

    if (user?.emailIsChanging) {
      return res.status(400).json({
        data: user.changeEmail,
        mailer: user.email,
        message: `Confirm the email ${user.changeEmail} which you changed`,
        status: "email-changed",
      });
    }

    if (user?.passwordIsForogtten) {
      return res.status(400).json({
        data: user.email,
        message: `Confirm the otp code for changing your password`,
        status: "password-otp",
      });
    }

    if (user) {
      const blocked = blockedMessage(user);
      if (blocked) return res.status(403).json({ message: blocked });
    }

    const io = req.app.get("io");
    let isNewUser = false;

    if (!user) {
      const parsedAge = Number(age);
      if (!age || Number.isNaN(parsedAge) || parsedAge < 13 || parsedAge > 99) {
        return res.status(400).json({ message: "Select your age" });
      }

      isNewUser = true;

      const newUserData = {
        email,
        userName: name,
        profileImage,
        googleSub: userId,
        verified: true,
        age: parsedAge,
      };

      try {
        user = await usermodel.create(newUserData);
      } catch (error) {
        console.log(error);

        if (error.code === 11000) {
          const field = Object.keys(error.keyPattern || {})[0] || "field";
          return res.status(409).json({
            message: `An account with this email already exists`,
            field,
          });
        }

        return res
          .status(400)
          .json({ message: "Failed to create user", error: error.message });
      }
    }

    const token = makeToken(user);
    user.token = token;
    await user.save();

    if (isNewUser && io) {
      io.to("admins").emit("new:signup", signupInfo(user));
    }

    return res.status(200).json({
      success: true,
      message: isNewUser ? "Welcome to Cine Verse" : "Login Successful",
      data: { ...publicUser(user), token },
    });
  } catch (error) {
    console.log("Google login failed after verification:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

const signup = async (req, res) => {
  const { email, password, userName, age } = req.body;
  if (!email || !password || !userName || !age) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existingUser = await usermodel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const code = await generate();

    const user = await usermodel.create({
      email,
      password: hashedPassword,
      userName,
      otp: code,
      age,
      role: "user",
      otpExpiry: Date.now() + 10 * 60 * 1000,
    });

    const emailResult = await sendEmail(user.email, code, user.userName);
    if (!emailResult.success) {
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    const io = req.app.get("io");
    io.to("admins").emit("new:signup", signupInfo(user));

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email for verification",
      email: user.email,
      status: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicatedField = Object.keys(error.keyPattern)[0];

      if (duplicatedField === "email") {
        return res
          .status(400)
          .json({ message: "This email address is already registered." });
      }
    }
    console.log(error);

    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    let user = await usermodel.findOne({ email });
    if (!user) {
      user = await usermodel.findOne({ changeEmail: email });
    }
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.verified) {
      return res.status(400).json({
        message: "Please verify your email first",
        status: "not-verified",
      });
    }

    if (user.emailIsChanging) {
      return res.status(400).json({
        data: user.changeEmail,
        mailer: user.email,
        message: `Confirm the email ${user.changeEmail} which you changed`,
        status: "email-changed",
      });
    }

    if (user.passwordIsForogtten) {
      return res.status(400).json({
        data: user.email,
        message: `Confirm the otp code for changing your password`,
        status: "password-otp",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message: "Please Sign In with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const blocked = blockedMessage(user);
    if (blocked) return res.status(403).json({ message: blocked });

    const token = makeToken(user);
    user.token = token;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login Successful",
      status: true,
      data: { ...publicUser(user), token },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};
const getCode = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  try {
    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.googleSub) {
      return res
        .status(400)
        .json({ message: "Please Sign In with google instead" });
    }
    const code = await generate();
    user.otp = code;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    const send = await sendEmail(user.email, code, user.userName);
    if (!send.success) {
      console.log(send.text);
      return res.status(400).json({ message: "Failed to send OTP email" });
    }

    return res.status(200).json({
      success: true,
      status: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }
  try {
    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.otpExpiry || user.otpExpiry < Date.now()) {
      user.otp = null;
      user.otpExpiry = null;
      await user.save();

      return res.status(400).json({ message: "OTP has expired" });
    }

    if (String(user.otp).trim() !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.verified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    const io = req.app.get("io");
    io.to("admins").emit("new:updated", signupInfo(user));

    return res.status(200).json({
      success: true,
      message: "Email verified, you can log in now",
      status: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server Error" });
  }
};

const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token is required" });
    const decoded = jwt.verify(token, process.env.jwtSecretKey);

    const user = await usermodel.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const blocked = blockedMessage(user);
    if (blocked) return res.status(403).json({ message: blocked });

    return res.status(200).json({
      success: true,
      message: "Token is valid",
      data: { ...publicUser(user), token },
    });
  } catch (error) {
    return res.status(401).json({ message: "Session expired, log in again" });
  }
};

module.exports = {
  signup,
  login,
  getCode,
  userExist,
  verifyToken,
  verifyOTP,
  verifyGoogleToken,
};
