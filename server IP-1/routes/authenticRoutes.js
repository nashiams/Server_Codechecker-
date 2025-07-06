const express = require("express");
const router = express.Router();
const UserController = require("../controllers/userController"); //gua ganti jadi  tadinya UserController

router.post("/", UserController.register);
router.post("/login", UserController.login);
router.post("/google", UserController.google);
router.get("/tes", (req, res) => {
  res.send("tes");
});

module.exports = router;
