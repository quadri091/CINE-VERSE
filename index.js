const express = require("express");
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connect = require("./database/connect.js");
const formRouter = require("./routes/form.js");
const actionRouter = require("./routes/action.js");
const userRouter = require("./routes/user.js");
const movieRouter = require("./routes/movie.js");
const cartRouter = require("./routes/cart.js");
const paymentRouter = require("./routes/payment.js");
const ticketRouter = require("./routes/ticket.js");
const notificationRouter = require("./routes/notification.js");
const supportRouter = require("./routes/support.js");
const adminRouter = require("./routes/admin.js");
const disputeRouter = require("./routes/dispute.js");
const messageRouter = require("./routes/message.js");
const startMovieTimer = require("./jobs/movieTimer.js");
const { lifeUpdate } = require("./socket.js");
const path = require("path");
const app = express();
const server = http.createServer(app);
server.requestTimeout = 0;
const io = new Server(server, {
  cors: { origin: "*" },
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error?.message || error);
});

const port = process.env.PORT || 8000;
connect();

app.use("/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "20mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  }),
);
app.use("/static", express.static(path.join(__dirname, "public")));
app.set("io", io);
app.use("/form", formRouter);
app.use("/action", actionRouter);
app.use("/user", userRouter);
app.use("/movies", movieRouter);
app.use("/cart", cartRouter);
app.use("/payments", paymentRouter);
app.use("/tickets", ticketRouter);
app.use("/notifications", notificationRouter);
app.use("/support", supportRouter);
app.use("/admin", adminRouter);
app.use("/disputes", disputeRouter);
app.use("/messages", messageRouter);

lifeUpdate(io);
startMovieTimer(io);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/time", (req, res) => {
  res.status(200).json({ success: true, serverTime: new Date() });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
