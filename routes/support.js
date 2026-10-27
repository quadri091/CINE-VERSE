const {
  createSupport,
  getSupport,
  replySupport,
} = require("../controllers/support.js");
const auth = require("../middleware/auth.js");
const role = require("../middleware/role.js");
const express = require("express");
const supportRouter = express.Router();

supportRouter.post("/", auth, createSupport);
supportRouter.get("/admin", auth, role("admin"), getSupport);
supportRouter.post("/:id/reply", auth, role("admin"), replySupport);

module.exports = supportRouter;
