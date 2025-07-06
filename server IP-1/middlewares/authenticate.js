const { User } = require("../models");
const { verifyToken } = require("../helpers/jwt");

const authentication = async (req, res, next) => {
  try {
    const bearerToken = req.headers.authorization;
    if (!bearerToken) {
      throw { name: "Unauthorized", message: "Invalid token" };
    }
    const token = bearerToken.slice("Bearer ".length);
    const payload = verifyToken(token);

    const user = await User.findByPk(payload.id);
    if (!user) {
      throw { name: "Unauthorized", message: "Invalid token" };
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authentication;
