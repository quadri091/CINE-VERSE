const {
  sendMessage,
  getChat,
  markRead,
  getUnread,
  getInbox,
} = require("../controllers/message.js");
const auth = require("../middleware/auth.js");
const express = require("express");
const messageRouter = express.Router();

messageRouter.post("/", auth, sendMessage);
messageRouter.get("/inbox", auth, getInbox);
messageRouter.get("/unread", auth, getUnread);
messageRouter.get("/chat/:with", auth, getChat);
messageRouter.patch("/read/:with", auth, markRead);

module.exports = messageRouter;
