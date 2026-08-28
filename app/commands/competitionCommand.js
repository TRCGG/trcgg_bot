const competitionService = require('../services/competitionService');
const stringUtils = require('../utils/stringUtils');
const res = require('../utils/responseHandler');
const { safeReply } = require('../utils/discordUtils');

/**
 * 대회 관리 명령어 (TRC-283)
 * - !대회개설 [이름] : OPEN 대회 생성 (길드당 하나)
 * - !대회종료        : OPEN 대회 종료 — 이후 리플 태깅 불가
 * - !대회삭제 [이름] : 경기 0건인 대회 삭제
 * - !대회목록        : 대회와 유형별 경기 수
 *
 * 봇 요청은 백엔드 권한 검사를 통과하므로 관리 명령의 권한은 여기서(checkAuth) 막는다.
 * 코드 발급 명령(!스크림생성/!대회생성)과는 별개다.
 */
module.exports = [
	{
		name: '대회개설',
		run: async (client, msg, args) => {
			if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
			try {
				const created = await competitionService.open_competition(msg, args);
				await res.success(
					msg,
					`대회 개설: **${created.name}** — 이제 리플에 \`!스크림\` / \`!대회\`를 붙여 올리면 이 대회로 들어갑니다.`,
				);
			} catch (error) {
				res.error(msg, error);
			}
		},
	},
	{
		name: '대회종료',
		run: async (client, msg) => {
			if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
			try {
				const closed = await competitionService.close_competition(msg);
				await res.success(msg, `대회 종료: **${closed.name}** — 이 대회에는 더 이상 리플을 올릴 수 없습니다.`);
			} catch (error) {
				res.error(msg, error);
			}
		},
	},
	{
		name: '대회삭제',
		run: async (client, msg, args) => {
			if (!stringUtils.checkAuth(msg)) return res.noAuth(msg);
			try {
				const removed = await competitionService.delete_competition(msg, args);
				await res.success(msg, `대회 삭제: **${removed.name}**`);
			} catch (error) {
				res.error(msg, error);
			}
		},
	},
	{
		name: '대회목록',
		run: async (client, msg) => {
			try {
				const result = await competitionService.get_list_embed(msg);
				await safeReply(msg, result);
			} catch (error) {
				res.error(msg, error);
			}
		},
	},
];
