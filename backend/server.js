require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "8mb" }));

const SESSION_DAYS = 30;

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("hex"));
    });
  });
}

async function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

async function verifyPassword(password, storedValue) {
  try {
    const [salt, storedHash] = storedValue.split(":");
    if (!salt || !storedHash) return false;

    const derivedHash = await hashPassword(password, salt);
    const a = Buffer.from(storedHash, "hex");
    const b = Buffer.from(derivedHash, "hex");

    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

async function ensureDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS user_id INTEGER
    REFERENCES users(id)
    ON DELETE CASCADE;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id
    ON tasks(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
    ON sessions(token_hash);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      last_working_day DATE NOT NULL,
      classes_per_week INTEGER NOT NULL,
      target NUMERIC(5,2) NOT NULL,
      attended INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_attendance_user_id
    ON attendance(user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cgpa_data (
      user_id INTEGER PRIMARY KEY
      REFERENCES users(id)
      ON DELETE CASCADE,
      semesters JSONB NOT NULL DEFAULT '[]'::jsonb,
      current_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
      semester_name VARCHAR(255) NOT NULL DEFAULT 'Semester 1',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS timetable (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day VARCHAR(20) NOT NULL,
      time VARCHAR(10) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      room VARCHAR(255),
      faculty VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_timetable_user_id
    ON timetable(user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      url TEXT,
      file_name TEXT,
      file_data TEXT,
      mime_type VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_resources_user_id
    ON resources(user_id);
  `);

  await pool.query(`
    DELETE FROM sessions
    WHERE expires_at <= CURRENT_TIMESTAMP;
  `);
}

async function createSession(userId) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);

  const expiresAt = new Date(
    Date.now() +
      SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  await pool.query(
    `
    INSERT INTO sessions
      (user_id, token_hash, expires_at)
    VALUES
      ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt]
  );

  return token;
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email
      FROM sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > CURRENT_TIMESTAMP
      `,
      [hashSessionToken(token)]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid or expired session",
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error(
      "Authentication check failed:",
      error.message
    );

    res.status(500).json({
      error: "Authentication check failed",
    });
  }
}

app.get("/", (req, res) => {
  res.json({
    message: "CampusOS backend is running",
  });
});

// AUTH - SIGNUP
app.post("/api/auth/signup", async (req, res) => {
  const client = await pool.connect();

  try {
    const name = String(
      req.body.name || ""
    ).trim();

    const email = String(
      req.body.email || ""
    ).trim().toLowerCase();

    const password = String(
      req.body.password || ""
    );

    if (!name || name.length < 2) {
      return res.status(400).json({
        error: "Please enter a valid name.",
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "Password must be at least 6 characters.",
      });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error:
          "An account with this email already exists.",
      });
    }

    const passwordHash =
      await createPasswordHash(password);

    await client.query("BEGIN");

    const userResult = await client.query(
      `
      INSERT INTO users
        (name, email, password_hash)
      VALUES
        ($1, $2, $3)
      RETURNING
        id,
        name,
        email
      `,
      [name, email, passwordHash]
    );

    const user = userResult.rows[0];

    const userCount = await client.query(
      "SELECT COUNT(*) FROM users"
    );

    if (Number(userCount.rows[0].count) === 1) {
      await client.query(
        `
        UPDATE tasks
        SET user_id = $1
        WHERE user_id IS NULL
        `,
        [user.id]
      );
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);

    const expiresAt = new Date(
      Date.now() +
        SESSION_DAYS * 24 * 60 * 60 * 1000
    );

    await client.query(
      `
      INSERT INTO sessions
        (user_id, token_hash, expires_at)
      VALUES
        ($1, $2, $3)
      `,
      [user.id, tokenHash, expiresAt]
    );

    await client.query("COMMIT");

    res.status(201).json({
      user: publicUser(user),
      token,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Signup failed:",
      error.message
    );

    res
      .status(error.code === "23505" ? 409 : 500)
      .json({
        error:
          error.code === "23505"
            ? "An account with this email already exists."
            : "Could not create your account.",
      });
  } finally {
    client.release();
  }
});

// AUTH - LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(
      req.body.email || ""
    ).trim().toLowerCase();

    const password = String(
      req.body.password || ""
    );

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password_hash
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Incorrect email or password.",
      });
    }

    const user = result.rows[0];

    if (
      !(await verifyPassword(
        password,
        user.password_hash
      ))
    ) {
      return res.status(401).json({
        error: "Incorrect email or password.",
      });
    }

    const token = await createSession(user.id);

    res.json({
      user: publicUser(user),
      token,
    });
  } catch (error) {
    console.error(
      "Login failed:",
      error.message
    );

    res.status(500).json({
      error: "Could not log you in.",
    });
  }
});

// AUTH - CURRENT USER
app.get(
  "/api/auth/me",
  requireAuth,
  (req, res) => {
    res.json({
      user: publicUser(req.user),
    });
  }
);

// AUTH - LOGOUT
app.post(
  "/api/auth/logout",
  requireAuth,
  async (req, res) => {
    try {
      const token = (
        req.headers.authorization || ""
      ).split(" ")[1];

      if (token) {
        await pool.query(
          `
          DELETE FROM sessions
          WHERE token_hash = $1
          `,
          [hashSessionToken(token)]
        );
      }

      res.json({
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error(
        "Logout failed:",
        error.message
      );

      res.status(500).json({
        error: "Could not log out.",
      });
    }
  }
);

// GET ALL TASKS
app.get(
  "/api/tasks",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          title,
          subject,
          due_date AS "dueDate",
          priority,
          type,
          completed
        FROM tasks
        WHERE user_id = $1
        ORDER BY due_date ASC
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(
        "Failed to fetch tasks:",
        error.message
      );

      res.status(500).json({
        error: "Failed to fetch tasks",
      });
    }
  }
);

// CREATE TASK
app.post(
  "/api/tasks",
  requireAuth,
  async (req, res) => {
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
          error:
            "Title and due date are required",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO tasks
        (
          title,
          subject,
          due_date,
          priority,
          type,
          completed,
          user_id
        )
        VALUES
        ($1, $2, $3, $4, $5, FALSE, $6)
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
          req.user.id,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error(
        "Failed to create task:",
        error.message
      );

      res.status(500).json({
        error: "Failed to create task",
      });
    }
  }
);

// UPDATE TASK
app.put(
  "/api/tasks/:id",
  requireAuth,
  async (req, res) => {
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
          error:
            "Title and due date are required",
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
          AND user_id = $8
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
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(
        "Failed to update task:",
        error.message
      );

      res.status(500).json({
        error: "Failed to update task",
      });
    }
  }
);

// COMPLETE / INCOMPLETE TASK
app.patch(
  "/api/tasks/:id/completed",
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { completed } = req.body;

      if (typeof completed !== "boolean") {
        return res.status(400).json({
          error:
            "Completed must be true or false",
        });
      }

      const result = await pool.query(
        `
        UPDATE tasks
        SET completed = $1
        WHERE id = $2
          AND user_id = $3
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
          completed,
          id,
          req.user.id,
        ]
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
        error:
          "Failed to update task completion",
      });
    }
  }
);

