const {
  getStats,
  getUsers,
  updateUser,
  getTeam,
  createAdmin,
} = require("../controllers/admin.js");
const auth = require("../middleware/auth.js");
const role = require("../middleware/role.js");
const express = require("express");
const adminRouter = express.Router();

adminRouter.use(auth, role("admin"));

adminRouter.get("/stats", getStats);
adminRouter.get("/users", getUsers);
adminRouter.patch("/users/:id", updateUser);
adminRouter.get("/team", getTeam);
adminRouter.post("/team", createAdmin);

module.exports = adminRouter;
