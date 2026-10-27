const {
  getNotifications,
  readAll,
} = require("../controllers/notification.js");
const auth = require("../middleware/auth.js");
const express = require("express");
const notificationRouter = express.Router();

notificationRouter.get("/", auth, getNotifications);
notificationRouter.patch("/read-all", auth, readAll);

module.exports = notificationRouter;
