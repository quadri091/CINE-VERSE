const { getMyTickets, enterTicket } = require("../controllers/ticket.js");
const auth = require("../middleware/auth.js");
const express = require("express");
const ticketRouter = express.Router();

ticketRouter.get("/", auth, getMyTickets);
ticketRouter.post("/enter", auth, enterTicket);

module.exports = ticketRouter;
