const {
  getCart,
  addToCart,
  removeFromCart,
} = require("../controllers/cart.js");
const auth = require("../middleware/auth.js");
const express = require("express");
const cartRouter = express.Router();

cartRouter.get("/", auth, getCart);
cartRouter.post("/:movieId", auth, addToCart);
cartRouter.delete("/:movieId", auth, removeFromCart);

module.exports = cartRouter;
