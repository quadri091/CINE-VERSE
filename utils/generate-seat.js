const generateSeats = (numRows = 6, seatsPerRow = 10) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const seats = [];

  const rows = Number(numRows);
  const perRow = Number(seatsPerRow);
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(perRow) ||
    rows < 1 ||
    rows > alphabet.length ||
    perRow < 1 ||
    rows * perRow !== 60
  ) {
    throw new Error("Cinema seating must contain exactly 60 seats");
  }

  for (let r = 0; r < rows; r++) {
    const rowLetter = alphabet[r];
    for (let s = 1; s <= perRow; s++) {
      seats.push({
        seatNumber: `${rowLetter}${s}`,
        isBooked: false,
      });
    }
  }

  return seats;
};
module.exports = generateSeats;
