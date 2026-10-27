const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    movieIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "movie" }],
    status: {
      type: String,
      enum: ["pending", "success", "failed", "abandoned"],
      default: "pending",
    },
    channel: { type: String },
    paidAt: { type: Date },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

const paymentmodel = mongoose.model("payment", paymentSchema);
module.exports = paymentmodel;
