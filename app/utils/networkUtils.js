const BaseURL = process.env.BASE_URL;
const BotHeader = process.env.DISCORD_BOT_SECRET;
/**
 * fetch httpClient.js  
 */
const httpClient = {

  async request(method, url, options = {}) {

    const config = {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-discord-bot": BotHeader,
      },
      signal: AbortSignal.timeout(45000), // 45초 후 자동 취소 
      ...options,
    };

    const fullUrl = `${BaseURL}${url}`
    const cleanUrl = fullUrl.replace(/\\/g, '');
 
    try {
      const response = await fetch(cleanUrl, config);
      
      // 응답 코드가 200이 아닐 경우
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // JSON 파싱 실패 방지
        const message = errorData?.detail || errorData?.message || `Unknown error `;

        console.error('Response Error:', {
          time: new Date().toISOString(),
          url: cleanUrl,
          status: response.status,
          data: errorData
        });

        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      const json = await response.json();
      return json.data;
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.error('요청 시간 초과 (Timeout)');
        throw new Error('요청 시간 초과');
      }
      throw error;
    }
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