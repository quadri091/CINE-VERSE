const jwt = require("jsonwebtoken");
const usermodel = require("../models/user.js");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token is required" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.jwtSecretKey);

    const user = await usermodel.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    if (
      user.banned ||
      (user.suspendedUntil && user.suspendedUntil > new Date())
    ) {
      return res
        .status(403)
        .json({ message: "This account cannot access the service" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Session expired, log in again" });
  }
};

module.exports = authMiddleware;
