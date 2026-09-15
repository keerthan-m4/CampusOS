require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "CampusOS backend is running",
  });
});

// GET ALL TASKS
app.get("/api/tasks", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        subject,
        due_date AS "dueDate",
        priority,
        type,
        completed
      FROM tasks
      ORDER BY due_date ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch tasks:", error.message);

    res.status(500).json({
      error: "Failed to fetch tasks",
    });
  }
});

// CREATE TASK
app.post("/api/tasks", async (req, res) => {
  try {
    const {
      title,
      subject,
      dueDate,
      priority,
      type,
    } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({
        error: "Title and due date are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tasks
      (title, subject, due_date, priority, type, completed)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING
        id,
        title,
        subject,
        due_date AS "dueDate",
        priority,
        type,
        completed
      `,
      [
        title,
        subject || "",
        dueDate,
        priority || "Medium",
        type || "task",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to create task:", error.message);

    res.status(500).json({
      error: "Failed to create task",
    });
  }
});

// UPDATE TASK
app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      subject,
      dueDate,
      priority,
      type,
      completed,
    } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({
        error: "Title and due date are required",
      });
    }

    const result = await pool.query(
      `
      UPDATE tasks
      SET
        title = $1,
        subject = $2,
        due_date = $3,
        priority = $4,
        type = $5,
        completed = $6
      WHERE id = $7
      RETURNING
        id,
        title,
        subject,
        due_date AS "dueDate",
        priority,
        type,
        completed
      `,
      [
        title,
        subject || "",
        dueDate,
        priority || "Medium",
        type || "task",
        completed === true,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update task:", error.message);

    res.status(500).json({
      error: "Failed to update task",
    });
  }
});

// MARK TASK COMPLETE / INCOMPLETE
app.patch("/api/tasks/:id/completed", async (req, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;

    if (typeof completed !== "boolean") {
      return res.status(400).json({
        error: "Completed must be true or false",
      });
    }

    const result = await pool.query(
      `
      UPDATE tasks
      SET completed = $1
      WHERE id = $2
      RETURNING
        id,
        title,
        subject,
        due_date AS "dueDate",
        priority,
        type,
        completed
      `,
      [completed, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(
      "Failed to update task completion:",
      error.message
    );

    res.status(500).json({
      error: "Failed to update task completion",
    });
  }
});

// DELETE TASK
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM tasks
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json({
      message: "Task deleted successfully",
      id: result.rows[0].id,
    });
  } catch (error) {
    console.error("Failed to delete task:", error.message);

    res.status(500).json({
      error: "Failed to delete task",
    });
  }
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(
    `CampusOS backend running on http://localhost:${PORT}`
  );
});