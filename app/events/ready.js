const { Events } = require("discord.js");
const schedule = require("../schedule/schedule");
const botCallback = require("../server/botCallback");

/**
 * 디코 실행시 이벤트
 */
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Gmok V2 Logged in as ${client.user.tag}!`);
    schedule.cronSchedule(client);
    // 백엔드 → 봇 콜백 수신 서버 기동 (TRC-226). 실패해도 봇 본체는 계속 동작.
    try {
      botCallback.start(client);
    } catch (error) {
      console.error("[botCallback] 서버 시작 중 오류:", error);
    }
  },
};
