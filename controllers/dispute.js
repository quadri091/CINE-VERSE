const disputemodel = require("../models/dispute.js");
const ticketmodel = require("../models/ticket.js");
const notify = require("../utils/notify.js");
const uploadFile = require("../utils/upload.js");

const reasons = disputemodel.schema.path("reason").enumValues;
const closed = ["Resolved", "Rejected"];

const sender = (user) => ({
  id: user._id,
  name: user.userName,
  role: user.role,
  profileImage: user.profileImage || "",
});

const isAdmin = (user) => user.role === "admin";
const isOwner = (dispute, user) =>
  String(dispute.raisedBy.id) === String(user._id);

const broadcast = (req, dispute, event = "dispute:updated") => {
  const io = req.app.get("io");
  io?.to(`user:${dispute.raisedBy.id}`).emit(event, dispute);
  io?.to("admins").emit(event, dispute);
};

const findDispute = async (req, res) => {
  const dispute = await disputemodel.findById(req.params.id);
  if (!dispute) {
    res.status(404).json({ success: false, message: "Dispute not found" });
    return null;
  }
  if (!isOwner(dispute, req.user) && !isAdmin(req.user)) {
    res.status(403).json({ success: false, message: "Access denied" });
    return null;
  }
  return dispute;
};

const createDispute = async (req, res) => {
  const reason = String(req.body.reason || "");
  const description = String(req.body.description || "").trim();
  const ticketCode = String(req.body.ticketCode || "").trim().toUpperCase();
  const images = Array.isArray(req.body.evidence) ? req.body.evidence : [];

  if (!reasons.includes(reason)) {
    return res
      .status(400)
      .json({ success: false, message: "Choose what went wrong" });
  }
  if (description.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Tell us a bit more (at least 10 characters)",
    });
  }
  if (images.length > 3) {
    return res
      .status(400)
      .json({ success: false, message: "You can add up to 3 photos" });
  }

  try {
    const user = req.user;
    let ticket = {};
    if (ticketCode) {
      const found = await ticketmodel
        .findOne({ code: ticketCode, userId: user._id })
        .populate("movieId", "title");
      if (!found) {
        return res
          .status(404)
          .json({ success: false, message: "That ticket isn't yours" });
      }
      const open = await disputemodel.exists({
        "ticket.id": found._id,
        status: { $nin: closed },
      });
      if (open) {
        return res.status(400).json({
          success: false,
          message: "This ticket already has an open dispute",
        });
      }
      ticket = {
        id: found._id,
        code: found.code,
        movieTitle: found.movieId?.title || "",
        price: found.price,
      };
    }

    const evidence = [];
    for (const image of images) {
      evidence.push({
        imageUrl: await uploadFile(image, "cineverse/disputes"),
        sender: sender(user),
      });
    }

    const dispute = await disputemodel.create({
      raisedBy: {
        id: user._id,
        name: user.userName,
        email: user.email,
        profileImage: user.profileImage || "",
      },
      ticket,
      reason,
      description,
      evidence,
    });

    req.app.get("io")?.to("admins").emit("dispute:new", dispute);
    await notify(req.app.get("io"), user._id, {
      title: "Dispute received",
      body: `We're looking into "${reason}". You'll get updates here.`,
      type: "system",
    });

    return res.status(201).json({
      success: true,
      message: "Dispute sent. We'll get back to you soon",
      data: dispute,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMyDisputes = async (req, res) => {
  try {
    const disputes = await disputemodel
      .find({ "raisedBy.id": req.user._id })
      .sort({ updatedAt: -1 });
    return res
      .status(200)
      .json({ success: true, message: "Disputes", data: disputes });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Could not load disputes" });
  }
};

const getDispute = async (req, res) => {
  try {
    const dispute = await findDispute(req, res);
    if (!dispute) return;
    return res
      .status(200)
      .json({ success: true, message: "Dispute", data: dispute });
  } catch (error) {
    return res
      .status(404)
      .json({ success: false, message: "Dispute not found" });
  }
};

const addComment = async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) {
    return res
      .status(400)
      .json({ success: false, message: "Write a message first" });
  }
  try {
    const dispute = await findDispute(req, res);
    if (!dispute) return;
    if (closed.includes(dispute.status)) {
      return res
        .status(400)
        .json({ success: false, message: "This dispute is closed" });
    }

    dispute.comments.push({ sender: sender(req.user), message });
    if (isAdmin(req.user) && dispute.status === "Open") {
      dispute.status = "Under Review";
    }
    await dispute.save();
    broadcast(req, dispute);

    if (isAdmin(req.user)) {
      await notify(req.app.get("io"), dispute.raisedBy.id, {
        title: "New reply on your dispute",
        body: message.slice(0, 120),
        type: "system",
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "Sent", data: dispute });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addEvidence = async (req, res) => {
  if (!req.body.image) {
    return res
      .status(400)
      .json({ success: false, message: "Pick a photo first" });
  }
  try {
    const dispute = await findDispute(req, res);
    if (!dispute) return;
    if (closed.includes(dispute.status)) {
      return res
        .status(400)
        .json({ success: false, message: "This dispute is closed" });
    }
    if (dispute.evidence.length >= 6) {
      return res
        .status(400)
        .json({ success: false, message: "Evidence is full (6 photos)" });
    }

    dispute.evidence.push({
      imageUrl: await uploadFile(req.body.image, "cineverse/disputes"),
      sender: sender(req.user),
    });
    await dispute.save();
    broadcast(req, dispute);

    return res
      .status(200)
      .json({ success: true, message: "Photo added", data: dispute });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not add the photo" });
  }
};

const escalateDispute = async (req, res) => {
  try {
    const dispute = await findDispute(req, res);
    if (!dispute) return;
    if (!isOwner(dispute, req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (closed.includes(dispute.status) || dispute.status === "Escalated") {
      return res
        .status(400)
        .json({ success: false, message: "This dispute can't be escalated" });
    }

    dispute.status = "Escalated";
    dispute.comments.push({
      sender: sender(req.user),
      message: "I escalated this dispute.",
    });
    await dispute.save();
    broadcast(req, dispute);

    return res.status(200).json({
      success: true,
      message: "Escalated. An admin will look at it first",
      data: dispute,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getAllDisputes = async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const disputes = await disputemodel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(200);
    return res
      .status(200)
      .json({ success: true, message: "Disputes", data: disputes });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Could not load disputes" });
  }
};

const updateStatus = async (req, res) => {
  const status = String(req.body.status || "");
  const note = String(req.body.note || "").trim();
  if (!["Under Review", "Resolved", "Rejected"].includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Unknown status" });
  }
  if (closed.includes(status) && !note) {
    return res.status(400).json({
      success: false,
      message: "Add a note so the customer knows why",
    });
  }
  try {
    const dispute = await disputemodel.findById(req.params.id);
    if (!dispute) {
      return res
        .status(404)
        .json({ success: false, message: "Dispute not found" });
    }
    if (closed.includes(dispute.status)) {
      return res
        .status(400)
        .json({ success: false, message: "This dispute is already closed" });
    }

    dispute.status = status;
    if (closed.includes(status)) {
      dispute.resolution = {
        note,
        resolvedBy: req.user._id,
        resolvedAt: new Date(),
      };
    }
    await dispute.save();
    broadcast(req, dispute);

    await notify(req.app.get("io"), dispute.raisedBy.id, {
      title:
        status === "Resolved"
          ? "Your dispute was resolved"
          : status === "Rejected"
            ? "Update on your dispute"
            : "Your dispute is being reviewed",
      body: note || `"${dispute.reason}" is now ${status.toLowerCase()}.`,
      type: "system",
    });

    return res
      .status(200)
      .json({ success: true, message: `Marked ${status}`, data: dispute });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteDispute = async (req, res) => {
  try {
    const dispute = await disputemodel.findByIdAndDelete(req.params.id);
    if (!dispute) {
      return res
        .status(404)
        .json({ success: false, message: "Dispute not found" });
    }
    broadcast(req, dispute, "dispute:deleted");
    return res.status(200).json({ success: true, message: "Dispute deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createDispute,
  getMyDisputes,
  getDispute,
  addComment,
  addEvidence,
  escalateDispute,
  getAllDisputes,
  updateStatus,
  deleteDispute,
};
