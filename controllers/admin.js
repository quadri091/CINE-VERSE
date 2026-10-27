const usermodel = require("../models/user.js");
const moviemodel = require("../models/movie.js");
const ticketmodel = require("../models/ticket.js");
const paymentmodel = require("../models/payment.js");
const supportmodel = require("../models/support.js");
const disputemodel = require("../models/dispute.js");
const publicUser = require("../utils/public-user.js");
const { movieStatus } = require("../utils/movie-status.js");
const bcrypt = require("bcryptjs");
const { sendAdminEmail } = require("../utils/send-to-email.js");
const { generateCode, codeExpiry } = require("../utils/generate-otp.js");

const getStats = async (req, res) => {
  try {
    const now = new Date();
    const [paid, tickets, users, openSupport, movies, recent, openDisputes] =
      await Promise.all([
        paymentmodel.aggregate([
          { $match: { status: "success" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        ticketmodel.countDocuments(),
        usermodel.countDocuments({ role: "user" }),
        supportmodel.countDocuments({ status: "open" }),
        moviemodel.find({ isActive: true }).select("startTime duration"),
        paymentmodel
          .find({ status: "success" })
          .populate("userId", "userName")
          .sort({ paidAt: -1 })
          .limit(6),
        disputemodel.countDocuments({
          status: { $in: ["Open", "Under Review", "Escalated"] },
        }),
      ]);

    return res.status(200).json({
      success: true,
      message: "Stats",
      data: {
        revenue: paid[0]?.total || 0,
        tickets,
        users,
        openSupport,
        openDisputes,
        live: movies.filter((m) => movieStatus(m, now) === "live").length,
        upcoming: movies.filter((m) => movieStatus(m, now) === "upcoming")
          .length,
        recentPayments: recent.map((p) => ({
          _id: p._id,
          amount: p.amount,
          userName: p.userId?.userName || "Deleted user",
          paidAt: p.paidAt,
          tickets: p.movieIds.length,
        })),
      },
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load stats" });
  }
};

const adminUser = (u) => ({
  ...publicUser(u),
  banned: u.banned,
  suspendedUntil: u.suspendedUntil,
  createdAt: u.createdAt,
});

const getUsers = async (req, res) => {
  const search = String(req.query.search || "").trim();
  try {
    const filter = search
      ? {
          $or: [
            { userName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};
    const users = await usermodel.find(filter).sort({ createdAt: -1 }).limit(100);

    return res.status(200).json({
      success: true,
      message: "Users",
      data: users.map(adminUser),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Could not load users" });
  }
};

const updateUser = async (req, res) => {
  const { banned, suspendDays, role } = req.body;
  try {
    const user = await usermodel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (String(user._id) === String(req.user._id)) {
      return res
        .status(400)
        .json({ success: false, message: "You can't change your own account" });
    }

    let message = "User updated";
    if (banned !== undefined) {
      user.banned = !!banned;
      message = banned ? "User banned" : "User unbanned";
    }
    if (suspendDays !== undefined) {
      const days = Number(suspendDays);
      user.suspendedUntil = days > 0 ? new Date(Date.now() + days * 86400000) : null;
      message = days > 0 ? `Suspended for ${days} days` : "Suspension lifted";
    }
    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Unknown role" });
      }
      user.role = role;
      message = `Role changed to ${role}`;
    }
    if (user.banned || user.suspendedUntil) user.token = null;
    await user.save();

    const io = req.app.get("io");
    io?.to(`user:${user._id}`).emit("account:updated");
    io?.to("admins").emit("user:updated", adminUser(user));
    return res
      .status(200)
      .json({ success: true, message, data: adminUser(user) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getTeam = async (req, res) => {
  try {
    const admins = await usermodel.find({ role: "admin" }).sort({ createdAt: 1 });
    return res
      .status(200)
      .json({ success: true, message: "Team", data: admins.map(adminUser) });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Could not load the team" });
  }
};

const createAdmin = async (req, res) => {
  const userName = String(req.body.userName || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const age = Number(req.body.age);

  if (!userName || !email || !password || !age) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }
  if (!email.includes("@")) {
    return res
      .status(400)
      .json({ success: false, message: "Enter a valid email" });
  }
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });
  }
  if (Number.isNaN(age) || age < 18 || age > 99) {
    return res
      .status(400)
      .json({ success: false, message: "Admins must be 18 or older" });
  }

  try {
    if (await usermodel.exists({ email })) {
      return res
        .status(409)
        .json({ success: false, message: "That email already has an account" });
    }

    const code = generateCode();
    const user = await usermodel.create({
      userName,
      email,
      password: await bcrypt.hash(password, 12),
      age,
      role: "admin",
      verified: false,
      otp: code,
      otpExpiry: codeExpiry(),
    });

    const mail = await sendAdminEmail(email, code, userName, "admin");
    if (!mail.success) {
      await usermodel.deleteOne({ _id: user._id });
      return res
        .status(400)
        .json({ success: false, message: "Could not send the invite email" });
    }

    req.app.get("io")?.to("admins").emit("team:new", adminUser(user));
    return res.status(201).json({
      success: true,
      message: `${userName} was invited. They verify with the code in their email.`,
      data: adminUser(user),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getStats, getUsers, updateUser, getTeam, createAdmin };
