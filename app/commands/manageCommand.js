const manageService = require("../services/managementService");
const replayService = require("../services/replayService");
const stringUtils = require('../utils/stringUtils');
const res = require('../utils/responseHandler');

/**
 * 관리자 명령어 
 */
module.exports = [
  {
    name: "doc",
    run: async (client, msg, args) => {
      try {
        const result = await manageService.get_doc_embed();
        await msg.reply(result);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "부캐목록",
    run: async (client, msg, args) => {
      try {
        const result = await manageService.get_sublist_embed(msg, args);
        await msg.reply(result);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "부캐저장",
    run: async (client, msg, args) => {
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);

      try {
        const result = await manageService.post_subaccount(msg, args);
        res.success(msg, `부캐 저장 완료 `);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "부캐삭제",
    run: async (client, msg, args) => {
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);

      try {
        const result = await manageService.delete_subaccount(msg, args);
        res.success(msg, `부캐 삭제 완료 `);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
  {
    name: "탈퇴",
    run: async (client, msg, args) => {
      const status = "2";
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
      await manageService
        .put_accountstatus(status, msg, args)
        .then((result) => {
          res.success(msg, `탈퇴 완료 `);
        })
        .catch((error) => {
          res.error(msg, error);
        });
    },
  },
  {
    name: "복귀",
    run: async (client, msg, args) => {
      const status = "1";
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
      await manageService
        .put_accountstatus(status, msg, args)
        .then((result) => {
          res.success(msg, `복귀 완료 `);
        })
        .catch((error) => {
          res.error(msg, error);
        });
    },
  },
  {
    name: "drop",
    run: async (client, msg, args) => {
      if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
      try {
        const result = await replayService.delete_replay(msg, args);
        res.success(msg, `삭제완료: ${result.id}`);
      } catch (error) {
        res.error(msg, error);
      }
    },
  },
];
