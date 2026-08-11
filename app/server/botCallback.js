const http = require('node:http');
const { safeSend } = require('../utils/discordUtils');

/**
 * 백엔드 → 봇 콜백 수신용 경량 HTTP 서버 (TRC-226 단계 2)
 *
 * 불변식:
 * - 반드시 127.0.0.1(localhost)에만 바인드한다 — 외부 노출 금지.
 * - x-discord-bot 헤더가 env DISCORD_BOT_SECRET과 일치할 때만 처리, 불일치 시 404로 위장.
 * - 서버 기동 실패(포트 충돌 등)해도 봇 본체는 죽지 않는다 (!다음코드 수동 폴백으로 운영 가능).
 *
 * express는 봇 의존성에 없으므로 node:http만 사용(새 의존성 추가 금지).
 */

const DEFAULT_PORT = 19902;
const MAX_BODY_BYTES = 1e6; // 과대 페이로드 방어

/**
 * @param {import('discord.js').Client} client
 * @returns {http.Server}
 */
const start = (client) => {
	const secret = process.env.DISCORD_BOT_SECRET;
	const port = Number(process.env.BOT_CALLBACK_PORT) || DEFAULT_PORT;

	const server = http.createServer((req, res) => {
		// 라우팅: POST /post-next-code 외에는 404.
		if (req.method !== 'POST' || req.url !== '/post-next-code') {
			res.writeHead(404).end();
			return;
		}

		// 시크릿 검증 실패 시 404로 위장(엔드포인트 은닉).
		if (!secret || req.headers['x-discord-bot'] !== secret) {
			res.writeHead(404).end();
			return;
		}

		let raw = '';
		let aborted = false;
		req.on('data', (chunk) => {
			raw += chunk;
			if (raw.length > MAX_BODY_BYTES) {
				aborted = true;
				res.writeHead(413).end();
				req.destroy();
			}
		});

		req.on('end', async () => {
			if (aborted) return;

			let body;
			try {
				body = JSON.parse(raw || '{}');
			} catch (e) {
				res
					.writeHead(400, { 'Content-Type': 'application/json' })
					.end(JSON.stringify({ status: 'error', reason: 'invalid_json' }));
				return;
			}

			const { channelId, code, remaining } = body;
			if (!channelId || !code) {
				res
					.writeHead(400, { 'Content-Type': 'application/json' })
					.end(JSON.stringify({ status: 'error', reason: 'missing_fields' }));
				return;
			}

			try {
				const channel = client.channels.cache.get(channelId);
				if (!channel) {
					res
						.writeHead(404, { 'Content-Type': 'application/json' })
						.end(JSON.stringify({ status: 'error', reason: 'channel_not_found' }));
					return;
				}

				const remainingText =
					remaining !== undefined && remaining !== null ? `\n:ticket: 남은 코드 ${remaining}개` : '';
				const sent = await safeSend(
					channel,
					`:arrow_forward: **다음 코드**\n\`\`\`${code}\`\`\`${remainingText}`,
				);

				if (!sent) {
					res
						.writeHead(502, { 'Content-Type': 'application/json' })
						.end(JSON.stringify({ status: 'error', reason: 'post_failed' }));
					return;
				}

				res
					.writeHead(200, { 'Content-Type': 'application/json' })
					.end(JSON.stringify({ status: 'ok' }));
			} catch (error) {
				console.error('[botCallback] 코드 게시 실패:', error);
				res
					.writeHead(500, { 'Content-Type': 'application/json' })
					.end(JSON.stringify({ status: 'error', reason: 'post_failed' }));
			}
		});
	});

	// 포트 충돌 등 기동 실패 — 봇 본체는 계속 동작.
	server.on('error', (err) => {
		console.error(`[botCallback] 서버 기동 실패(port=${port}):`, err.message);
	});

	server.listen(port, '127.0.0.1', () => {
		console.log(`[botCallback] 콜백 서버 기동: http://127.0.0.1:${port}`);
	});

	return server;
};

module.exports = { start };
