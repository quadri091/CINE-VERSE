const crypto = require("crypto");
const paymentmodel = require("../models/payment.js");
const ticketmodel = require("../models/ticket.js");
const usermodel = require("../models/user.js");
const generateTicketCode = require("../utils/generate-ticket.js");
const notify = require("../utils/notify.js");
const { canWatch, publicMovie } = require("../utils/movie-status.js");
const { validCart } = require("./cart.js");
const { ticketJson, myTickets } = require("./ticket.js");
const {
  initializeTransaction,
  verifyTransaction,
  isValidSignature,
} = require("../utils/paystack.js");

const callbackUrl = (req) =>
  process.env.PAYSTACK_CALLBACK_URL ||
  `${process.env.SERVER_URL || `${req.protocol}://${req.get("host")}`}/payments/callback`;

const fulfilPayment = async (reference, paystackData, io) => {
  const payment = await paymentmodel.findOneAndUpdate(
    { reference, status: { $ne: "success" } },
    {
      $set: {
        status: "success",
        channel: paystackData.channel,
        paidAt: paystackData.paid_at || new Date(),
        raw: paystackData,
      },
    },
    { returnDocument: "after" },
  );
  if (!payment) return;

  await payment.populate("movieIds");
  const newTickets = [];
  for (const movie of payment.movieIds) {
    try {
      const ticket = await ticketmodel.create({
        code: generateTicketCode(),
        userId: payment.userId,
        movieId: movie._id,
        paymentId: payment._id,
        price: movie.price,
      });
      newTickets.push({ ...ticketJson(ticket), movie: publicMovie(movie) });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  const user = await usermodel.findByIdAndUpdate(
    payment.userId,
    { $pull: { cart: { $in: payment.movieIds.map((m) => m._id) } } },
    { returnDocument: "after" },
  );

  io?.to(`user:${payment.userId}`).emit("tickets:new", newTickets);
  if (user) {
    io?.to(`user:${payment.userId}`).emit("cart:updated", await validCart(user));
  }

  await notify(io, payment.userId, {
    title: "Payment received",
    body: `Your ticket${payment.movieIds.length > 1 ? "s are" : " is"} ready in the Tickets tab.`,
    type: "payment",
    dedupeKey: `payment:${payment.reference}`,
  });
  io?.to("admins").emit("payment:success", {
    _id: payment._id,
    amount: payment.amount,
    userName: user?.userName || "User",
    paidAt: payment.paidAt,
    tickets: newTickets.length,
  });
};

const initializePayment = async (req, res) => {
  const user = req.user;
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res
      .status(500)
      .json({ success: false, message: "Paystack key is missing on server" });
  }
  try {
    const cart = await validCart(user);
    const owned = await ticketmodel.distinct("movieId", { userId: user._id });
    const movies = cart.filter(
      (m) =>
        canWatch(user, m) && !owned.some((id) => String(id) === String(m._id)),
    );

    if (!movies.length) {
      return res
        .status(400)
        .json({ success: false, message: "Your cart is empty" });
    }

    const amount = movies.reduce((sum, m) => sum + m.price, 0);
    const reference = `CV-PAY-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    await paymentmodel.create({
      userId: user._id,
      reference,
      amount,
      movieIds: movies.map((m) => m._id),
    });

    const paystack = await initializeTransaction({
      email: user.email,
      amount,
      reference,
      callbackUrl: callbackUrl(req),
    });

    return res.status(200).json({
      success: true,
      message: "Payment started",
      data: {
        reference,
        amount,
        authorizationUrl: paystack.authorization_url,
        callbackUrl: callbackUrl(req),
      },
    });
  } catch (error) {
    console.log("Paystack initialize failed:", error.response?.data || error);
    return res
      .status(400)
      .json({ success: false, message: "Could not start payment" });
  }
};

const verifyPayment = async (req, res) => {
  const { reference } = req.params;
  try {
    const payment = await paymentmodel.findOne({
      reference,
      userId: req.user._id,
    });
    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    if (payment.status !== "success") {
      const paystack = await verifyTransaction(reference);
      const paidEnough = paystack.amount >= Math.round(payment.amount * 100);

      if (paystack.status !== "success" || !paidEnough) {
        if (["failed", "abandoned"].includes(paystack.status)) {
          payment.status = paystack.status;
          await payment.save();
        }
        return res
          .status(400)
          .json({ success: false, message: "Payment not completed" });
      }
      await fulfilPayment(reference, paystack, req.app.get("io"));
    }

    return res.status(200).json({
      success: true,
      message: "Payment successful",
      data: {
        tickets: await myTickets(req.user._id),
        cart: await validCart(await usermodel.findById(req.user._id)),
      },
    });
  } catch (error) {
    console.log("Paystack verify failed:", error.response?.data || error);
    return res
      .status(400)
      .json({ success: false, message: "Could not confirm payment" });
  }
};

const paystackWebhook = async (req, res) => {
  if (!isValidSignature(req.body, req.headers["x-paystack-signature"])) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);

  try {
    const event = JSON.parse(req.body.toString());
    if (event.event !== "charge.success") return;

    const payment = await paymentmodel.findOne({
      reference: event.data.reference,
    });
    if (!payment) return;
    if (event.data.amount < Math.round(payment.amount * 100)) return;

    await fulfilPayment(event.data.reference, event.data, req.app.get("io"));
  } catch (error) {
    console.log("Paystack webhook error:", error);
  }
};

const paymentCallback = (req, res) => {
  res.send(
    `<html><body style="font-family:sans-serif;text-align:center;padding-top:80px;color:#23B656">
      <h2>Payment complete</h2><p style="color:#6E7171">You can go back to Cine Verse.</p>
    </body></html>`,
  );
};

module.exports = {
  initializePayment,
  verifyPayment,
  paystackWebhook,
  paymentCallback,
};
