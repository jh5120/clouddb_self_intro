// Mutation.addGuestbook 리졸버 (런타임: APPSYNC_JS, 데이터 소스: GuestbookTable)
// 방명록 글 1개를 DynamoDB에 PutItem 으로 저장
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const name = ctx.args.name.trim();
  const message = ctx.args.message.trim();

  if (name.length < 1 || name.length > 30) {
    util.error('이름은 1~30자로 입력해 주세요.', 'ValidationError');
  }
  if (message.length < 1 || message.length > 500) {
    util.error('메시지는 1~500자로 입력해 주세요.', 'ValidationError');
  }

  const id = util.autoId();
  const createdAt = util.time.nowISO8601();

  return {
    operation: 'PutItem',
    // 파티션 키: 모든 글을 같은 묶음(GUESTBOOK)에 둠
    // 정렬 키: 작성 시각#id → 시간순 정렬 + 같은 시각에 써도 겹치지 않음
    key: util.dynamodb.toMapValues({ pk: 'GUESTBOOK', sk: `${createdAt}#${id}` }),
    attributeValues: util.dynamodb.toMapValues({ id, name, message, createdAt }),
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
