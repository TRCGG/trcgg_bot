const { Events } = require("discord.js");
const schedule = require("../schedule/schedule");
const inhouseService = require("../services/inhouseService");

/**
 * 디코 실행시 이벤트
 */
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}!`);
    schedule.cronSchedule(client);
    inhouseService.setInhouseLogChannelWithServer(client);
  },
};
