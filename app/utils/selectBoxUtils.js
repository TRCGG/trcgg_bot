const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const guildService = require('../services/guildService');	

/**
 * select box utils
 */

/**
 * * @description 언어 선택 박스
 */
const select_language_box = new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId("select_language")
    .setPlaceholder("select language")
    .addOptions(
			{ label: "한국어", value: "ko" },
      { label: "English", value: "en" }
    )
);

/**
 * @param {*} client 
 * @param {*} msg 
 * @param {*} args 
 * @description 언어 선택 박스 메시지 전송
 * @returns 
 */
const lang_box_message = async (client, msg, args) => {
  const sendMessage = await msg.channel.send({
    content: "select language",
    components: [select_language_box],
  });
	return sendMessage;
};

/**
 * @description 선택 완료된 언어 박스
 */
const disabled_box = new ActionRowBuilder().addComponents(
	new StringSelectMenuBuilder()
		.setCustomId("select_language")
		.setPlaceholder("선택 완료됨")
		.setDisabled(true)
		.addOptions(
			{ label: "한국어", value: "ko" },
			{ label: "English", value: "en" }
		)
);

/**
 * @param {*} interaction 
 * @description 선택 완료된 언어 박스 메시지 전송
 * @returns 
 */
const disabled_message = async (interaction) => {
	const sendMessage = await interaction.message.edit({
		content: `✅ 언어 선택이 완료되었습니다.`,
		components: [disabled_box],
	});
	return sendMessage;
}

/**
 * ✅ 셀렉트 메뉴 핸들러
 * @param {*} interaction 
 * @returns {boolean} 처리했으면 true, 아니면 false
 */
const handleSelectMenuInteraction = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return false;

  if (interaction.customId === "select_language") {
    const selected = interaction.values[0]; // "ko" or "en"
    const guildId = interaction.guild.id;

    // DB 반영
    const result = await guildService.put_guild_lang(selected, guildId);

    // 응답 메시지 전송
    await interaction.reply({
      content: result || "✅ 언어 설정 완료!",
      ephemeral: true,
    });

    // UI 비활성화
    await disabled_message(interaction);
    return true;
  }

  return false;
};

module.exports = {
	lang_box_message,
	handleSelectMenuInteraction,
};