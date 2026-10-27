const {
  createDispute,
  getMyDisputes,
  getDispute,
  addComment,
  addEvidence,
  escalateDispute,
  getAllDisputes,
  updateStatus,
  deleteDispute,
} = require("../controllers/dispute.js");
const auth = require("../middleware/auth.js");
const role = require("../middleware/role.js");
const express = require("express");
const disputeRouter = express.Router();

disputeRouter.post("/", auth, createDispute);
disputeRouter.get("/mine", auth, getMyDisputes);
disputeRouter.get("/admin/all", auth, role("admin"), getAllDisputes);
disputeRouter.get("/:id", auth, getDispute);
disputeRouter.post("/:id/comments", auth, addComment);
disputeRouter.post("/:id/evidence", auth, addEvidence);
disputeRouter.patch("/:id/escalate", auth, escalateDispute);
disputeRouter.patch("/:id/status", auth, role("admin"), updateStatus);
disputeRouter.delete("/:id", auth, role("admin"), deleteDispute);

module.exports = disputeRouter;
