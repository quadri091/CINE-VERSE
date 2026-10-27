const movieStatus = (movie, now = new Date()) => {
  const start = new Date(movie.startTime);
  const end = new Date(start.getTime() + Number(movie.duration) * 60 * 1000);
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "ended";
};

const minAge = { PG: 0, "13+": 13, "16+": 16, "18+": 18 };

const canWatch = (user, movie) =>
  Number(user.age) >= (minAge[movie.rating] ?? 0);

const notEnded = (now = new Date()) => ({
  $expr: {
    $gt: [{ $add: ["$startTime", { $multiply: ["$duration", 60000] }] }, now],
  },
});

const hidden = "-videoUrl -reminderSent -liveSent";

const publicMovie = (movie) => {
  const { videoUrl, reminderSent, liveSent, ...rest } = movie.toObject
    ? movie.toObject()
    : movie;
  return rest;
};

module.exports = { movieStatus, canWatch, notEnded, hidden, publicMovie };
