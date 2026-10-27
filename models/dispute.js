const mongoose = require("mongoose");

const person = {
  id: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], required: true },
  profileImage: { type: String, default: "" },
};

const disputeSchema = new mongoose.Schema(
  {
    raisedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
      name: { type: String, required: true },
      email: { type: String, required: true },
      profileImage: { type: String, default: "" },
    },
    ticket: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "ticket" },
      code: { type: String, default: "" },
      movieTitle: { type: String, default: "" },
      price: { type: Number, default: 0 },
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "Ticket not working",
        "Video not playing",
        "Paid but no ticket",
        "Charged twice",
        "Refund request",
        "Age rating issue",
        "Other",
      ],
    },
    description: { type: String, required: true, maxlength: 2000 },
    comments: [
      {
        sender: person,
        message: { type: String, required: true, maxlength: 2000 },
        sentAt: { type: Date, default: Date.now },
      },
    ],
    evidence: [
      {
        imageUrl: { type: String, required: true },
        sender: person,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    resolution: {
      note: { type: String, default: "" },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      resolvedAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: ["Open", "Under Review", "Escalated", "Resolved", "Rejected"],
      default: "Open",
    },
  },
  { timestamps: true },
);

const disputemodel = mongoose.model("dispute", disputeSchema);
module.exports = disputemodel;
