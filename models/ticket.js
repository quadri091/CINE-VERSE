const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "movie",
      required: true,
    },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "payment" },
    price: { type: Number, required: true },
    enteredAt: { type: Date },
  },
  { timestamps: true },
);

ticketSchema.index({ userId: 1, movieId: 1 }, { unique: true });

const ticketmodel = mongoose.model("ticket", ticketSchema);
module.exports = ticketmodel;
