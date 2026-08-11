const cron = require("node-cron");
const { safeSend } = require("../utils/discordUtils");
const TRC_CHANNEL_ID = process.env.TRC_CHANNEL_ID;

/**
 * @todo TO-DO 동적 스케줄 처리로 변경 필요
 * @param {*} client
 * @description 디스코드 스케줄
 */
const cronSchedule = async (client) => {
  sendMessage(client);
};

const sendMessage = async (client) => {
  // 월~일 오후 5시
  cron.schedule("0 17 * * 0-6", async () => {
    const channel = client.channels.cache.get(TRC_CHANNEL_ID);
    await safeSend(channel, "```19:30 시작합니다. 시작 5분전에 대기해주세요.```");
  });
};

module.exports = {
  cronSchedule,
};
