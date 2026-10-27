const {
  getMe,
  updateProfile,
  changePassword,
  requestEmailChange,
} = require("../controllers/user.js");
const auth = require("../middleware/auth.js");
const express = require("express");
const userRouter = express.Router();

userRouter.get("/me", auth, getMe);
userRouter.patch("/profile", auth, updateProfile);
userRouter.patch("/password", auth, changePassword);
userRouter.patch("/email", auth, requestEmailChange);

module.exports = userRouter;
