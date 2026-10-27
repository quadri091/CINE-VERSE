const cron = require("node-cron");
const moviemodel = require("../models/movie.js");
const ticketmodel = require("../models/ticket.js");
const notify = require("../utils/notify.js");
const { notEnded } = require("../utils/movie-status.js");

const ticketHolders = (movieId) => ticketmodel.distinct("userId", { movieId });

const runMovieTimer = async (io, now = new Date()) => {
  const soon = await moviemodel.find({
    isActive: true,
    reminderSent: false,
    startTime: { $gt: now, $lte: new Date(now.getTime() + 15 * 60 * 1000) },
  });
  for (const movie of soon) {
    for (const userId of await ticketHolders(movie._id)) {
      await notify(io, userId, {
        title: `${movie.title} starts soon`,
        body: "Get your snacks ready, the premiere starts in 15 minutes.",
        type: "reminder",
        movieId: movie._id,
        dedupeKey: `reminder:${movie._id}:${movie.startTime.getTime()}:${userId}`,
      });
    }
    movie.reminderSent = true;
    await movie.save();
  }

  const live = await moviemodel.find({
    isActive: true,
    liveSent: false,
    startTime: { $lte: now },
    ...notEnded(now),
  });
  for (const movie of live) {
    for (const userId of await ticketHolders(movie._id)) {
      await notify(io, userId, {
        title: `${movie.title} is now live!`,
        body: "Enter your ticket code to join at the current moment.",
        type: "live",
        movieId: movie._id,
        dedupeKey: `live:${movie._id}:${movie.startTime.getTime()}:${userId}`,
      });
    }
    movie.liveSent = true;
    await movie.save();
    io?.emit("movie:live", { movieId: String(movie._id) });
  }
};

const startMovieTimer = (io) => {
  let running = false;
  cron.schedule("* * * * *", async () => {
    if (running) return;
    running = true;
    try {
      await runMovieTimer(io);
    } catch (error) {
      console.error("movieTimer error:", error.message);
    } finally {
      running = false;
    }
  });
};

module.exports = startMovieTimer;
