-- 자기소개 웹앱 DB 스키마 (RDS PostgreSQL)
-- self_intro 데이터베이스에 접속한 상태에서 실행 (npm run db:init 이 DB 생성까지 자동으로 처리)

-- 방명록
CREATE TABLE IF NOT EXISTS guestbook (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(30)  NOT NULL,
  message    VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guestbook_created_at ON guestbook (created_at);
