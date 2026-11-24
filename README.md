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

## S3 · CloudFront 배포 구성 (선택)

정적 파일(`public/`)은 **S3**에 올리고, **CloudFront** 하나로 정적 파일과 API를 같은 도메인에서 서비스하는 구성입니다.
프론트엔드가 `/api/guestbook`을 상대 경로로 호출하므로, 같은 도메인을 쓰면 **코드 수정이나 CORS 설정이 필요 없습니다.**

```
                         ┌─ /*         ──▶ S3 버킷 (index.html, style.css, app.js)  ※ OAC로만 접근
브라우저 ──HTTPS──▶ CloudFront
                         └─ /api/*, /health ──▶ EC2 (Express :3000) ──5432──▶ RDS (PostgreSQL)
```

| 구분 | 역할 |
|---|---|
| S3 | 정적 파일 저장 (퍼블릭 액세스 차단 유지) |
| CloudFront | HTTPS 제공, 정적 파일 캐싱, 경로별로 S3 / EC2 라우팅 |
| EC2 | 방명록 API만 처리 |

### 1. S3 버킷 만들기
1. S3 콘솔 → 버킷 만들기 (예: `clouddb-self-intro-static`), 리전 `ap-northeast-2`
2. **모든 퍼블릭 액세스 차단** 그대로 유지 (CloudFront OAC로만 읽게 함)
3. `public/` 폴더 안의 파일을 업로드
   ```bash
   aws s3 sync public/ s3://clouddb-self-intro-static/ --delete
   ```

### 2. CloudFront 배포 만들기
1. CloudFront 콘솔 → 배포 생성
2. **원본 1 (S3)**: 위 버킷 선택 → 원본 액세스 **Origin access control(OAC)** 생성 후 선택
   - 생성 후 안내되는 **버킷 정책을 복사해 S3 버킷 정책에 붙여넣기**
3. **기본 캐시 동작 (`/*`)** → S3 원본, 뷰어 프로토콜 *Redirect HTTP to HTTPS*, 캐시 정책 `CachingOptimized`
4. 설정 → **기본 루트 객체**: `index.html`
5. **원본 2 (EC2)** 추가: 원본 도메인에 EC2 **퍼블릭 IPv4 DNS** 입력 (IP는 입력 불가)
   - 프로토콜 *HTTP only*, HTTP 포트 `3000`
6. **동작 추가** (`/api/*`, `/health` 각각) → EC2 원본
   - 허용 HTTP 메서드: `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE` (방명록 작성 POST 필요)
   - 캐시 정책: `CachingDisabled` (방명록이 바로 보이도록)
   - 원본 요청 정책: `AllViewerExceptHostHeader`

### 3. 보안 그룹 정리
- EC2 보안 그룹 인바운드의 TCP 3000 소스를 `0.0.0.0/0` 대신 **관리형 접두사 목록 `com.amazonaws.global.cloudfront.origin-facing`** 으로 변경
  → EC2에 직접 접속하지 않고 CloudFront를 통해서만 API 호출

### 4. 접속 및 갱신
- `https://<배포 ID>.cloudfront.net` 으로 접속
- 정적 파일을 수정했다면 다시 업로드 후 캐시 무효화
  ```bash
  aws s3 sync public/ s3://clouddb-self-intro-static/ --delete
  aws cloudfront create-invalidation --distribution-id <배포 ID> --paths "/*"
  ```
- 서버 코드(`server.js`)만 바뀐 경우에는 EC2에서 `git pull && pm2 restart self-intro`

## pgAdmin으로 RDS 보기 (선택)

RDS를 퍼블릭 액세스 **아니요**로 만들면 내 PC의 pgAdmin에서 바로 접속할 수 없습니다. 과제용으로 pgAdmin을 쓰려면:

1. RDS 수정 → 연결 → 퍼블릭 액세스 **예**
2. RDS 보안 그룹 인바운드에 **PostgreSQL(5432) — 소스: 내 IP** 추가
3. pgAdmin → Register Server → Host: RDS 엔드포인트, Port: 5432, Username: `postgres`, SSL mode: `require`
