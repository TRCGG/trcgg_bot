const manageService = require("../services/managementService");
const replayService = require("../services/replayService");
const commandUtils = require("../utils/commandUtilis");
const stringUtils = require('../utils/stringUtils');
const res = require('../utils/responseHandler');

/**
 * 관리자 명령어 
 */
module.exports = [
  {
    name: "doc",
    run: async (client, msg, args) => {
      await commandUtils.execute(manageService, "get_doc_embed", msg, args);
    },
  },
  {
    name: "부캐목록",
    run: async (client, msg, args) => {
      await commandUtils.execute(manageService, "get_sublist_embed", msg, args);
    },
  },
  {
    name: "부캐저장",
    run: async (client, msg, args) => {
			if (!stringUtils.checkAuth(msg)) {
				msg.reply("권한 없음");
        return;
			}
			await commandUtils.execute(manageService, "post_subaccount", msg, args);
    },
  },
  {
    name: "부캐삭제",
    run: async (client, msg, args) => {
			if (!stringUtils.checkAuth(msg)) {
				msg.reply("권한 없음");
        return;
			}
			await commandUtils.execute(manageService, "delete_subaccount", msg, args);
    },
  },
  {
    name: "탈퇴",
    run: async (client, msg, args) => {
      const delete_yn = "Y";
			if (!stringUtils.checkAuth(msg)) {
				msg.reply("권한 없음");
        return;
			}
			await manageService.put_accountstatus(delete_yn, msg, args)
				.then((result) => {
					msg.reply(result);
				})
				.catch((err) => {
					console.log(err);
					msg.reply(err.message);
				});
    },
  },
  {
    name: "복귀",
    run: async (client, msg, args) => {
      const delete_yn = "N";
			if (!stringUtils.checkAuth(msg)) {
				msg.reply("권한 없음");
        return;
			}
			await manageService.put_accountstatus(delete_yn, msg, args)
				.then((result) => {
					msg.reply(result);
				})
				.catch((err) => {
					console.log(err);
					msg.reply(err.message);
				});
    },
  },
  {
    name: "drop",
    run: async (client, msg, args) => {
			if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
      try {
        const result = await replayService.delete_replay(msg, args);
        console.log(result);
        res.success(msg, `삭제완료: ${result.id}`);
      } catch (err) {
        res.error(msg, err);
      }
    },
  },
  {
    name: "닉변",
    run: async (client, msg, args) => {
			if (!stringUtils.checkAuth(msg)) {
				msg.reply("권한 없음");
        return;
			}
			await commandUtils.execute(manageService, "put_accountname", msg, args);
    },
  },
];
