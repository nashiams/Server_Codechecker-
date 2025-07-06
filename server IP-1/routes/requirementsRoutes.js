const express = require("express");

const CodeCheckController = require("../controllers/codecheckController");
const router = express.Router();
const authentication = require("../middlewares/authenticate");

router.use(authentication);
// router.post("/", RequirementsController.submitRequirements);
router.post("/", CodeCheckController.submitRequirements);
router.get("/tes", (req, res) => {
  res.send("tes");
});

module.exports = router;
