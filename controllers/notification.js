const notificationmodel = require("../models/notification.js");

const getNotifications = async (req, res) => {
  try {
    const notifications = await notificationmodel
      .find({ userId: req.user._id })
      .select("-dedupeKey")
      .sort({ createdAt: -1 })
      .limit(50);

    return res
      .status(200)
      .json({ success: true, message: "Notifications", data: notifications });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Could not load notifications" });
  }
};

const readAll = async (req, res) => {
  try {
    await notificationmodel.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } },
    );
    return res
      .status(200)
      .json({ success: true, message: "All marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getNotifications, readAll };
