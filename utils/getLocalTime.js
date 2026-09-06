const moment = require("moment-timezone");

const getLocalTime = (location) => {
  switch (location) {
    case "New York":
      return moment().tz("America/New_York").format("YYYY-MM-DD HH:mm:ss");

    case "Japan":
      return moment().tz("Asia/Tokyo").format("YYYY-MM-DD HH:mm:ss");

    case "Kathmandu":
      return moment().tz("Asia/Kathmandu").format("YYYY-MM-DD HH:mm:ss");

    default:
      return moment().format("YYYY-MM-DD HH:mm:ss");
  }
};

module.exports = getLocalTime;