const supportmodel = require("../models/support.js");
const notify = require("../utils/notify.js");
const {
  sendSupportEmail,
  sendSupportReceipt,
  sendSupportReply,
} = require("../utils/send-to-email.js");

const createSupport = async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) {
    return res
      .status(400)
      .json({ success: false, message: "Tell us what happened" });
  }
  try {
    const user = req.user;
    const support = await supportmodel.create({ userId: user._id, message });

    const mail = await sendSupportEmail(user, message);
    if (!mail.success) {
      return res.status(400).json({
        success: false,
        message: "Could not send your message, try again",
      });
    }
    await sendSupportReceipt(user, message);

    req.app.get("io")?.to("admins").emit("support:new", {
      ...support.toObject(),
      userId: {
        _id: user._id,
        userName: user.userName,
        email: user.email,
        profileImage: user.profileImage,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Sent! We'll reply to your email",
      data: support,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getSupport = async (req, res) => {
  try {
    const list = await supportmodel
      .find({ status: req.query.status || "open" })
      .populate("userId", "userName email profileImage")
      .sort({ createdAt: -1 });
    return res
      .status(200)
      .json({ success: true, message: "Support", data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const replySupport = async (req, res) => {
  const reply = String(req.body.reply || "").trim();
  if (!reply) {
    return res
      .status(400)
      .json({ success: false, message: "Write a reply first" });
  }
  try {
    const support = await supportmodel
      .findById(req.params.id)
      .populate("userId");
    if (!support || !support.userId) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    const mail = await sendSupportReply(support.userId, support.message, reply);
    if (!mail.success) {
      return res
        .status(400)
        .json({ success: false, message: "Could not send the email" });
    }

    support.reply = reply;
    support.repliedAt = new Date();
    support.status = "closed";
    await support.save();

    req.app.get("io")?.to("admins").emit("support:closed", {
      _id: String(support._id),
    });

    await notify(req.app.get("io"), support.userId._id, {
      title: "Support replied",
      body: "Check your email for our answer.",
      type: "system",
    });

    return res
      .status(200)
      .json({ success: true, message: "Reply sent by email" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { createSupport, getSupport, replySupport };
