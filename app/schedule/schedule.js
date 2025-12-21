const cron = require("node-cron");
const TRC_GUILD_ID = process.env.TRC_GUILD_ID;
const TRC_CHANNEL_ID = process.env.TRC_CHANNEL_ID;
const TRC_ALARM_CHANNEL_ID = process.env.TRC_ALARM_CHANNEL_ID;
const eventService = require("../services/eventService");
const inhouseService = require("../services/inhouseService");

/**
 * @todo TO-DO 동적 스케쥴 처리로 변경 필요
 * @param {*} client 
 * @description 디스코드 스케쥴
 */
const cronSchedule = async (client) => {
  sendMessage(client);
};

const sendMessage = async (client) => {
  // 월~토 오후 5시 (일요일 제외: 0이 일요일)
  cron.schedule("0 17 * * 1-6", async () => {
    const channel = await client.channels.cache.get(TRC_CHANNEL_ID);
    if (channel) {
      channel.send("```19:30 시작합니다. 시작 5분전에 대기해주세요.```");
    }
  });

  // 일요일 오후 3시
  cron.schedule("0 15 * * 0", async () => {
    const channel = client.channels.cache.get(TRC_CHANNEL_ID);
    if (channel) {
      channel.send("```17:00 시작합니다. 시작 5분전에 대기해주세요.```");
    }
  });
};

module.exports = {
  cronSchedule,
};
