const httpClient = require('../utils/networkUtils');
const prefix = '/statistics';
const season = process.env.SEASON || "2025";

const get_master_of_champion_record = async (champName, guildId) => {
  const url = `${prefix}/${guildId}/users?championName=${champName}&position=ALL`;
  return httpClient.get(url);
}

/**
 * @description !클랜통계 Embed
 */
const get_user_data = async (year, month, guildId) => {
  const queryString = new URLSearchParams({ limit: 200, season: season });
  if (year) queryString.append("year", year);
  if (month) queryString.append("month", month);
  const url = `${prefix}/${guildId}/users`;

  return httpClient.get(`${url}?${queryString.toString()}`);
}

module.exports = {
  get_master_of_champion_record,
  get_user_data,
}
