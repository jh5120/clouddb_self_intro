# 디버깅 이력서 — 자기소개 웹앱 3주차 (MVP 구현)

- 작성자: 이주현
- 구성: EC2(Express) → AppSync(GraphQL) → DynamoDB
- 기간: 2026.11.__ ~ 2026.11.__

> 작성 방법: 실제로 겪은 오류만 남기고, 겪지 않은 항목은 지웁니다.
> 각 항목에 오류 화면 캡처와 해결 후 캡처를 함께 붙이면 좋습니다.
> 아래 #1~#6은 이 구성에서 자주 나는 오류를 미리 정리해 둔 것이므로, 실제 날짜·메시지·캡처로 바꿔 주세요.

## 요약

| # | 단계 | 오류 | 원인 | 해결 | 상태 |
|---|---|---|---|---|---|
| 1 | DB 전환 | 방명록 구조 변경 필요 | 과제 요구사항이 DynamoDB+AppSync | RDS → DynamoDB/AppSync로 전환 | 해결 |
| 2 | IAM | AccessDeniedException | 역할 정책에 권한/ARN 누락 | 테이블 ARN·액션 수정 | |
| 3 | 리졸버 | ValidationException (key 불일치) | 키 이름이 테이블 키와 다름 | `pk`/`sk`로 통일 | |
| 4 | 프론트 | 401 UnauthorizedException | API 키 누락·만료 | `.env` 갱신, 키 연장 | |
| 5 | 프론트 | 방명록이 안 뜸 (필드명) | `created_at` → `createdAt` | app.js 필드명 수정 | |
| 6 | 배포 | 페이지는 뜨는데 "설정이 비어 있어요" | EC2에 `.env` 없음 | `.env` 작성 후 pm2 재시작 | |

---

## #1. 방명록 저장소를 RDS에서 DynamoDB로 전환

- **발생 일시**: 2026.11.__
- **상황**: 2주차까지 EC2 + Express + RDS PostgreSQL로 방명록을 구현함
- **문제**: 3주차 진행 사항은 DynamoDB 테이블 + AppSync GraphQL API 기준이라 기존 구조로는 요구사항을 만족하지 못함
- **원인 분석**: 방명록은 "글 추가 + 최신순 조회"만 필요해 관계형 JOIN이 필요 없음. 키-값 조회만으로 충분하므로 DynamoDB가 적합
- **해결 과정**
  1. 방명록을 파티션 키 `pk = GUESTBOOK`, 정렬 키 `sk = 작성시각#id`로 설계
  2. Express의 `/api/guestbook` API와 `pg` 의존성을 제거하고, 프론트엔드가 AppSync를 직접 호출하도록 변경
  3. AppSync URL·API 키는 깃에 올리지 않도록 서버가 `.env`에서 읽어 `/config.js`로 내려주게 함
- **결과**: EC2는 페이지 서빙만, 데이터 저장·조회는 AppSync → DynamoDB가 담당
- **배운 점**: 접근 패턴(최신순 조회)을 먼저 정하고 키를 설계하면 Scan 없이 Query 한 번으로 해결됨

## #2. AppSync에서 DynamoDB 접근 거부 (AccessDeniedException)

- **발생 일시**: 2026.11.__
- **오류 메시지**:
  ```
  User: arn:aws:sts::<계정ID>:assumed-role/AppSyncGuestbookRole/... is not authorized to perform: dynamodb:PutItem on resource: ...
  ```
- **원인 분석**: (예) 정책의 `Resource`에 `<계정ID>` 자리 표시자를 그대로 두었거나, 테이블 이름 대소문자가 달랐음
- **해결 과정**: 테이블 상세의 ARN을 그대로 복사해 정책 수정 → 정책 저장 후 몇 초 뒤 재시도
- **결과**: 저장 성공 (캡처)
- **배운 점**: 최소 권한 정책은 Action과 Resource를 정확히 맞춰야 함

## #3. 리졸버 키 불일치 (ValidationException)

- **발생 일시**: 2026.11.__
- **오류 메시지**:
  ```
  The provided key element does not match the schema
  ```
- **원인 분석**: 테이블 키는 `pk`/`sk`인데 리졸버에서 `id` 등 다른 이름으로 키를 보냄
- **해결 과정**: 리졸버의 `key`를 `{ pk, sk }`로 수정
- **결과**: 저장 성공

## #4. API 키 인증 실패 (401 UnauthorizedException)

- **발생 일시**: 2026.11.__
- **오류 메시지**: 브라우저 콘솔 `UnauthorizedException: You are not authorized to make this call.`
- **원인 분석**: `x-api-key` 헤더 값이 비었거나 API 키 만료(기본 7일)
- **해결 과정**: AppSync 설정에서 키 확인·만료일 연장 → `.env` 수정 → `pm2 restart self-intro`
- **결과**: 조회 정상

## #5. 방명록 날짜가 비어 보임

- **발생 일시**: 2026.11.__
- **원인 분석**: 응답 필드명이 RDS 때의 `created_at`에서 GraphQL 스키마의 `createdAt`으로 바뀜
- **해결 과정**: `public/app.js`의 `item.created_at` → `item.createdAt`
- **결과**: 날짜 정상 표시

## #6. EC2 배포 후 "AppSync 설정(.env)이 비어 있어요"

- **발생 일시**: 2026.11.__
- **원인 분석**: `.env`는 `.gitignore`에 있어 `git clone`으로 받아지지 않음
- **해결 과정**: EC2에서 `.env` 작성 → `pm2 restart self-intro` → `/health`에서 `appsyncConfigured: true` 확인
- **결과**: 방명록 작성·조회 정상

---

## MVP 화면 캡처 체크리스트

- [ ] 전체 페이지 (Home · 소개 · 프로젝트 · 연락처 · 방명록)
- [ ] DynamoDB `Guestbook` 테이블 설정 (파티션 키 `pk`, 정렬 키 `sk`)
- [ ] IAM 역할 `AppSyncGuestbookRole`과 정책 JSON (PutItem·Query만)
- [ ] AppSync 스키마 화면 + 리졸버 연결 화면
- [ ] AppSync 쿼리 탭에서 mutation·query 실행 결과
- [ ] 웹앱에서 방명록 작성 → 목록 맨 위에 표시된 화면
- [ ] DynamoDB "표 항목 탐색"에 저장된 글이 보이는 화면
