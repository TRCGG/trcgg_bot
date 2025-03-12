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
 
    try {
      const response = await fetch(fullUrl, config);
      clearTimeout(timeoutId); 
      
      // status 200 아닌 에러
      if(!response.ok) {
        const errorData = await response.json().catch(() => ({})); //JSON 파싱 실패 방지
        console.error('Response Error:', {
          status: response.status,
          data: JSON.stringify(errorData)
        })
        throw new Error(`HTTP Error ${response.status}: ${JSON.stringify(errorData)}`);
      }
      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      if(error.name === 'AbortError'){
        console.error('요청 시간 초과');
      } else {
        console.error('Error:', error.message);
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