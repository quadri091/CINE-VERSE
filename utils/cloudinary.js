const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.cloudname,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.cloudApiKey,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.cloudApiSecret,
  secure: true,
});

module.exports = cloudinary;
