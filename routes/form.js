const {
  signup,
  login,
  getCode,
  verifyToken,
  userExist,
  verifyOTP,
  verifyGoogleToken,
} = require("../controllers/form.js");
const express = require("express");
const formRouter = express.Router();

formRouter.post("/signup", signup);
formRouter.post("/send-verify-email", getCode);
formRouter.post("/verify-otp", verifyOTP);
formRouter.post("/login", login);
formRouter.post("/verify-token", verifyToken);
formRouter.post("/auth/google", verifyGoogleToken);
formRouter.get("/get-email-exist/:email", userExist);

module.exports = formRouter;
