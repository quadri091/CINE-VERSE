const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    type: {
      type: String,
      enum: ["live", "reminder", "payment", "system"],
      default: "system",
    },
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: "movie" },
    read: { type: Boolean, default: false },
    dedupeKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

const notificationmodel = mongoose.model("notification", notificationSchema);
module.exports = notificationmodel;
