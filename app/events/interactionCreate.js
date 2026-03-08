const { Events } = require("discord.js");
const { handleSelectMenuInteraction } = require("../utils/selectBoxUtils");

/**
 * interactionCreate 이벤트 핸들러
 */

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	async execute(_client, interaction) {
		if (await handleSelectMenuInteraction(interaction)) return;
	},
};
