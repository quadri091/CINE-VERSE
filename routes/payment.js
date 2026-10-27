const {
  initializePayment,
  verifyPayment,
  paystackWebhook,
  paymentCallback,
} = require("../controllers/payment.js");
const auth = require("../middleware/auth.js");
const express = require("express");
const paymentRouter = express.Router();

paymentRouter.post("/initialize", auth, initializePayment);
paymentRouter.post("/verify/:reference", auth, verifyPayment);
paymentRouter.post("/webhook", paystackWebhook);
paymentRouter.get("/callback", paymentCallback);

module.exports = paymentRouter;
