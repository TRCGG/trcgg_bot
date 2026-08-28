const { BotError, ROUTE_NOT_FOUND_TYPE } = require('./errors');
const { safeReply } = require('./discordUtils');

// 사용자에게 보여줄 수 없는 응답: 5xx(내부 메시지), 라우트 404(요청 URL이 본문에 들어 있음).
const isInternal = (error) =>
  error instanceof BotError && (error.status >= 500 || error.type === ROUTE_NOT_FOUND_TYPE);

module.exports = {
  success: (msg, text) => safeReply(msg, `✅ ${text}`),

  // 내부 오류는 감추고, 나머지 4xx는 백엔드 메시지를 그대로 노출한다.
  error: (msg, error) => {
    if (isInternal(error)) {
      // BotError는 networkUtils에서만 만들어지므로 이미 기록됐다. 여기서 또 남기면 중복이다.
      return safeReply(msg, `⚠️ 오류가 발생했습니다.`);
    }
    return safeReply(msg, `⚠️ ${error.message || "알 수 없는 오류"}`);
  },

  noAuth: (msg) => safeReply(msg, "⛔ 권한이 없습니다."),
};
