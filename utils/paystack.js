const axios = require("axios");
const crypto = require("crypto");

const paystack = () =>
  axios.create({
    baseURL: "https://api.paystack.co",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });

const initializeTransaction = async ({ email, amount, reference, callbackUrl }) => {
  const res = await paystack().post("/transaction/initialize", {
    email,
    amount: Math.round(amount * 100),
    reference,
    currency: "NGN",
    callback_url: callbackUrl,
  });
  return res.data.data;
};

const verifyTransaction = async (reference) => {
  const res = await paystack().get(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  return res.data.data;
};

const isValidSignature = (rawBody, signature) => {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return hash === signature;
};

module.exports = { initializeTransaction, verifyTransaction, isValidSignature };
