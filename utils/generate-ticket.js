const crypto = require("crypto");

const generateTicketCode = () =>
  `CV-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

module.exports = generateTicketCode;
