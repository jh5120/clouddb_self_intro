// DB(self_intro)가 없으면 만들고, schema.sql 을 실행해서 테이블을 만든다: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_NAME = process.env.DB_NAME || 'self_intro';

function config(database) {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  };
}

(async () => {
  if (!/^[a-z_][a-z0-9_]*$/.test(DB_NAME)) {
    throw new Error('DB_NAME 은 영문 소문자/숫자/_ 만 사용해 주세요.');
  }

  // 1) 기본 DB(postgres)에 접속해서 self_intro DB가 없으면 생성
  const admin = new Client(config('postgres'));
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`데이터베이스 생성: ${DB_NAME}`);
  }
  await admin.end();

  // 2) self_intro DB에 접속해서 테이블 생성
  const client = new Client(config(DB_NAME));
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await client.query(sql);
  await client.end();

  console.log(`DB 초기화 완료: ${DB_NAME}.guestbook`);
})().catch((err) => {
  console.error('DB 초기화 실패:', err.message);
  process.exit(1);
});
