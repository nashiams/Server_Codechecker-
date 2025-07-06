const errorHandler = (err, req, res, next) => {
  console.log(err);

  switch (err.name) {
    case "SequelizeValidationError":
    case "SequelizeUniqueConstraintError":
      res.status(400).json({ message: err.errors[0].message });
      return;
    case "BadRequest":
      res.status(400).json({ message: err.message });
      return;
    case "Unauthorized":
    case "JsonWebTokenError":
      res.status(401).json({ message: "Invalid token" });
      return;
    case "NotFound":
      res.status(404).json({ message: "Data not found" });
      return;
    case "Forbidden":
      res.status(403).json({ message: "Forbidden access" });
      return;
    default:
      res.status(500).json({ message: "Internal server error" });
      return;
  }
};

module.exports = errorHandler;
