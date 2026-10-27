const commentmodel = require("../models/comment.js");
const moviemodel = require("../models/movie.js");

const getComments = async (req, res) => {
  try {
    const comments = await commentmodel
      .find({ movieId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({
      success: true,
      message: "Comments",
      data: comments.reverse(),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Could not load comments" });
  }
};

const addComment = async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) {
    return res
      .status(400)
      .json({ success: false, message: "Write something first" });
  }
  if (text.length > 500) {
    return res
      .status(400)
      .json({ success: false, message: "Keep it under 500 characters" });
  }
  try {
    if (!(await moviemodel.exists({ _id: req.params.id }))) {
      return res
        .status(404)
        .json({ success: false, message: "Movie not found" });
    }
    const me = req.user;
    const comment = await commentmodel.create({
      movieId: req.params.id,
      user: {
        id: me._id,
        name: me.userName,
        profileImage: me.profileImage || "",
        role: me.role,
      },
      text,
    });
    req.app
      .get("io")
      ?.to(`comments:${req.params.id}`)
      .emit("comment:new", comment);
    return res
      .status(201)
      .json({ success: true, message: "Posted", data: comment });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const comment = await commentmodel.findOne({
      _id: req.params.commentId,
      movieId: req.params.id,
    });
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    const mine = String(comment.user.id) === String(req.user._id);
    if (!mine && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    await comment.deleteOne();
    req.app
      .get("io")
      ?.to(`comments:${req.params.id}`)
      .emit("comment:deleted", {
        _id: String(comment._id),
        movieId: req.params.id,
      });
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getComments, addComment, deleteComment };
