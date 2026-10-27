const {
  getResetCode,
  verifyResetPassword,
  resetPassword,
  getMailChangedCode,
  verifyUserEmail,
} = require("../controllers/action.js");
const express = require("express");
const actionRouter = express.Router();

actionRouter.post("/get-reset-code/:email", getResetCode);
actionRouter.post("/verify-reset-password/:email", verifyResetPassword);
actionRouter.post("/reset-password/:email", resetPassword);
actionRouter.post("/get-mail-changed-code/:email", getMailChangedCode);
actionRouter.post("/verify-user-email/:mailer", verifyUserEmail);

module.exports = actionRouter;
