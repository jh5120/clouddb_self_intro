require('dotenv').config();
const mysql = require('mysql2/promise');

// RDS MySQL 커넥션 풀
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'self_intro',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+09:00',
});

module.exports = pool;
