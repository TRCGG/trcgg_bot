const { BotError } = require('./errors');
const { safeReply } = require('./discordUtils');

module.exports = {
  success: (msg, text) => safeReply(msg, `✅ ${text}`),

  // 5xx는 백엔드 내부 메시지를 감추고, 나머지는 그대로 노출한다.
  error: (msg, error) => {
    if (error instanceof BotError && error.status >= 500) {
      // BotError는 networkUtils에서만 만들어지므로 이미 기록됐다. 여기서 또 남기면 중복이다.
      return safeReply(msg, `⚠️ 오류가 발생했습니다.`);
    }
    return safeReply(msg, `⚠️ ${error.message || "알 수 없는 오류"}`);
  },

  noAuth: (msg) => safeReply(msg, "⛔ 권한이 없습니다."),
};
