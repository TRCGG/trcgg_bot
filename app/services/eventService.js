const eventClient = require('../client/eventClient');
const stringUtils = require('../utils/stringUtils');

/**
 * 이벤트 api call service
 */

/**
 * @param {*} guild_id
 * @description TRC 클랜 특정 조건달성시 알람 인원 목록
 * @returns 
 */
const get_alarm_list = async(guild_id) => {
	const [ year, month ] = stringUtils.splitDate(null);
	const result = await eventClient.get_alarm_list(year, month, guild_id);
	return result;
}

/**
 * @param {*} name 
 * @param {*} guild 
 * @returns 
 */
const find_member_by_ninkname = async(name, guild) => {
	name = name.replace('/s+/g', '').trim();
	try {
		if (!guild) {
			return null;
		}
		// 멤버 전원 불러옴
		const members = await guild.members.fetch();
		
		// 멤버 찾기
		const member = members.find(m => 
			m.nickname?.replace(/\s+/g, '').startsWith(name) || m.user.username?.replace(/\s+/g, '').startsWith(name)
		);
		return member;

	} catch (error) {
		console.error('Error fetching member:', error);
		return null;
	}
}

/**
 * @param {*} client 
 * @param {*} channel_id 
 * @param {*} guild_id 
 * @description 조건 달성 시 채널에 맨션
 * @returns 
 */
const notify_alarm = async(client, channel_id, guild_id) => {
	const guild = client.guilds.cache.get(guild_id);
	const channel = await guild.channels.fetch(channel_id);
	if (!channel) return null;

	const alarms = await get_alarm_list(stringUtils.encodeGuildId(guild_id));

	if(alarms.alarmGames) {
		await Promise.all(
			alarms.alarmGames.map(async (alarm) => {
				const member = await find_member_by_ninkname(alarm.riot_name, guild);
				if(member) {
					await channel.send(game_message(member));
				}
			})
		);
	}

	if(alarms.alarmWins) {
		await Promise.all(
			alarms.alarmWins.map(async (alarm) => {
				const member = await find_member_by_ninkname(alarm.riot_name, guild);
				if(member) {
					await channel.send(win_message(member));
				}
			})
		);
	}
}

const game_message = (member) => {
	const message = `:tada:게임 승리 달성:tada:\n<@${member.id}>님이 내전 150판을 달성하였습니다!!\n이에 내전의신 역할을 부여합니다:bangbang:박수우우우우우:clap::clap::clap::clap:`;
	return message;
}

const win_message = (member) => {
	const message = `:tada:승리의MVP 달성:tada:\n<@${member.id}>님이 내전 50승을 달성하였습니다!!\n이에 승리의MVP 역할을 부여합니다:bangbang:박수우우우우우:clap::clap::clap::clap:`;
	return message;
}

module.exports = {
	notify_alarm,
}