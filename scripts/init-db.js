// schema.sql 을 RDS에 실행해서 DB/테이블을 만든다: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('DB 초기화 완료: self_intro.guestbook');
  await conn.end();
})().catch((err) => {
  console.error('DB 초기화 실패:', err.message);
  process.exit(1);
});
