const { BotError, BotErrorType, DISCORD_UPSTREAM_TYPES } = require('./errors');

const BaseURL = process.env.BASE_URL;
const BotHeader = process.env.DISCORD_BOT_SECRET;

const REQUEST_TIMEOUT_MS = 45000;

const isTimeout = (error) => error?.name === 'AbortError' || error?.name === 'TimeoutError';

const failureTarget = (body) =>
  DISCORD_UPSTREAM_TYPES.has(body?.type) ? 'backend-discord' : 'backend';

/**
 * 타임아웃은 어느 API가 몇 초 만에 끊겼는지가 없으면 원인을 좁힐 수 없다.
 * stage로 응답을 아예 못 받은 건지, 헤더는 받고 본문에서 멈춘 건지 구분한다.
 */
const timeoutError = (stage, context) => {
  console.error('Request Timeout:', {
    time: new Date().toISOString(),
    target: 'backend',
    stage,
    timeoutMs: REQUEST_TIMEOUT_MS,
    ...context,
  });
  // status 0은 responseHandler의 5xx 숨김 분기를 타지 않아 이 문구가 사용자에게 그대로 간다.
  return new BotError('요청 시간 초과', 0, {
    type: BotErrorType.TIMEOUT,
    method: context.method,
    url: context.url,
    guildId: context.guild,
  });
};

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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...fetchOptions,
    };

    const fullUrl = `${BaseURL}${url}`
    const cleanUrl = fullUrl.replace(/\\/g, '');

    let response;
    try {
      response = await fetch(cleanUrl, config);
    } catch (error) {
      if (isTimeout(error)) {
        throw timeoutError('response', { method, url: cleanUrl, guild });
      }
      // 안 남기면 어디에도 안 남고, status가 없어 responseHandler가 'fetch failed'를 그대로 노출한다.
      console.error('Request Failed:', {
        time: new Date().toISOString(),
        target: 'backend',
        reason: 'unreachable',
        method,
        url: cleanUrl,
        guild,
        cause: error?.cause?.code ?? error?.message,
      });
      throw new BotError('서버에 연결할 수 없습니다', 0, {
        type: BotErrorType.UNREACHABLE,
        method, url: cleanUrl, guildId: guild,
      });
    }

    // text로 먼저 읽는다. json()으로 바로 파싱하면 실패 시 본문이 그 자리에서 사라져
    // 프록시 502 HTML·빈 응답을 나중에 추적할 수 없다.
    let raw = '';
    let readFailure = null;
    try {
      raw = await response.text();
    } catch (error) {
      // 여기서 안 걸러내면 빈 본문으로 보여 파싱 실패로 둔갑한다.
      if (isTimeout(error)) {
        throw timeoutError('body', { method, url: cleanUrl, status: response.status, guild });
      }
      // 실패 응답은 상태코드만으로도 쓸모가 있어 계속 진행하고, 성공 응답은 아래에서 던진다.
      readFailure = error;
    }

    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* JSON이 아닌 응답 */ }

    if (!response.ok) {
      // detail → message 우선순위와 문자열을 바꾸면 안 된다.
      // recordService가 message 완전일치로 404를 분기한다 (2792cb5).
      const message = parsed?.detail || parsed?.message
        || (raw ? `HTTP ${response.status}` : `HTTP ${response.status} (빈 응답)`);
      const expected = expectedStatuses.includes(response.status);

      // console.warn도 stderr라 error.log에 쌓인다. 빼려면 stdout이어야 한다.
      // 지우지는 않는다 — 한 엔드포인트가 통째로 깨진 걸 놓치면 안 된다.
      if (expected) {
        console.log(`[expected] ${response.status} ${method} ${cleanUrl} guild=${guild ?? '-'} — ${message}`);
      } else {
        console.error('Response Error:', {
          time: new Date().toISOString(),
          target: failureTarget(parsed),
          method,
          url: cleanUrl,
          status: response.status,
          type: parsed?.type,
          guild,
          data: parsed ?? raw.slice(0, 300)
        });
      }

      throw new BotError(message, response.status, {
        expected,
        type: parsed?.type,
        method,
        url: cleanUrl,
        guildId: guild,
        bodySnippet: parsed ? undefined : raw.slice(0, 300),
      });
    }

    // 본문을 못 읽은 걸 204(본문 없음)로 오해하면 호출부가 undefined를 정상값으로 받는다.
    if (readFailure) throw readFailure;

    if (!raw) return undefined;

    if (!parsed) {
      // 프록시가 200에 로그인 페이지를 주는 경우. 여기서 안 남기면 어디에도 안 남는다.
      console.error('Response Parse Error:', {
        time: new Date().toISOString(),
        method,
        url: cleanUrl,
        status: response.status,
        guild,
        data: raw.slice(0, 300)
      });
      throw new BotError('응답을 해석하지 못했습니다', response.status, {
        method,
        url: cleanUrl,
        guildId: guild,
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
   * @description PATCH Request
   * @param {string} url - Request URL
   * @param {string} data - Request Body
   * @param {Object} options - fetch Setting
   */
  async patch(url, data, options = {}) {
    return this.request('PATCH', url, {...options, body: JSON.stringify(data)})
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