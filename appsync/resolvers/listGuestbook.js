// Query.listGuestbook 리졸버 (런타임: APPSYNC_JS, 데이터 소스: GuestbookTable)
// 파티션 키 GUESTBOOK 으로 Query → 정렬 키(작성 시각) 역순 = 최신순
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const limit = ctx.args.limit && ctx.args.limit > 0 && ctx.args.limit < 50 ? ctx.args.limit : 50;

  return {
    operation: 'Query',
    query: {
      expression: 'pk = :pk',
      expressionValues: util.dynamodb.toMapValues({ ':pk': 'GUESTBOOK' }),
    },
    scanIndexForward: false, // 최신 글 먼저
    limit,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result.items;
}
