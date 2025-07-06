// interactionCreate.js
const { MessageFlags } = require("discord.js");

const {
  addApplicant,
  removeApplicant,
  getApplicants,
  buildSignupEmbed,
  backupApplicants,
  sendInhouseLog,
  clearApplicants,
} = require("../services/inhouseService");

const { createInhouseButtons } = require("../utils/inhouseButtonUtils");

async function handleModalSubmitInteraction(interaction) {
  if (!interaction.isModalSubmit()) return false;
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const userTag = interaction.user.tag;
  const member = await interaction.guild.members.fetch(userId);
  const displayName = member.nickname || userTag;

  const applicants = getApplicants(guildId);

  if (interaction.customId === "mention_range_modal") {
    const rangeStr = interaction.fields.getTextInputValue("range_input").trim();

    // 1) 범위(1~3) 또는 단일 숫자(1) 패턴 검사
    const rangeMatch = rangeStr.match(/^(\d+)\s*~\s*(\d+)$/);

    let mentionUsers = [];

    if (rangeMatch) {
      // 2) 범위일 경우
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);

      if (start < 1 || end > applicants.length || start > end) {
        return interaction.reply({
          content: "범위가 올바르지 않습니다.",
          flags: MessageFlags.Ephemeral,
        });
      }

      mentionUsers = applicants
        .slice(start - 1, end)
        .map((u) => `<@${u.userId}>`);
    } else {
      // 3) 단일 숫자일 경우
      const num = parseInt(rangeStr, 10);
      if (isNaN(num) || num < 1 || num > applicants.length) {
        return interaction.reply({
          content: "번호가 올바르지 않습니다.",
          flags: MessageFlags.Ephemeral,
        });
      }

      mentionUsers = [`<@${applicants[num - 1].userId}>`];
    }

    const mentionStr = mentionUsers.join(" ");

    await sendInhouseLog(
      interaction,
      `**${displayName}** 대기자 호출 ${mentionStr} 🔔`
    );

    const embed = buildSignupEmbed(guildId);
    const buttons = createInhouseButtons();

    await interaction.update({ embeds: [embed], components: [buttons] });
  } else if (interaction.customId === "cancel_range_modal") {
    const inputStr = interaction.fields.getTextInputValue("cancel_input");
    const indices = parseIndices(inputStr, applicants.length);

    if (indices.length === 0) {
      return interaction.reply({
        content: "유효한 번호가 없습니다.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const toRemove = indices.map((i) => applicants[i]?.userId).filter(Boolean);

    if (toRemove.length === 0) {
      return interaction.reply({
        content: "취소할 인원이 없습니다.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // 제거 대상 목록
    const removedUsers = indices
      .map((i) => applicants[i])
      .filter(Boolean)
      .map((applicant) => applicant.nickname || `<@${applicant.userId}>`);

    const nameStr = removedUsers.join(", ");

    // backupApplicants(guildId); // 신청자 명단 백업
    toRemove.forEach((userId) => removeApplicant(guildId, userId));

    const embed = buildSignupEmbed(guildId);
    const buttons = createInhouseButtons({ undoEnabled: true });

    await interaction.update({ embeds: [embed], components: [buttons] });

    await sendInhouseLog(
      interaction,
      `**${displayName}** 대기자 [ ${nameStr} ] 정리 🗑️`
    );
  } else if (interaction.customId === "inhouse_priority_modal") {
    const inputStr = interaction.fields
      .getTextInputValue("priority_input")
      .trim();
    const targetIndex = parseInt(inputStr, 10) - 1;
    const applicants = getApplicants(guildId);

    if (isNaN(targetIndex) || targetIndex < 0) {
      return interaction.reply({
        content: "잘못된 번호입니다.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const oldIndex = applicants.findIndex((a) => a.userId === userId); // 기존 위치
    const newList = applicants.filter((a) => a.userId !== userId); // 중복 제거
    const insertIndex = Math.min(targetIndex, newList.length); // 삽입 위치 계산

    // 삽입
    newList.splice(insertIndex, 0, { userId, nickname: displayName });

    // 명단 갱신
    clearApplicants(guildId);
    for (const u of newList) {
      await addApplicant(
        guildId,
        { id: u.userId, username: u.nickname },
        interaction.guild
      );
    }

    const embed = buildSignupEmbed(guildId);
    const buttons = createInhouseButtons();
    await interaction.update({ embeds: [embed], components: [buttons] });

    // 로그 메시지
    const oldPos = oldIndex >= 0 ? `${oldIndex + 1}번` : "신규";
    const newPos = `${insertIndex + 1}번`;

    await sendInhouseLog(
      interaction,
      `**${displayName}** 우선예약 ${oldPos} ➜ ${newPos} ⭐`
    );
  }
}

/*
 * @description 입력된 문자열에서 인덱스를 파싱합니다.
 * @param {string} input - 입력 문자열 (예: "1~3, 5, 7")
 * @param {number} max - 최대 인덱스 (1부터 시작)
 * @returns {number[]} - 유효한 인덱스 배열 (내림차순 정렬)
 */
function parseIndices(input, max) {
  const indices = new Set();

  input.split(",").forEach((part) => {
    part = part.trim();
    if (!part) return;

    if (part.includes("~")) {
      const [start, end] = part.split("~").map((n) => parseInt(n.trim(), 10));
      if (isNaN(start) || isNaN(end)) return;
      const validStart = Math.max(1, start);
      const validEnd = Math.min(max, end);
      if (validStart > validEnd) return;
      for (let i = validStart; i <= validEnd; i++) indices.add(i - 1);
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= max) indices.add(num - 1);
    }
  });

  return [...indices].sort((a, b) => b - a); // 내림차순
}

module.exports = {
  handleModalSubmitInteraction,
};
