const httpClient = require("../utils/networkUtils");
const prefix = "/event";

/**
 * 이벤트 api call
 */

/**
 * @param {*} year 
 * @param {*} month 
 * @param {*} guild_id 
 * @description TRC 클랜 특정 조건달성시 알람
 * @returns 
 */
const get_alarm_list = async (year, month, guild_id) => {
  const url = `${prefix}/${year}/${month}/${guild_id}`;
  return httpClient.get(url);
};

module.exports = {
  get_alarm_list,
};
