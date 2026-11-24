require('dotenv').config();
const path = require('path');
const express = require('express');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 헬스 체크 (EC2/로드밸런서 확인용) — DB 연결까지 확인
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// 방명록 목록 (최신순 50개)
app.get('/api/guestbook', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, message, created_at FROM guestbook ORDER BY id DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '방명록을 불러오지 못했어요.' });
  }
});

// 방명록 작성
app.post('/api/guestbook', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const message = String(req.body?.message ?? '').trim();

  if (!name || name.length > 30) {
    return res.status(400).json({ error: '이름은 1~30자로 입력해 주세요.' });
  }
  if (!message || message.length > 500) {
    return res.status(400).json({ error: '메시지는 1~500자로 입력해 주세요.' });
  }

  try {
    // 플레이스홀더(?)로 SQL 인젝션 방지
    const [result] = await pool.execute(
      'INSERT INTO guestbook (name, message) VALUES (?, ?)',
      [name, message]
    );
    const [rows] = await pool.execute(
      'SELECT id, name, message, created_at FROM guestbook WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '저장하지 못했어요.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
