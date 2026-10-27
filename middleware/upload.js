const os = require("os");
const multer = require("multer");
const { videoLimit } = require("../utils/upload.js");

const megabytes = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

const videoUpload = async (req, res, next) => {
  const { maxBytes, plan } = await videoLimit();
  const video = multer({
    dest: os.tmpdir(),
    limits: maxBytes ? { fileSize: maxBytes } : {},
    fileFilter: (req, file, done) => {
      if (file.mimetype.startsWith("video/")) return done(null, true);
      done(new Error("Only video files are allowed"));
    },
  }).single("video");

  video(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `This video is too big. Your Cloudinary ${plan} plan only takes videos up to ${megabytes(maxBytes)}`
        : error.message || "Upload failed";
    return res.status(400).json({ success: false, message });
  });
};

module.exports = videoUpload;
