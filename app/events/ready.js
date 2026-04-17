const { Events } = require("discord.js");
const schedule = require("../schedule/schedule");

/**
 * 디코 실행시 이벤트
 */
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Gmok V2 Logged in as ${client.user.tag}!`);
    schedule.cronSchedule(client);
  },
};
