const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: {
      type: String,
      required: function () {
        return !this.googleSub;
      },
    },
    userName: { type: String, required: true },
    profileImage: {
      type: String,
      default:
        "https://res.cloudinary.com/dwshzqcf2/image/upload/v1787325165/f76lkpo5tr5goszhfrre.png",
    },
    age: {
      type: String,
      required: true,
    },
    bio: { type: String, default: "", maxlength: 300 },
    googleSub: {
      type: String,
      required: false,
      sparse: true,
      unique: true,
    },
    emailIsChanging: {
      type: Boolean,
      default: false,
    },
    passwordIsForogtten: {
      type: Boolean,
      default: false,
    },
    changeEmail: {
      type: String,
      required: false,
    },
    resetAllowedUntil: { type: Date },
    verified: { type: Boolean, default: false },
    token: { type: String },
    otp: { type: Number },
    otpExpiry: { type: Date },

    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: "movie" }],

    banned: { type: Boolean, default: false },
    suspendedUntil: { type: Date },

    role: {
      type: String,
      default: "user",
      lowercase: true,
      enum: ["user", "admin"],
    },
  },
  { timestamps: true },
);

const usermodel = mongoose.model("user", userSchema);
module.exports = usermodel;
