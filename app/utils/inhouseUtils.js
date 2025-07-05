// interactionCreate.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");

const {
  addApplicant,
  removeApplicant,
  getApplicants,
  buildSignupEmbed,
  backupApplicants,
  restoreApplicants,
  sendInhouseLog,
  inhouseClear
} = require("../services/inhouseService");

const { createInhouseButtons } = require("../utils/inhouseButtonUtils");
const cron = require("node-cron");

/**
 * @description 내전 신청 관련 인터랙션 처리 utils
 * @param {*} interaction
 * @returns
 */

module.exports = async function handleInhouseInteraction(interaction) {
  if (!(interaction.isButton() || interaction.isModalSubmit())) return false;
  try {
    // 버튼 클릭 처리
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const userTag = interaction.user.tag;
    const member = await interaction.guild.members.fetch(userId);
    const displayName = member.nickname || userTag;

    if (interaction.isButton()) {
      if (interaction.customId === "inhouse_apply") {
        await addApplicant(guildId, interaction.user, interaction.guild);
        const embed = buildSignupEmbed(guildId);
        const buttons = createInhouseButtons();
        await interaction.update({ embeds: [embed], components: [buttons] });
      } else if (interaction.customId === "inhouse_cancel") {
        removeApplicant(guildId, userId);
        const embed = buildSignupEmbed(guildId);
        const buttons = createInhouseButtons();
        await interaction.update({ embeds: [embed], components: [buttons] });
        await sendInhouseLog(
          interaction,
          `**${displayName}** 내전신청 취소`
        );
      } else if (interaction.customId === "mention_range") {
        // 멘션 범위 입력 모달 띄우기
        const modal = new ModalBuilder()
          .setCustomId("mention_range_modal")
          .setTitle("멘션할 인원 범위 입력");

        const input = new TextInputBuilder()
          .setCustomId("range_input")
          .setLabel("멘션할 번호 범위 또는 단일 번호 (예: 1~3)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("1~3 또는 3")
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
      } else if (interaction.customId === "cancel_range") {
        // 취소 범위 입력 모달 띄우기
        const modal = new ModalBuilder()
          .setCustomId("cancel_range_modal")
          .setTitle("대기자 정리 인원 번호 입력");

        const input = new TextInputBuilder()
          .setCustomId("cancel_input")
          .setLabel("대기자 정리 할 번호 입력 (예: 1~3 / 2 / 1,3)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("1~3 또는 3 또는 1,3")
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
      } else if (interaction.customId === "inhouse_undo") {
        const restored = restoreApplicants(guildId);

        if (!restored) {
          return interaction.reply({
            content: "되돌릴 이전 상태가 없습니다.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const embed = buildSignupEmbed(guildId);
        const buttons = createInhouseButtons({ undoEnabled: false });

        await interaction.update({
          // content: "✅ 명단을 이전 상태로 복원했습니다.",
          embeds: [embed],
          components: [buttons],
        });

        await sendInhouseLog(
          interaction,
          `**${displayName}** 되돌리기 ↩️ `
        );
      }

      // Modal 제출 처리
    } else if (interaction.isModalSubmit()) {
      const guildId = interaction.guild.id;
      const applicants = getApplicants(guildId);

      if (interaction.customId === "mention_range_modal") {
        const rangeStr = interaction.fields
          .getTextInputValue("range_input")
          .trim();

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

          mentionUsers = [ `<@${applicants[num - 1].userId}>` ];
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

        const toRemove = indices
          .map(i => applicants[i]?.userId)
          .filter(Boolean);

        if (toRemove.length === 0) {
          return interaction.reply({
            content: "취소할 인원이 없습니다.",
            flags: MessageFlags.Ephemeral,
          });
        }

        // 제거 대상 목록
        const removedUsers = indices
          .map(i => applicants[i])
          .filter(Boolean)
          .map(applicant => applicant.nickname || `<@${applicant.userId}>`);

        const nameStr = removedUsers.join(", ");

        backupApplicants(guildId); // 신청자 명단 백업
        toRemove.forEach(userId => removeApplicant(guildId, userId));

        const embed = buildSignupEmbed(guildId);
        const buttons = createInhouseButtons({ undoEnabled: true });

        await interaction.update({ embeds: [embed], components: [buttons] });

        await sendInhouseLog(
          interaction,
          `**${displayName}** 대기자 [ ${nameStr} ] 정리 🗑️`
        );
      }
    }
  } catch (error) {
    console.error(error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "오류가 발생했습니다.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};

/*
  * @description 입력된 문자열에서 인덱스를 파싱합니다.
  * @param {string} input - 입력 문자열 (예: "1~3, 5, 7")
  * @param {number} max - 최대 인덱스 (1부터 시작)
  * @returns {number[]} - 유효한 인덱스 배열 (내림차순 정렬)
  */
function parseIndices(input, max) {
  const indices = new Set();

  input.split(',').forEach(part => {
    part = part.trim();
    if (!part) return;

    if (part.includes('~')) {
      const [start, end] = part.split('~').map(n => parseInt(n.trim(), 10));
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
