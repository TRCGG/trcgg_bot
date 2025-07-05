// interactionCreate.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const {
  addApplicant,
  removeApplicant,
  buildSignupEmbed,
  // restoreApplicants,
  sendInhouseLog,
} = require("../services/inhouseService");

const { createInhouseButtons } = require("../utils/inhouseButtonUtils");

/**
 * @param {*} interaction 
 * @description 버튼 클릭 이벤트를 처리합니다.
 * @returns 
 */

async function handleButtonInteraction(interaction) {
  if (!interaction.isButton()) return false;
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
      await sendInhouseLog(interaction, `**${displayName}** 내전신청 취소`);
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
    } else if (interaction.customId === "inhouse_priority") {
      const modal = new ModalBuilder()
        .setCustomId("inhouse_priority_modal")
        .setTitle("우선예약 위치 입력");

      const input = new TextInputBuilder()
        .setCustomId("priority_input")
        .setLabel("위치로 예약할 번호 입력 (예: 1~현재 인원)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("예: 2 → 2번째에 우선예약")
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
    // else if (interaction.customId === "inhouse_undo") {
    //   const restored = restoreApplicants(guildId);

    //   if (!restored) {
    //     return interaction.reply({
    //       content: "되돌릴 이전 상태가 없습니다.",
    //       flags: MessageFlags.Ephemeral,
    //     });
    //   }

    //   const embed = buildSignupEmbed(guildId);
    //   const buttons = createInhouseButtons({ undoEnabled: false });

    //   await interaction.update({
    //     // content: "✅ 명단을 이전 상태로 복원했습니다.",
    //     embeds: [embed],
    //     components: [buttons],
    //   });

    //   await sendInhouseLog(
    //     interaction,
    //     `**${displayName}** 되돌리기 ↩️ `
    //   );
    // }

    // Modal 제출 처리
  }
}

module.exports = {
  handleButtonInteraction,
}