// DELETE TASK
app.delete(
  "/api/tasks/:id",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM tasks
        WHERE id = $1
          AND user_id = $2
        RETURNING id
        `,
        [req.params.id, req.user.id]
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
      console.error(
        "Failed to delete task:",
        error.message
      );

      res.status(500).json({
        error: "Failed to delete task",
      });
    }
  }
);

// ATTENDANCE - GET
app.get(
  "/api/attendance",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          subject,
          TO_CHAR(
            last_working_day,
            'YYYY-MM-DD'
          ) AS "lastWorkingDay",
          classes_per_week AS "classesPerWeek",
          target,
          attended,
          total
        FROM attendance
        WHERE user_id = $1
        ORDER BY id DESC
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(
        "Failed to fetch attendance:",
        error.message
      );

      res.status(500).json({
        error: "Failed to load attendance.",
      });
    }
  }
);

// ATTENDANCE - CREATE
app.post(
  "/api/attendance",
  requireAuth,
  async (req, res) => {
    try {
      const {
        subject,
        lastWorkingDay,
        classesPerWeek,
        target,
        attended,
        total,
      } = req.body;

      if (
        !subject ||
        !lastWorkingDay ||
        Number(classesPerWeek) <= 0 ||
        Number(total) < 0 ||
        Number(attended) < 0 ||
        Number(attended) >
          Number(total) ||
        Number(target) < 1 ||
        Number(target) > 100
      ) {
        return res.status(400).json({
          error:
            "Please enter valid attendance details.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO attendance
        (
          user_id,
          subject,
          last_working_day,
          classes_per_week,
          target,
          attended,
          total
        )
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          subject,
          TO_CHAR(
            last_working_day,
            'YYYY-MM-DD'
          ) AS "lastWorkingDay",
          classes_per_week AS "classesPerWeek",
          target,
          attended,
          total
        `,
        [
          req.user.id,
          subject.trim(),
          lastWorkingDay,
          Number(classesPerWeek),
          Number(target),
          Number(attended),
          Number(total),
        ]
      );

      res.status(201).json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "Failed to create attendance:",
        error.message
      );

      res.status(500).json({
        error: "Could not save attendance.",
      });
    }
  }
);

