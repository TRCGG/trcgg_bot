const { BotError } = require('./errors');

const BaseURL = process.env.BASE_URL;
const BotHeader = process.env.DISCORD_BOT_SECRET;

const isTimeout = (error) => error?.name === 'AbortError' || error?.name === 'TimeoutError';

// 길드 id는 대부분 base64로 인코딩돼 넘어오지만 토너먼트 경로는 원본을 그대로 쓴다.
// 로그에서 같은 길드가 두 값으로 갈리면 집계가 안 되므로 원본 형태로 맞춘다.
const toRawGuildId = (value) => {
  if (!value) return undefined;
  const text = String(value);
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8');
    return /^\d{17,20}$/.test(decoded) ? decoded : text;
  } catch {
    return text;
  }
};
/**
 * fetch httpClient.js  
 */
const httpClient = {

  async request(method, url, options = {}) {
    // 어떤 상태코드가 정상 분기인지는 호출부만 안다. 전송 계층이 임의로 판단하지 않는다.
    const { expectedStatuses = [], guildId, ...fetchOptions } = options;
    const guild = toRawGuildId(guildId);

    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-discord-bot": BotHeader,
      },
      signal: AbortSignal.timeout(45000), // 45초 후 자동 취소
      ...fetchOptions,
    };

    const fullUrl = `${BaseURL}${url}`
    const cleanUrl = fullUrl.replace(/\\/g, '');

    let response;
    try {
      response = await fetch(cleanUrl, config);
    } catch (error) {
      if (isTimeout(error)) {
        console.error('요청 시간 초과 (Timeout)');
        throw new Error('요청 시간 초과');
      }
      throw error;
    }

    // text로 먼저 읽는다. json()으로 바로 파싱하면 실패 시 본문이 그 자리에서 사라져
    // 프록시 502 HTML·빈 응답을 나중에 추적할 수 없다.
    let raw = '';
    try {
      raw = await response.text();
    } catch (error) {
      // 타임아웃은 헤더를 받은 뒤 본문 스트리밍 중에도 난다.
      // 여기서 안 걸러내면 빈 본문으로 보여 파싱 실패로 둔갑한다.
      if (isTimeout(error)) {
        console.error('요청 시간 초과 (Timeout)');
        throw new Error('요청 시간 초과');
      }
    }

    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* JSON이 아닌 응답 */ }

    // 응답 코드가 200이 아닐 경우
    if (!response.ok) {
      // detail → message 우선순위와 문자열을 바꾸면 안 된다.
      // recordService가 message 완전일치로 404를 분기한다 (2792cb5).
      const message = parsed?.detail || parsed?.message
        || (raw ? `HTTP ${response.status}` : `HTTP ${response.status} (빈 응답)`);
      const expected = expectedStatuses.includes(response.status);

      // console.warn은 console.error와 같은 stderr로 나가 pm2 error.log에 그대로 쌓인다.
      // 정상 분기를 error.log에서 빼려면 stdout(console.log)이어야 한다.
      // 지우지는 않는다 — 한 엔드포인트가 통째로 깨진 걸 놓치면 안 된다.
      if (expected) {
        console.log(`[expected] ${response.status} ${method} ${cleanUrl} guild=${guild ?? '-'} — ${message}`);
      } else {
        console.error('Response Error:', {
          time: new Date().toISOString(),
          method,
          url: cleanUrl,
          status: response.status,
          guild,
          data: parsed ?? raw.slice(0, 300)
        });
      }

      throw new BotError(message, response.status, {
        expected,
        method,
        url: cleanUrl,
        guildId: guild,
        bodySnippet: parsed ? undefined : raw.slice(0, 300),
      });
    }

    // 204 등 본문 없는 성공 응답. 파싱 실패로 취급하면 안 된다.
    if (!raw) return undefined;

    if (!parsed) {
      throw new BotError('응답을 해석하지 못했습니다', response.status, {
        method,
        url: cleanUrl,
        bodySnippet: raw.slice(0, 300),
      });
    }
    return parsed.data;
  },

  /**
   * @description GET Request
   */
  async get(url, params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString();
    const finalUrl = queryString ? `${url}?${queryString}` : url;
    
    return this.request('GET', finalUrl, options);
  },

  /**
   * @description POST Request
   * @param {string} url - Request URL
   * @param {string} data - Request Body
   * @param {Object} options - fetch Setting
   */
  async post(url, data, options = {}) {
    return this.request('POST', url, {...options, body: JSON.stringify(data)})
  },

  /**
   * @description PUT Request
   * @param {string} url - Request URL
   * @param {string} data - Request Body
   * @param {Object} options - fetch Setting
   */
  async put(url, data, options = {}) {
    return this.request('PUT', url, {...options, body: JSON.stringify(data)})
  },

  /**
   * @description DELETE Request
   * @param {string} url - Request URL
   * @param {Object} options - fetch Setting
   */
  async delete(url, data, options= {}) {
    return this.request('DELETE', url, {...options, body: JSON.stringify(data)});
  }

}
module.exports = httpClient;