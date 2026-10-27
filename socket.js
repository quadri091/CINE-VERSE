const jwt = require("jsonwebtoken");
const usermodel = require("./models/user.js");
const userSocket = [];

const lifeUpdate = (io) => {
  io.on("connection", async (socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token || typeof token !== "string" || !token.trim()) {
      return socket.disconnect(true);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.jwtSecretKey);
    } catch (err) {
      return socket.disconnect(true);
    }

    let user;
    try {
      user = await usermodel.findById(decoded.id);
    } catch (err) {
      return socket.disconnect(true);
    }

    if (!user) {
      return socket.disconnect(true);
    }

    const userId = user.id.toString();

    userSocket.push({
      userId,
      role: user.role.toLowerCase(),
      name: user.userName,
      socketId: socket.id,
    });

    socket.join(`user:${userId}`);

    if (user.role.toLowerCase() == "admin") {
      socket.join("admins");
    }

    socket.on("movie:join", (movieId) => {
      if (!movieId) return;
      socket.join(`movie:${movieId}`);
      emitViewers(io, movieId);
    });

    socket.on("comments:join", (movieId) => {
      if (movieId) socket.join(`comments:${movieId}`);
    });

    socket.on("comments:leave", (movieId) => {
      if (movieId) socket.leave(`comments:${movieId}`);
    });

    socket.on("movie:leave", (movieId) => {
      if (!movieId) return;
      socket.leave(`movie:${movieId}`);
      emitViewers(io, movieId);
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (!room.startsWith("movie:")) continue;
        const movieId = room.replace("movie:", "");
        setTimeout(() => emitViewers(io, movieId), 0);
      }
    });

    socket.on("disconnect", () => {
      const userIndex = userSocket.findIndex(
        (u) => u.userId === userId && u.socketId === socket.id,
      );
      if (userIndex !== -1) {
        userSocket.splice(userIndex, 1);
      }
    });
  });
};

const emitViewers = (io, movieId) => {
  const viewers = io.sockets.adapter.rooms.get(`movie:${movieId}`)?.size || 0;
  io.to(`movie:${movieId}`).emit("movie:viewers", { movieId, viewers });
};

const getSocketsByUserId = (userId) =>
  userSocket
    .filter((u) => u.userId === userId.toString())
    .map((u) => u.socketId);

const getSocketsByRole = (roles) =>
  userSocket.filter((u) => roles.includes(u.role)).map((u) => u.socketId);

const emitToUser = (io, userId, event, payload) => {
  if (!userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

module.exports = {
  lifeUpdate,
  getSocketsByUserId,
  getSocketsByRole,
  emitToUser,
};
