const httpClient = require('../client/championShipClient');
const StringUtils = require('../utils/stringUtils');

/**
 * 대회용 api call
 */

/**
 * 
 * @param {*} file_url 
 * @param {*} file_name 
 * @param {*} create_user 
 * @param {*} guild_id 
 * @param {*} game_type 
 * @description 대회 리플레이 저장
 * @returns 
 */
const save = async(file_url, file_name, create_user, guild_id, game_type) => {  
  const data = {
    fileUrl: file_url,
    fileName: file_name,
    createUser: create_user,
    gameType: game_type,
  };
  const resultMessage = await httpClient.post(data, guild_id);
  return resultMessage;
}

module.exports = {
  save,
}