// ATTENDANCE - UPDATE
app.put(
  "/api/attendance/:id",
  requireAuth,
  async (req, res) => {
    try {
      const {
        subject,
        lastWorkingDay,
        classesPerWeek,
        target,
        attended,
        total,
      } = req.body;

      if (
        !subject ||
        !lastWorkingDay ||
        Number(classesPerWeek) <= 0 ||
        Number(total) < 0 ||
        Number(attended) < 0 ||
        Number(attended) >
          Number(total) ||
        Number(target) < 1 ||
        Number(target) > 100
      ) {
        return res.status(400).json({
          error:
            "Please enter valid attendance details.",
        });
      }

      const result = await pool.query(
        `
        UPDATE attendance
        SET
          subject = $1,
          last_working_day = $2,
          classes_per_week = $3,
          target = $4,
          attended = $5,
          total = $6
        WHERE id = $7
          AND user_id = $8
        RETURNING
          id,
          subject,
          TO_CHAR(
            last_working_day,
            'YYYY-MM-DD'
          ) AS "lastWorkingDay",
          classes_per_week AS "classesPerWeek",
          target,
          attended,
          total
        `,
        [
          subject.trim(),
          lastWorkingDay,
          Number(classesPerWeek),
          Number(target),
          Number(attended),
          Number(total),
          req.params.id,
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Attendance record not found.",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(
        "Failed to update attendance:",
        error.message
      );

      res.status(500).json({
        error: "Could not update attendance.",
      });
    }
  }
);

// ATTENDANCE - DELETE
app.delete(
  "/api/attendance/:id",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM attendance
        WHERE id = $1
          AND user_id = $2
        RETURNING id
        `,
        [req.params.id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Attendance record not found.",
        });
      }

      res.json({
        message:
          "Attendance deleted successfully",
        id: result.rows[0].id,
      });
    } catch (error) {
      console.error(
        "Failed to delete attendance:",
        error.message
      );

      res.status(500).json({
        error:
          "Could not delete attendance.",
      });
    }
  }
);

// CGPA - GET
app.get(
  "/api/cgpa",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          semesters,
          current_subjects AS "currentSubjects",
          semester_name AS "semesterName"
        FROM cgpa_data
        WHERE user_id = $1
        `,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.json({
          semesters: [],
          currentSubjects: [],
          semesterName: "Semester 1",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(
        "Failed to load CGPA:",
        error.message
      );

      res.status(500).json({
        error: "Failed to load CGPA data.",
      });
    }
  }
);

// CGPA - SAVE
app.put(
  "/api/cgpa",
  requireAuth,
  async (req, res) => {
    try {
      const semesters =
        Array.isArray(req.body.semesters)
          ? req.body.semesters
          : [];

      const currentSubjects =
        Array.isArray(
          req.body.currentSubjects
        )
          ? req.body.currentSubjects
          : [];

      const semesterName =
        String(
          req.body.semesterName ||
            "Semester 1"
        ).trim() || "Semester 1";

      const result = await pool.query(
        `
        INSERT INTO cgpa_data
        (
          user_id,
          semesters,
          current_subjects,
          semester_name,
          updated_at
        )
        VALUES
        (
          $1,
          $2::jsonb,
          $3::jsonb,
          $4,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          semesters =
            EXCLUDED.semesters,
          current_subjects =
            EXCLUDED.current_subjects,
          semester_name =
            EXCLUDED.semester_name,
          updated_at =
            CURRENT_TIMESTAMP
        RETURNING
          semesters,
          current_subjects AS "currentSubjects",
          semester_name AS "semesterName"
        `,
        [
          req.user.id,
          JSON.stringify(semesters),
          JSON.stringify(currentSubjects),
          semesterName,
        ]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error(
        "Failed to save CGPA:",
        error.message
      );

      res.status(500).json({
        error: "Could not save CGPA data.",
      });
    }
  }
);

// TIMETABLE - GET
app.get(
  "/api/timetable",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          day,
          time,
          subject,
          room,
          faculty
        FROM timetable
        WHERE user_id = $1
        ORDER BY
          CASE day
            WHEN 'Monday' THEN 1
            WHEN 'Tuesday' THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday' THEN 4
            WHEN 'Friday' THEN 5
            WHEN 'Saturday' THEN 6
            ELSE 7
          END,
          time
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(
        "Failed to load timetable:",
        error.message
      );

      res.status(500).json({
        error: "Failed to load timetable.",
      });
    }
  }
);

