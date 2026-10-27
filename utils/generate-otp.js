const generateOTP = require("otp-generator");

const generateCode = () =>
  generateOTP.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

const codeExpiry = () => Date.now() + 10 * 60 * 1000;

module.exports = { generateCode, codeExpiry };
