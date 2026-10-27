const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    team: { type: Boolean, default: false },
    sender: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true },
      profileImage: { type: String, default: "" },
      role: { type: String, enum: ["user", "admin"], required: true },
    },
    content: { type: String, default: "", maxlength: 2000 },
    imageUrl: { type: String, default: "" },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true },
);

messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ members: 1, createdAt: -1 });

const messagemodel = mongoose.model("message", messageSchema);
module.exports = messagemodel;
