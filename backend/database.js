require("dotenv").config();

const pool = require("./db");

async function setupDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        due_date DATE,
        priority VARCHAR(50),
        type VARCHAR(50) DEFAULT 'task'
      );
    `);

    await pool.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'task';
    `);

    await pool.query(`
      UPDATE tasks
      SET type = 'assignment'
      WHERE LOWER(title) LIKE '%assignment%'
      AND (type IS NULL OR type = 'task');
    `);

    await pool.query(`
      UPDATE tasks
      SET type = 'exam'
      WHERE LOWER(title) LIKE '%exam%'
      AND (type IS NULL OR type = 'task');
    `);

    await pool.query(`
      UPDATE tasks
      SET type = 'event'
      WHERE LOWER(title) LIKE '%event%'
      AND (type IS NULL OR type = 'task');
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        department VARCHAR(255),
        icon VARCHAR(20) DEFAULT '📢',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const noticeCount = await pool.query(
      "SELECT COUNT(*) FROM notices"
    );

    if (parseInt(noticeCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO notices (title, department, icon)
        VALUES
        ('Internal examination schedule released', 'Academic Department', '📢'),
        ('Project submission guidelines', 'Department Office', '📄'),
        ('Hackathon registrations are open', 'Student Club', '🎯');
      `);
    }

    console.log("Database tables are ready.");
  } catch (error) {
    console.error("Database setup failed:", error.message);
  } finally {
    await pool.end();
  }
}

setupDatabase();