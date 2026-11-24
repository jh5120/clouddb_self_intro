# 자기소개 웹앱 (클라우드 데이터베이스 과제)

AWS 위에서 동작하는 원페이지 자기소개 웹앱입니다.
구성: **Home · 소개 · 프로젝트 · 연락처 · 방명록**

## 아키텍처

```
브라우저 ──HTTP──▶ EC2 (Node.js / Express) ──5432──▶ RDS (PostgreSQL)
                    └ public/ 정적 페이지 서빙       └ guestbook 테이블
```

| 구분 | 사용 기술 |
|---|---|
| 서버 | Node.js 18+, Express |
| DB | Amazon RDS for PostgreSQL (`pg` 커넥션 풀) |
| 호스팅 | Amazon EC2 (Amazon Linux 2023) |

## 폴더 구조

```
├── server.js          # Express 서버 + 방명록 API
├── db.js              # RDS 커넥션 풀
├── schema.sql         # 테이블 생성 SQL
├── scripts/init-db.js # DB 생성 + schema.sql 실행 스크립트
├── public/            # 프론트엔드 (index.html, style.css, app.js)
└── .env.example       # 환경변수 예시
```

## API

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/guestbook` | 방명록 최신 50개 조회 |
| POST | `/api/guestbook` | 방명록 작성 `{ "name": "...", "message": "..." }` |
| GET | `/health` | 서버·DB 연결 상태 확인 |

## 로컬 실행

```bash
npm install
cp .env.example .env     # DB 접속 정보 입력
npm run db:init          # DB·테이블 생성
npm start                # http://localhost:3000
```

## AWS 배포 순서

### 1. RDS (PostgreSQL) 만들기
1. RDS 콘솔 → 데이터베이스 생성 → **전체 구성** → **PostgreSQL**, 템플릿 **프리 티어**
2. 마스터 사용자 이름(`postgres`)/암호 설정 (→ `.env`의 `DB_USER`, `DB_PASSWORD`)
3. 퍼블릭 액세스 **아니요**, EC2와 같은 VPC 선택
4. 생성 후 **엔드포인트** 복사 (→ `DB_HOST`)

### 2. EC2 만들기
1. EC2 콘솔 → 인스턴스 시작 → **Amazon Linux 2023**, `t2.micro`
2. 보안 그룹 인바운드: SSH(22, 내 IP), 사용자 지정 TCP(3000, 0.0.0.0/0)
3. RDS 보안 그룹 인바운드에 **PostgreSQL(5432) — 소스: EC2 보안 그룹** 추가

### 3. EC2에서 실행
```bash
sudo dnf install -y nodejs git
git clone https://github.com/jh5120/clouddb_self_intro.git
cd clouddb_self_intro
npm install
cp .env.example .env && nano .env   # RDS 정보 입력
npm run db:init
sudo npm install -g pm2
pm2 start server.js --name self-intro
```

브라우저에서 `http://<EC2 퍼블릭 IP>:3000` 접속
(포트 번호 없이 80으로 서비스하려면 nginx 리버스 프록시를 추가)

## pgAdmin으로 RDS 보기 (선택)

RDS를 퍼블릭 액세스 **아니요**로 만들면 내 PC의 pgAdmin에서 바로 접속할 수 없습니다. 과제용으로 pgAdmin을 쓰려면:

1. RDS 수정 → 연결 → 퍼블릭 액세스 **예**
2. RDS 보안 그룹 인바운드에 **PostgreSQL(5432) — 소스: 내 IP** 추가
3. pgAdmin → Register Server → Host: RDS 엔드포인트, Port: 5432, Username: `postgres`, SSL mode: `require`
