const ticketmodel = require("../models/ticket.js");
const { movieStatus, hidden } = require("../utils/movie-status.js");

const lagosTime = (date) =>
  new Date(date).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  });

const ticketJson = (t) => ({
  _id: t._id,
  code: t.code,
  price: t.price,
  enteredAt: t.enteredAt,
  createdAt: t.createdAt,
  movie: t.movieId,
});

const myTickets = async (userId) => {
  const tickets = await ticketmodel
    .find({ userId })
    .populate("movieId", hidden)
    .sort({ createdAt: -1 });
  return tickets.filter((t) => t.movieId).map(ticketJson);
};

const getMyTickets = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Tickets",
      data: await myTickets(req.user._id),
      serverTime: new Date(),
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load tickets" });
  }
};

const enterTicket = async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) {
    return res
      .status(400)
      .json({ success: false, message: "Enter your ticket code" });
  }
  try {
    const ticket = await ticketmodel.findOne({ code }).populate("movieId");
    if (!ticket || !ticket.movieId) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    if (String(ticket.userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "This ticket belongs to another account",
      });
    }

    const movie = ticket.movieId;
    const now = new Date();
    const status = movieStatus(movie, now);

    if (status === "upcoming") {
      return res.status(400).json({
        success: false,
        message: `${movie.title} starts ${lagosTime(movie.startTime)}`,
      });
    }
    if (status === "ended") {
      return res
        .status(400)
        .json({ success: false, message: "This screening has ended" });
    }

    if (!ticket.enteredAt) {
      ticket.enteredAt = now;
      await ticket.save();
    }

    return res.status(200).json({
      success: true,
      message: "Enjoy the movie",
      data: {
        movie,
        elapsedSeconds: Math.floor((now - new Date(movie.startTime)) / 1000),
      },
      serverTime: now,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getMyTickets, enterTicket, ticketJson, myTickets };
