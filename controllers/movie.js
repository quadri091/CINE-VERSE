const moviemodel = require("../models/movie.js");
const ticketmodel = require("../models/ticket.js");
const fs = require("fs");
const uploadFile = require("../utils/upload.js");
const { uploadVideoFile, videoLimit } = require("../utils/upload.js");
const {
  notEnded,
  hidden,
  publicMovie,
} = require("../utils/movie-status.js");

const allowedFields = [
  "title",
  "description",
  "genres",
  "duration",
  "price",
  "rating",
  "startTime",
];

const getMovies = async (req, res) => {
  const { search, genre } = req.query;
  const now = new Date();
  try {
    const filter = { isActive: true, ...notEnded(now) };
    if (genre && genre !== "All") filter.genres = genre;
    if (search) filter.title = { $regex: search.trim(), $options: "i" };

    const movies = await moviemodel
      .find(filter)
      .select(hidden)
      .sort({ startTime: 1 });

    return res.status(200).json({
      success: true,
      message: "Movies",
      data: movies,
      serverTime: now,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load movies" });
  }
};

const getMovie = async (req, res) => {
  try {
    const movie = await moviemodel.findOne({
      _id: req.params.id,
      isActive: true,
    }).select(hidden);
    if (!movie) {
      return res
        .status(404)
        .json({ success: false, message: "Movie not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Movie",
      data: movie,
      serverTime: new Date(),
    });
  } catch (error) {
    return res
      .status(404)
      .json({ success: false, message: "Movie not found" });
  }
};

const getAllMovies = async (req, res) => {
  try {
    const movies = await moviemodel.find().sort({ startTime: -1 }).lean();
    const sold = await ticketmodel.aggregate([
      { $group: { _id: "$movieId", tickets: { $sum: 1 }, revenue: { $sum: "$price" } } },
    ]);
    const byId = Object.fromEntries(sold.map((s) => [String(s._id), s]));

    return res.status(200).json({
      success: true,
      message: "All movies",
      data: movies.map((m) => ({
        ...m,
        tickets: byId[String(m._id)]?.tickets || 0,
        revenue: byId[String(m._id)]?.revenue || 0,
      })),
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load movies" });
  }
};

const createMovie = async (req, res) => {
  const { title, duration, price, startTime, poster, video } = req.body;
  if (!title || !duration || !price || !startTime) {
    return res.status(400).json({
      success: false,
      message: "Title, duration, price and start time are required",
    });
  }
  try {
    const data = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    data.posterUrl = await uploadFile(poster, "cineverse/posters");
    data.videoUrl = await uploadFile(video, "cineverse/videos");

    const movie = await moviemodel.create(data);

    req.app.get("io")?.emit("movie:updated", publicMovie(movie));
    return res
      .status(201)
      .json({ success: true, message: "Movie added", data: movie });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const updateMovie = async (req, res) => {
  try {
    const movie = await moviemodel.findById(req.params.id);
    if (!movie) {
      return res
        .status(404)
        .json({ success: false, message: "Movie not found" });
    }

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) movie[key] = req.body[key];
    }
    if (req.body.poster) {
      movie.posterUrl = await uploadFile(req.body.poster, "cineverse/posters");
    }
    if (req.body.video) {
      movie.videoUrl = await uploadFile(req.body.video, "cineverse/videos");
    }
    if (req.body.startTime) {
      movie.reminderSent = false;
      movie.liveSent = false;
    }
    await movie.save();

    req.app.get("io")?.emit("movie:updated", publicMovie(movie));
    return res
      .status(200)
      .json({ success: true, message: "Movie updated", data: movie });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const deleteMovie = async (req, res) => {
  try {
    const movie = await moviemodel.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { returnDocument: "after" },
    );
    if (!movie) {
      return res
        .status(404)
        .json({ success: false, message: "Movie not found" });
    }

    req.app.get("io")?.emit("movie:deleted", { movieId: String(movie._id) });
    return res.status(200).json({ success: true, message: "Movie removed" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const uploadVideo = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Pick a video to upload" });
  }
  const io = req.app.get("io");
  const room = `user:${req.user._id}`;
  try {
    const { url, duration } = await uploadVideoFile(
      req.file.path,
      req.file.size,
      (percent) =>
        io?.to(room).emit("upload:progress", { stage: "cloud", percent }),
    );
    return res.status(200).json({
      success: true,
      message: "Video uploaded",
      data: { url, duration: Math.round(duration) },
    });
  } catch (error) {
    console.log("Video upload failed:", error.message);
    return res.status(500).json({
      success: false,
      message: `Could not upload the video: ${error.message}`,
    });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
};

const getUploadLimit = async (req, res) => {
  const { maxBytes, plan } = await videoLimit();
  return res
    .status(200)
    .json({ success: true, message: "Upload limit", data: { maxBytes, plan } });
};

module.exports = {
  uploadVideo,
  getUploadLimit,
  getMovies,
  getMovie,
  getAllMovies,
  createMovie,
  updateMovie,
  deleteMovie,
};
