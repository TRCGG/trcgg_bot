const { buildSignupEmbed, setInhouseLogChannel} = require("../services/inhouseService");
const logChannelStorage = require("../utils/logChannelStorage");
const { createInhouseButtons } = require("../utils/inhouseButtonUtils");
const stringUtils = require("../utils/stringUtils");

/**
 * @description 내전 관련 명령어를 처리하는 모듈
 */

module.exports = [
  {
    // name: "내전",
    // description: "내전 신청 메시지를 생성합니다.",
    // run: async (client, msg, args) => {
    //   const guildId = msg.guild.id;
    //   const embed = buildSignupEmbed(guildId);
    //   const buttons = createInhouseButtons();

    //   // 로그 채널이 설정되어 있지 않으면 경고 메시지 전송
    //   const logChannelId = logChannelStorage.getLogChannel(guildId);
    //   if (!logChannelId) {
    //     await msg.channel.send("⚠️ 로그 채널이 설정되어 있지 않습니다. `!로그채널등록` 명령어로 설정해주세요.");
    //     return;
    //   }
      
    //   await msg.channel.send({ embeds: [embed], components: [buttons] });
    // },
  },
  {
    // name: "로그채널등록",
    // description: "내전 로그 채널을 등록합니다.",
    // run: async (client, msg, args) => {
    //   if (!stringUtils.checkAuth(msg)) {
    //     msg.reply("권한 없음");
    //     return;
    //   }
    //   const guildId = msg.guild.id;
    //   const channelId = msg.channel.id;

    //    // 로그 채널 저장
    //   logChannelStorage.saveLogChannel(guildId, channelId);

    //   // 내전 로그 채널 설정
    //   setInhouseLogChannel(guildId, channelId);

    //   await msg.reply("✅ 이 채널을 로그 채널로 설정했습니다.");
    // },
  },
];
