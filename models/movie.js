const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    genres: [{ type: String }],
    duration: { type: Number, required: true },
    price: { type: Number, required: true },
    rating: {
      type: String,
      enum: ["PG", "13+", "16+", "18+"],
      default: "PG",
    },
    startTime: { type: Date, required: true },
    posterUrl: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },

    reminderSent: { type: Boolean, default: false },
    liveSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

movieSchema.index({ title: "text", description: "text" });
movieSchema.index({ startTime: 1 });

const moviemodel = mongoose.model("movie", movieSchema);
module.exports = moviemodel;
