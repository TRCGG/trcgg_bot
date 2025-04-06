const cron = require("node-cron");
const TRC_GUILD_ID = process.env.TRC_GUILD_ID;
const TRC_CHANNEL_ID = process.env.TRC_CHANNEL_ID;
const TRC_ALARM_CHANNEL_ID = process.env.TRC_ALARM_CHANNEL_ID;
const eventService = require("../services/eventService");

/**
 * @todo TO-DO 동적 스케쥴 처리로 변경 필요
 * @param {*} client 
 * @description 디스코드 스케쥴
 */
const cronSchedule = async (client) => {
  sendMessage(client);
  alarmEvent(client);
};

const sendMessage = async (client) => {
  cron.schedule("0 17 * * *", async () => {
    const channel = await client.channels.cache.get(TRC_CHANNEL_ID);
    if (channel) {
      channel.send("```19:30 시작합니다. 시작 5분전에 대기해주세요.```");
    }
  });
};


/**
 * @param {*} client 
 * @description 매일 오전 8시 알람 Event 처리
 */
const alarmEvent = async (client) => {
  cron.schedule("0 8 * * *", async () => {
    eventService.notify_alarm(client, TRC_ALARM_CHANNEL_ID, TRC_GUILD_ID).then((result) => {
      console.log("알람 전송 완료");
    });
  });
}

module.exports = {
  cronSchedule,
};
