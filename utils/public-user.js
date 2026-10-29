const publicUser = (user) => ({
  _id: user._id,
  userName: user.userName,
  email: user.email,
  profileImage: user.profileImage,
  role: user.role,
  age: user.age,
  bio: user.bio || "",
  verified: user.verified,
  google: !!user.googleSub,
});

module.exports = publicUser;
