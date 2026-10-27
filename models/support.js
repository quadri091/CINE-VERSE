const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    message: { type: String, required: true, maxlength: 2000 },
    reply: { type: String, default: "" },
    repliedAt: { type: Date },
    status: { type: String, enum: ["open", "closed"], default: "open" },
  },
  { timestamps: true },
);

const supportmodel = mongoose.model("support", supportSchema);
module.exports = supportmodel;
