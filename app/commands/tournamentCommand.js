const tournamentClient = require('../client/tournamentClient');
const res = require('../utils/responseHandler');
const { BotError } = require('../utils/errors');

/**
 * 토너먼트코드 명령어 (TRC-226)
 * - !내전시작 [판수] : 코드 선발급 후 실행 채널에 첫 코드 게시
 * - !다음코드        : 미사용 다음 코드 조회 후 게시
 */

const DEFAULT_COUNT = 3;
const MIN_COUNT = 1;
const MAX_COUNT = 10;

module.exports = [
	{
		name: '내전시작',
		run: async (client, msg, args) => {
			// 판수 파싱 — 기본 3, 1~10 제한.
			let count = DEFAULT_COUNT;
			if (args.length > 0) {
				const parsed = Number(args[0]);
				if (!Number.isInteger(parsed) || parsed < MIN_COUNT || parsed > MAX_COUNT) {
					return res.error(
						msg,
						new Error(`판수는 ${MIN_COUNT}~${MAX_COUNT} 사이의 숫자로 입력해주세요.`),
					);
				}
				count = parsed;
			}

			try {
				const guildId = msg.guild.id;
				const channelId = msg.channel.id; // 실행된 채널에 게시.

				const result = await tournamentClient.post_codes({ guildId, channelId, count });
				const codes = (result && result.codes) || [];
				if (codes.length === 0) {
					return res.error(msg, new Error('발급된 코드가 없습니다.'));
				}

				const firstCode = codes[0].code;
				const remaining = codes.length - 1;

				await msg.channel.send(
					`:crossed_swords: **내전 시작!** 아래 토너먼트 코드로 방을 만들어주세요.\n` +
						`\`\`\`${firstCode}\`\`\`\n` +
						`:ticket: 남은 코드 ${remaining}개 (\`!다음코드\`로 다음 코드를 받을 수 있어요)`,
				);
			} catch (error) {
				res.error(msg, error);
			}
		},
	},
	{
		name: '다음코드',
		run: async (client, msg, args) => {
			try {
				const guildId = msg.guild.id;
				const code = await tournamentClient.get_next_code(guildId);

				// 방어: 정상 응답인데 코드가 비어있는 경우.
				if (!code || !code.code) {
					return msg.reply(':warning: 발급된 코드가 없습니다. `!내전시작`으로 새 코드를 발급하세요.');
				}

				await msg.channel.send(`:arrow_forward: **다음 코드**\n\`\`\`${code.code}\`\`\``);
			} catch (error) {
				// 남은 코드가 없으면 백엔드가 404 → 안내 후 종료.
				if (error instanceof BotError && error.status === 404) {
					return msg.reply(':warning: 발급된 코드가 없습니다. `!내전시작`으로 새 코드를 발급하세요.');
				}
				res.error(msg, error);
			}
		},
	},
];
