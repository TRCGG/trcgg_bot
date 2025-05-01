const BaseURL = process.env.BASE_URL;
/**
 * fetch httpClient.js  
 */
const httpClient = {

  async request(method, url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 후 요청 취소

    const config = {
      method,
      headers: {'Content-Type' : 'application/json'},
      signal: controller.signal, // AbortController 적용
      ...options,
    }

    const fullUrl = `${BaseURL}${url}`
    const cleanUrl = fullUrl.replace(/\\/g, '');
 
    try {
      const response = await fetch(cleanUrl, config);
      clearTimeout(timeoutId); 
      
      // 응답 코드가 200이 아닐 경우
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // JSON 파싱 실패 방지
        const message = errorData?.message || 'Unknown error';

        console.error('Response Error:', {
          time: new Date().toISOString(),
          url: cleanUrl,
          status: response.status,
          data: errorData
        });

        if (response.status === 404) {
          throw new Error('404 Not Found: ' + message);
        }

        throw new Error(message);
      }
      const json = await response.json();
      return json.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if(error.name === 'AbortError'){
        console.error('요청 시간 초과');
      } 
      throw error;
    }
  },

  /**
   * @description GET Request
   * @param {string} url - Request URL
   * @param {Object} options - fetch Setting
   */
  async get(url, data, options= {}) {
    return this.request('GET', url, {...options, body: JSON.stringify(data)});
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