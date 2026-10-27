const moviemodel = require("../models/movie.js");
const ticketmodel = require("../models/ticket.js");
const { movieStatus, canWatch, hidden } = require("../utils/movie-status.js");

const validCart = async (user) => {
  await user.populate({ path: "cart", select: hidden });
  return user.cart.filter(
    (movie) => movie && movie.isActive && movieStatus(movie) !== "ended",
  );
};

const sendCart = async (req, res, message) => {
  const cart = await validCart(req.user);
  req.app.get("io")?.to(`user:${req.user._id}`).emit("cart:updated", cart);
  return res.status(200).json({ success: true, message, data: cart });
};

const getCart = async (req, res) => {
  try {
    const cart = await validCart(req.user);
    return res.status(200).json({ success: true, message: "Cart", data: cart });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load cart" });
  }
};

const addToCart = async (req, res) => {
  const { movieId } = req.params;
  const user = req.user;
  try {
    const movie = await moviemodel.findOne({ _id: movieId, isActive: true });
    if (!movie) {
      return res
        .status(404)
        .json({ success: false, message: "Movie not found" });
    }
    if (movieStatus(movie) === "ended") {
      return res
        .status(400)
        .json({ success: false, message: "This screening has ended" });
    }
    if (!canWatch(user, movie)) {
      return res.status(403).json({
        success: false,
        message: `This movie is rated ${movie.rating}`,
      });
    }
    if (await ticketmodel.exists({ userId: user._id, movieId })) {
      return res
        .status(400)
        .json({ success: false, message: "You already have a ticket" });
    }
    if (user.cart.some((id) => String(id) === String(movieId))) {
      return sendCart(req, res, "Already in your cart");
    }

    user.cart.push(movie._id);
    await user.save();

    return sendCart(req, res, "Added to cart");
  } catch (error) {
    console.log(error);
    return res
      .status(400)
      .json({ success: false, message: "Could not add to cart" });
  }
};

const removeFromCart = async (req, res) => {
  const user = req.user;
  try {
    user.cart = user.cart.filter(
      (id) => String(id) !== String(req.params.movieId),
    );
    await user.save();
    return sendCart(req, res, "Removed from cart");
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: "Could not remove from cart" });
  }
};

module.exports = { getCart, addToCart, removeFromCart, validCart };
