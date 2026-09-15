require("dotenv").config();

const pool = require("./db");

async function checkDatabase() {
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );

    console.log("Tables in CampusOS database:");
    console.log(result.rows);
  } catch (error) {
    console.error("Database check failed:", error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();