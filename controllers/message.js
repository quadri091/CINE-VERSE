const mongoose = require("mongoose");
const messagemodel = require("../models/message.js");
const usermodel = require("../models/user.js");
const uploadFile = require("../utils/upload.js");

const isAdmin = (user) => user.role === "admin";

const teamChat = (userId) => ({
  chatId: `team_${userId}`,
  members: [userId],
  team: true,
});

const findChat = async (me, withId) => {
  const other = String(withId || "team");
  if (!isAdmin(me) && other === "team") {
    return { ...teamChat(me._id), receiver: null };
  }
  if (!mongoose.isValidObjectId(other) || other === String(me._id)) {
    return null;
  }

  const person = await usermodel
    .findById(other)
    .select("role userName profileImage");
  if (!person) return null;
  const receiver = {
    id: person._id,
    name: person.userName,
    profileImage: person.profileImage || "",
  };
  if (isAdmin(me)) {
    return isAdmin(person) ? null : { ...teamChat(person._id), receiver };
  }
  if (isAdmin(person)) return { ...teamChat(me._id), receiver: null };

  const members = [String(me._id), other].sort();
  return { chatId: members.join("_"), members, team: false, receiver };
};

const unseen = (me) =>
  isAdmin(me)
    ? { team: true, "sender.role": "user", seen: false }
    : { members: me._id, "sender.id": { $ne: me._id }, seen: false };

const sendMessage = async (req, res) => {
  const content = String(req.body.content || "").trim();
  const image = req.body.image;
  if (!content && !image) {
    return res
      .status(400)
      .json({ success: false, message: "Write a message or add a photo" });
  }
  if (content.length > 2000) {
    return res
      .status(400)
      .json({ success: false, message: "Message is too long" });
  }

  try {
    const me = req.user;
    const found = await findChat(me, req.body.to);
    if (!found) {
      return res
        .status(404)
        .json({ success: false, message: "We couldn't find that person" });
    }
    const { receiver, ...chat } = found;

    const message = await messagemodel.create({
      ...chat,
      sender: {
        id: me._id,
        name: me.userName,
        profileImage: me.profileImage || "",
        role: me.role,
      },
      content,
      imageUrl: image ? await uploadFile(image, "cineverse/messages") : "",
    });
    const data = { ...message.toJSON(), receiver };

    const rooms = message.members.map((id) => `user:${id}`);
    if (message.team) rooms.push("admins");
    req.app.get("io")?.to(rooms).emit("message:new", data);

    return res.status(201).json({ success: true, message: "Sent", data });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not send the message" });
  }
};

const getChat = async (req, res) => {
  try {
    const chat = await findChat(req.user, req.params.with);
    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "We couldn't find that person" });
    }
    const messages = await messagemodel
      .find({ chatId: chat.chatId })
      .sort({ createdAt: -1 })
      .limit(300);
    await messagemodel.updateMany(
      { ...unseen(req.user), chatId: chat.chatId },
      { $set: { seen: true } },
    );
    return res
      .status(200)
      .json({ success: true, message: "Chat", data: messages.reverse() });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load the chat" });
  }
};

const markRead = async (req, res) => {
  try {
    const chat = await findChat(req.user, req.params.with);
    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "We couldn't find that person" });
    }
    await messagemodel.updateMany(
      { ...unseen(req.user), chatId: chat.chatId },
      { $set: { seen: true } },
    );
    return res.status(200).json({ success: true, message: "Read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getUnread = async (req, res) => {
  try {
    const count = await messagemodel.countDocuments(unseen(req.user));
    return res
      .status(200)
      .json({ success: true, message: "Unread", data: { count } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getInbox = async (req, res) => {
  try {
    const me = req.user;
    const admin = isAdmin(me);
    const notMine = admin
      ? { $eq: ["$sender.role", "user"] }
      : { $ne: ["$sender.id", me._id] };

    const chats = await messagemodel.aggregate([
      { $match: admin ? { team: true } : { members: me._id } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$chatId",
          last: { $first: "$$ROOT" },
          unread: {
            $sum: {
              $cond: [{ $and: [notMine, { $eq: ["$seen", false] }] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "last.createdAt": -1 } },
      { $limit: 200 },
    ]);

    const otherOf = (chat) => {
      const members = chat.last.members.map(String);
      if (chat.last.team) return admin ? members[0] : null;
      return members.find((id) => id !== String(me._id)) || null;
    };

    const people = await usermodel
      .find({ _id: { $in: chats.map(otherOf).filter(Boolean) } })
      .select("userName email profileImage");
    const byId = Object.fromEntries(people.map((p) => [String(p._id), p]));

    const inbox = chats
      .map((chat) => {
        const other = otherOf(chat);
        return {
          key: chat.last.team && !admin ? "team" : other,
          team: chat.last.team,
          person: other ? byId[other] || null : null,
          last: chat.last,
          unread: chat.unread,
        };
      })
      .filter((chat) => chat.key === "team" || chat.person);

    return res
      .status(200)
      .json({ success: true, message: "Inbox", data: inbox });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load the inbox" });
  }
};

module.exports = { sendMessage, getChat, markRead, getUnread, getInbox };
