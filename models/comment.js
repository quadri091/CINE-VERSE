const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "movie",
      required: true,
    },
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true },
      profileImage: { type: String, default: "" },
      role: { type: String, enum: ["user", "admin"], required: true },
    },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true },
);

commentSchema.index({ movieId: 1, createdAt: -1 });

const commentmodel = mongoose.model("comment", commentSchema);
module.exports = commentmodel;
