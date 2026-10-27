const {
  uploadVideo,
  getUploadLimit,
  getMovies,
  getMovie,
  getAllMovies,
  createMovie,
  updateMovie,
  deleteMovie,
} = require("../controllers/movie.js");
const {
  getComments,
  addComment,
  deleteComment,
} = require("../controllers/comment.js");
const auth = require("../middleware/auth.js");
const role = require("../middleware/role.js");
const videoUpload = require("../middleware/upload.js");
const express = require("express");
const movieRouter = express.Router();

movieRouter.get("/", getMovies);
movieRouter.get("/admin/all", auth, role("admin"), getAllMovies);
movieRouter.get("/upload-limit", auth, role("admin"), getUploadLimit);
movieRouter.get("/:id", getMovie);
movieRouter.post("/", auth, role("admin"), createMovie);
movieRouter.post(
  "/upload-video",
  auth,
  role("admin"),
  videoUpload,
  uploadVideo,
);
movieRouter.get("/:id/comments", getComments);
movieRouter.post("/:id/comments", auth, addComment);
movieRouter.delete("/:id/comments/:commentId", auth, deleteComment);
movieRouter.patch("/:id", auth, role("admin"), updateMovie);
movieRouter.delete("/:id", auth, role("admin"), deleteMovie);

module.exports = movieRouter;