// TIMETABLE - CREATE
app.post(
  "/api/timetable",
  requireAuth,
  async (req, res) => {
    try {
      const {
        day,
        time,
        subject,
        room,
        faculty,
      } = req.body;

      if (
        !subject ||
        !day ||
        !time
      ) {
        return res.status(400).json({
          error:
            "Day, time and subject are required.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO timetable
        (
          user_id,
          day,
          time,
          subject,
          room,
          faculty
        )
        VALUES
        ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          day,
          time,
          subject,
          room,
          faculty
        `,
        [
          req.user.id,
          day,
          time,
          subject.trim(),
          room || "",
          faculty || "",
        ]
      );

      res.status(201).json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "Failed to create timetable entry:",
        error.message
      );

      res.status(500).json({
        error: "Could not add class.",
      });
    }
  }
);

// TIMETABLE - DELETE
app.delete(
  "/api/timetable/:id",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM timetable
        WHERE id = $1
          AND user_id = $2
        RETURNING id
        `,
        [req.params.id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Class not found.",
        });
      }

      res.json({
        message:
          "Class removed successfully",
        id: result.rows[0].id,
      });
    } catch (error) {
      console.error(
        "Failed to delete timetable entry:",
        error.message
      );

      res.status(500).json({
        error: "Could not remove class.",
      });
    }
  }
);

// RESOURCES - GET
app.get(
  "/api/resources",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          subject,
          title,
          type,
          url,
          file_name AS "fileName",
          file_data AS "fileData",
          mime_type AS "mimeType"
        FROM resources
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(
        "Failed to load resources:",
        error.message
      );

      res.status(500).json({
        error: "Failed to load resources.",
      });
    }
  }
);

// RESOURCES - CREATE
app.post(
  "/api/resources",
  requireAuth,
  async (req, res) => {
    try {
      const {
        subject,
        title,
        type,
        url = null,
        fileName = null,
        fileData = null,
        mimeType = null,
      } = req.body;

      if (
        !subject ||
        !title ||
        !type
      ) {
        return res.status(400).json({
          error:
            "Subject, title and resource type are required.",
        });
      }

      if (
        type === "Website" &&
        !url
      ) {
        return res.status(400).json({
          error:
            "Website URL is required.",
        });
      }

      if (
        (type === "PDF" ||
          type === "Image") &&
        (!fileName ||
          !fileData ||
          !mimeType)
      ) {
        return res.status(400).json({
          error:
            "Uploaded file data is required.",
        });
      }

      if (
        fileData &&
        fileData.length >
          6 * 1024 * 1024
      ) {
        return res.status(413).json({
          error:
            "Uploaded file is too large.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO resources
        (
          user_id,
          subject,
          title,
          type,
          url,
          file_name,
          file_data,
          mime_type
        )
        VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          subject,
          title,
          type,
          url,
          file_name AS "fileName",
          file_data AS "fileData",
          mime_type AS "mimeType"
        `,
        [
          req.user.id,
          subject.trim(),
          title.trim(),
          type,
          url,
          fileName,
          fileData,
          mimeType,
        ]
      );

      res.status(201).json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "Failed to create resource:",
        error.message
      );

      res.status(500).json({
        error: "Could not add resource.",
      });
    }
  }
);

// RESOURCES - DELETE
app.delete(
  "/api/resources/:id",
  requireAuth,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        DELETE FROM resources
        WHERE id = $1
          AND user_id = $2
        RETURNING id
        `,
        [
          req.params.id,
          req.user.id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Resource not found.",
        });
      }

      res.json({
        message:
          "Resource deleted successfully",
        id: result.rows[0].id,
      });
    } catch (error) {
      console.error(
        "Failed to delete resource:",
        error.message
      );

      res.status(500).json({
        error:
          "Could not delete resource.",
      });
    }
  }
);

const PORT =
  process.env.PORT || 5000;

ensureDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `CampusOS backend running on http://localhost:${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(
      "Database initialization failed:",
      error.message
    );

    process.exit(1);
  });