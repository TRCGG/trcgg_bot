const { EmbedBuilder } = require("discord.js");
const logChannelStorage = require("../utils/logChannelStorage");

/**
 * @description 내전 신청자 관리 서비스
 */

const inhouseQueues = new Map(); // guildId => Set<userTag>

/**
 *
 * @param {*} guildId
 * @param {*} user
 * @param {*} guild
 * @description 내전 신청자를 추가합니다.
 */
async function addApplicant(guildId, user, guild) {
  if (!inhouseQueues.has(guildId)) inhouseQueues.set(guildId, []);
  // const arr = inhouseQueues.get(guildId);
  // if (!arr.find(u => u.userId === user.id)) arr.push({ userId: user.id, userTag: user.tag });
  const applicants = inhouseQueues.get(guildId);
  // 닉네임 가져오기
  let member = guild.members.cache.get(user.id);
  if (!member) member = await guild.members.fetch(user.id);
  const nickname = member.nickname || user.username;
  const already = applicants.find((a) => a.userId === user.id);
  if (!already) {
    applicants.push({
      userId: user.id,
      userTag: user.tag,
      nickname: nickname,
      timestamp: Date.now(), // 신청 시간 추가
    });
  }
}

/**
 *
 * @param {*} guildId
 * @param {*} userId
 * @description 내전 신청자(본인)를 제거합니다.
 * @returns
 */
function removeApplicant(guildId, userId) {
  const arr = inhouseQueues.get(guildId);
  if (!arr) return;
  inhouseQueues.set(
    guildId,
    arr.filter((u) => u.userId !== userId)
  );
}

/**
 *
 * @param {*} guildId
 * @description 내전 신청자 명단을 초기화합니다.
 */
function clearApplicants(guildId) {
  inhouseQueues.delete(guildId);
}

/**
 *
 * @param {*} guildId
 * @description 내전 신청자 명단을 가져옵니다.
 */
function getApplicants(guildId) {
  return inhouseQueues.get(guildId) ?? [];
}

/**
 * @param {*} guildId
 * @deescription 내전 신청자 명단을 담은 임베드를 생성합니다.
 * @returns
 */
function buildSignupEmbed(guildId) {
  const applicants = getApplicants(guildId);
  const embed = new EmbedBuilder()
    .setTitle("✅ 내전 참가 신청 명단")
    .setColor(0x00bfff);

  if (applicants.length === 0) {
    embed.setDescription("아직 신청한 인원이 없습니다.");
  } else {
    const lines = applicants.map((a, i) => {
      const time = formatTimestamp(a.timestamp);
      return `\`${i + 1}.\` <@${a.userId}> (${time})`;
    });
    embed.setDescription(lines.join("\n"));
  }

  return embed;
}

/**
 * @param {*} ts
 * @description 타임스탬프를 한국 시간으로 포맷합니다.
 * @returns
 */
function formatTimestamp() {
  const timeStr = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return timeStr;
}

/**
 * @param {*} guildId
 * @description 현재 내전 신청자 명단을 백업합니다.
 */
const inhouseBackup = new Map();
function backupApplicants(guildId) {
  const current = inhouseQueues.get(guildId);
  if (current) {
    inhouseBackup.set(guildId, JSON.parse(JSON.stringify(current))); // deep copy
  }
}

/**
 * @param {*} guildId
 * @description 백업된 내전 신청자 명단을 복원합니다.
 * @returns
 */
function restoreApplicants(guildId) {
  const backup = inhouseBackup.get(guildId);
  if (backup) {
    inhouseQueues.set(guildId, backup);
    inhouseBackup.delete(guildId); // 복원 후 백업 삭제
    return true;
  }
  return false;
}

/**
 * @param {*} guild
 * @param {*} message
 * @description 로그 채널에 메시지를 전송합니다.
 * @returns
 */
const inhouseLogChannels = new Map();
async function sendInhouseLog(interaction, message) {
  const guild = interaction.guild;
  const logChannelId = inhouseLogChannels.get(guild.id);
  if (!logChannelId) {
    await interaction.channel.send(
      "⚠️ 로그 채널이 설정되어 있지 않습니다. `!로그채널등록` 명령어로 설정해주세요."
    );
  }

  try {
    const logChannel = await guild.channels.fetch(logChannelId);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send( "`"+formatTimestamp()+"` "+message);
    }
  } catch (error) {
    console.error("로그 채널 전송 실패:", error.message);
  }
}

/**
 *
 * @param {*} guildId
 * @param {*} channelId
 * @dseqription 길드의 내전 로그 채널을 설정합니다.
 */
function setInhouseLogChannel(guildId, channelId) {
  inhouseLogChannels.set(guildId, channelId);
}

/**
 * @param {*} guildId
 * @description 길드의 내전 로그 채널을 가져옵니다.
 * @returns
 */
function getInhouseLogChannel(guildId) {
  return inhouseLogChannels.get(guildId);
}

/**
 * 
 * @description 모든 길드의 내전 신청자 명단을 초기화합니다.
 */
function inhouseClear() {
  inhouseQueues.clear();
  inhouseBackup.clear();
}

/**
 * @param {*} client 
 * @description 서버 기동시 저장되 있는 모든 길드의 내전 로그 채널을 설정
 */
const setInhouseLogChannelWithServer = (client) => {
  client.guilds.cache.forEach(async (guild) => {
    const logChannelId = logChannelStorage.getLogChannel(guild.id);
    setInhouseLogChannel(guild.id, logChannelId);
  });
};

module.exports = {
  addApplicant,
  removeApplicant,
  clearApplicants,
  getApplicants,
  buildSignupEmbed,
  backupApplicants,
  restoreApplicants,
  sendInhouseLog,
  formatTimestamp,
  setInhouseLogChannel,
  getInhouseLogChannel,
  inhouseClear,
  setInhouseLogChannelWithServer
};
