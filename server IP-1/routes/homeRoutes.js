const express = require("express");
const TodoistController = require("../controllers/todoistController");

const router = express.Router();
// const authentication = require("../middlewares/authenticate");

// router.use(authentication);

router.get("/list", TodoistController.getTasks);
router.post("/create", TodoistController.createTask);
router.put("/update/:id", TodoistController.updateTask);
router.delete("/delete/:id", TodoistController.deleteTask);
router.put("/complete/:id", TodoistController.completeTask);

router.get("/tes", (req, res) => {
  res.send("tes");
});

module.exports = router;
