const { Events } = require("discord.js");
const { handleButtonInteraction } = require("../utils/inhouseButtonInteraction");
const { handleModalSubmitInteraction } = require("../utils/inhouseModalSubmitInteraction");
const { handleSelectMenuInteraction } = require("../utils/selectBoxUtils");
const handlePrivateGameCore = require("../privateGame/interactions/coreHandler");

/**
 * interactionCreate 이벤트 핸들러
 */

module.exports = {
	name: Events.InteractionCreate,
	once: false,
	async execute(client, interaction) {
		if (await handleButtonInteraction(interaction)) return;
		if (await handleModalSubmitInteraction(interaction)) return;
		if (await handleSelectMenuInteraction(interaction)) return;
		if (await handlePrivateGameCore(interaction)) return;
	},
};
