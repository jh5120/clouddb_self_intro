# 자기소개 웹앱 (클라우드 데이터베이스 과제)

AWS 위에서 동작하는 원페이지 자기소개 웹앱입니다.
구성: **Home · 소개 · 프로젝트 · 연락처 · 방명록**

## 아키텍처

```
브라우저 ──HTTP──▶ EC2 (Node.js / Express)  : 정적 페이지 + /config.js 서빙
   │
   └──GraphQL(x-api-key)──▶ AppSync ──IAM 역할──▶ DynamoDB (Guestbook 테이블)
```

| 구분 | 사용 기술 |
|---|---|
| 호스팅 | Amazon EC2 (Amazon Linux 2023), Node.js 18+, Express |
| API | AWS AppSync (GraphQL, API 키 인증, APPSYNC_JS 리졸버) |
| DB | Amazon DynamoDB |
| 권한 | IAM 서비스 역할 (PutItem·Query만 허용하는 최소 권한) |

## 폴더 구조

```
├── server.js                      # Express: 정적 파일 + /config.js + /health
├── public/                        # 프론트엔드 (index.html, style.css, app.js)
├── appsync/
│   ├── schema.graphql             # GraphQL 스키마
│   └── resolvers/
│       ├── addGuestbook.js        # Mutation.addGuestbook → PutItem
│       └── listGuestbook.js       # Query.listGuestbook → Query (최신순)
├── iam/
│   ├── trust-policy.json          # AppSync가 역할을 맡을 수 있게 하는 신뢰 정책
│   └── dynamodb-policy.json       # 최소 권한 정책
├── docs/debugging-log.md          # 디버깅 이력서
└── .env.example                   # 환경변수 예시
```

## DynamoDB 테이블 설계

| 속성 | 역할 | 예시 |
|---|---|---|
| `pk` (String) | **파티션 키** — 모든 방명록 글을 한 묶음으로 | `GUESTBOOK` |
| `sk` (String) | **정렬 키** — `작성시각#id` | `2026-11-26T12:00:00.000Z#a1b2...` |
| `id`, `name`, `message`, `createdAt` | 일반 속성 | |

파티션 키가 같으므로 `Query(pk = GUESTBOOK)` 한 번에 정렬 키(시간) 순서로 가져올 수 있고,
`scanIndexForward: false`로 최신 글부터 받습니다. Scan을 쓰지 않으므로 비용·속도 면에서 유리합니다.
(정렬 키 끝에 id를 붙여 같은 시각에 작성해도 덮어쓰지 않습니다.)

## AWS 설정 순서 (리전: 서울 `ap-northeast-2`)

### 1. DynamoDB 테이블 만들기
1. DynamoDB 콘솔 → **테이블 생성**
2. 테이블 이름 `Guestbook`
3. 파티션 키 `pk` (문자열), 정렬 키 `sk` (문자열)
4. 테이블 설정: **사용자 지정** → 용량 모드 **온디맨드** (사용한 만큼만 과금)
5. 생성 후 테이블 상세 → **ARN** 복사 (IAM 정책에 사용)

### 2. IAM 서비스 역할 만들기 (최소 권한)
1. IAM 콘솔 → 정책 → **정책 생성** → JSON 탭에 `iam/dynamodb-policy.json` 붙여 넣기
   → `Resource`를 1단계에서 복사한 테이블 ARN으로 교체 → 이름 `AppSyncGuestbookPolicy`
2. IAM 콘솔 → 역할 → **역할 생성** → **사용자 지정 신뢰 정책** → `iam/trust-policy.json` 붙여 넣기
3. 권한 정책에서 `AppSyncGuestbookPolicy`만 선택 → 이름 `AppSyncGuestbookRole`

> 최소 권한: 이 앱은 글 저장(PutItem)과 조회(Query)만 하므로 두 동작만, 그리고 `Guestbook` 테이블 하나에만 허용합니다.
> `AmazonDynamoDBFullAccess` 같은 관리형 정책은 쓰지 않습니다.

### 3. AppSync API 만들기
1. AppSync 콘솔 → **API 생성** → **GraphQL API** → **처음부터 설계(Design from scratch)**
2. API 이름 `self-intro-guestbook` → 생성
3. **스키마** 탭 → `appsync/schema.graphql` 내용 붙여 넣기 → 저장
4. **데이터 소스** 탭 → 생성
   - 이름 `GuestbookTable`, 유형 **Amazon DynamoDB 테이블**, 리전 서울, 테이블 `Guestbook`
   - 서비스 역할: **기존 역할 사용** → `AppSyncGuestbookRole`
5. **스키마** 탭 오른쪽 리졸버 목록에서
   - `Mutation.addGuestbook` → **연결(Attach)** → 유닛 리졸버, 런타임 **APPSYNC_JS**, 데이터 소스 `GuestbookTable`
     → 코드 칸에 `appsync/resolvers/addGuestbook.js` 붙여 넣기 → 생성
   - `Query.listGuestbook` → 같은 방법으로 `appsync/resolvers/listGuestbook.js`
6. **설정(Settings)** 탭 → 기본 인증 모드가 **API 키**인지 확인
   → API 엔드포인트 URL과 API 키(`da2-...`) 복사 (API 키는 기본 7일 만료, 필요하면 최대 365일로 연장)

### 4. AppSync 콘솔에서 저장·조회 테스트
**쿼리(Queries)** 탭에서 실행:

```graphql
mutation {
  addGuestbook(name: "테스트", message: "첫 방명록입니다") { id name message createdAt }
}
```

```graphql
query {
  listGuestbook(limit: 10) { id name message createdAt }
}
```

DynamoDB 콘솔 → `Guestbook` → **표 항목 탐색**에서 저장된 항목도 확인합니다.

### 5. EC2에서 실행
```bash
sudo dnf install -y nodejs git
git clone https://github.com/jh5120/clouddb_self_intro.git
cd clouddb_self_intro
npm install
cp .env.example .env && nano .env   # APPSYNC_URL, APPSYNC_API_KEY 입력
sudo npm install -g pm2
pm2 start server.js --name self-intro
```

- EC2 보안 그룹 인바운드: SSH(22, 내 IP), 사용자 지정 TCP(3000, 0.0.0.0/0)
- 브라우저에서 `http://<EC2 퍼블릭 IP>:3000` 접속 → 방명록 작성·조회
- 이미 실행 중이었다면 `git pull && npm install && pm2 restart self-intro`

로컬에서는 `npm install && cp .env.example .env && npm start` 후 http://localhost:3000

## GraphQL API

| 종류 | 이름 | 설명 |
|---|---|---|
| Query | `listGuestbook(limit: Int)` | 방명록 최신순 조회 (최대 50개) |
| Mutation | `addGuestbook(name, message)` | 방명록 작성 (이름 1~30자, 메시지 1~500자) |

## 정리(과금 방지)
- 예전 버전에서 만든 **RDS PostgreSQL 인스턴스**는 더 이상 쓰지 않으므로 삭제하거나 중지합니다.
- 과제가 끝나면 AppSync API, DynamoDB 테이블, EC2 인스턴스를 삭제합니다.
