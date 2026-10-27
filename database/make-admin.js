require("dotenv").config();
const mongoose = require("mongoose");
const connect = require("./connect.js");
const usermodel = require("../models/user.js");

const run = async () => {
  const email = process.argv[2];
  if (!email) {
    console.log("Usage: npm run make-admin -- you@mail.com");
    process.exit(1);
  }

  await connect();
  const user = await usermodel.findOneAndUpdate(
    { email },
    { role: "admin" },
    { returnDocument: "after" },
  );
  console.log(user ? `${email} is now an admin` : `No user with ${email}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
