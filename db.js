require('dotenv').config();
const { Pool } = require('pg');

// RDS PostgreSQL 커넥션 풀
// RDS PostgreSQL 15+ 는 기본으로 SSL 접속을 요구하므로 SSL 사용 (DB_SSL=false 로 끌 수 있음)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'self_intro',
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
});

module.exports = pool;
