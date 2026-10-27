const notificationmodel = require("../models/notification.js");

const notify = async (io, userId, { title, body, type, movieId, dedupeKey }) => {
  try {
    const notification = await notificationmodel.create({
      userId,
      title,
      body,
      type,
      movieId,
      dedupeKey,
    });
    io?.to(`user:${userId}`).emit("notification:new", notification);
    return notification;
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
};

module.exports = notify;
