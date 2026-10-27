const fs = require("fs");
const { Transform } = require("stream");
const cloudinary = require("./cloudinary.js");

const uploadFile = async (file, folder = "cineverse") => {
  if (!file || typeof file !== "string") return "";
  if (!file.startsWith("data:")) return file;

  const result = await cloudinary.uploader.upload(file, {
    folder,
    resource_type: "auto",
  });
  return result.secure_url;
};

const uploadVideoFile = (path, size, onProgress) =>
  new Promise((resolve, reject) => {
    let sent = 0;
    let last = -1;
    const counter = new Transform({
      transform(chunk, encoding, done) {
        sent += chunk.length;
        const percent = Math.min(99, Math.floor((sent / size) * 100));
        if (percent !== last) {
          last = percent;
          onProgress(percent);
        }
        done(null, chunk);
      },
    });

    const cloud = cloudinary.uploader.upload_chunked_stream(
      {
        resource_type: "video",
        folder: "cineverse/videos",
        chunk_size: 6 * 1024 * 1024,
        disable_promises: true,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          return reject(
            new Error(error?.message || "Cloudinary upload failed"),
          );
        }
        onProgress(100);
        resolve({ url: result.secure_url, duration: result.duration || 0 });
      },
    );
    cloud.on("error", reject);

    fs.createReadStream(path).on("error", reject).pipe(counter).pipe(cloud);
  });

let limit = null;

const videoLimit = async () => {
  if (limit && Date.now() - limit.checkedAt < 10 * 60 * 1000) return limit;
  try {
    const usage = await cloudinary.api.usage();
    limit = {
      maxBytes: usage.media_limits?.video_max_size_bytes || 0,
      plan: usage.plan || "",
      checkedAt: Date.now(),
    };
  } catch (error) {
    return limit || { maxBytes: 0, plan: "", checkedAt: 0 };
  }
  return limit;
};

module.exports = uploadFile;
module.exports.uploadVideoFile = uploadVideoFile;
module.exports.videoLimit = videoLimit;
