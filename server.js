require('dotenv').config();
const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// 프론트엔드가 쓸 AppSync 주소·API 키를 .env 에서 읽어 내려줌 (키를 깃에 올리지 않기 위해)
app.get('/config.js', (req, res) => {
  const config = {
    url: process.env.APPSYNC_URL || '',
    apiKey: process.env.APPSYNC_API_KEY || '',
  };
  res.type('application/javascript').send(`window.APPSYNC_CONFIG = ${JSON.stringify(config)};`);
});

app.use(express.static(path.join(__dirname, 'public')));

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    appsyncConfigured: Boolean(process.env.APPSYNC_URL && process.env.APPSYNC_API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
