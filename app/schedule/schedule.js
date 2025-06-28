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
  alarmEvent(client);
  inhouseClear(client);
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
      console.log("알람 전송 완료", result);
    });
  });
}

/**
 * @description 매일 오전 10시에 길드 전체 신청자 메모리 초기화
 */
const inhouseClear = async (client) => {
  cron.schedule("0 10 * * *", () => {
    client.guilds.cache.forEach(async (guild) => {
      const logChannelId = inhouseService.getInhouseLogChannel(guild.id);
      if (!logChannelId) {
        return;
      }

      try {
        const logChannel = await guild.channels.fetch(logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send(
            "```내전 신청자 명단이 초기화되었습니다.```"
          );
        }
      } catch (error) {
        console.error("로그 채널 전송 실패:", error.message);
      }
    });
    inhouseService.inhouseClear(); // 모든 길드 신청자 메모리 초기화
  });
};

module.exports = {
  cronSchedule,
};
