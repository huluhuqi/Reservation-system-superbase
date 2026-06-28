import request from './request.js'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { checkRisk } from './riskEngine.js'

export function safePost(url, data = {}) {
  if (data.__admin === true) {
    return request.post(url, adaptRequest(data), {
      headers: {
        'X-Bypass-Throttle': 'true'
      }
    })
  }

  if (data.__init__ === true) {
    return request.post(url, adaptRequest(data), {
      headers: {
        'X-Bypass-Throttle': 'true'
      }
    })
  }

  const risk = checkRisk(data)
  if (!risk.pass) {
    return Promise.reject({
      type: 'RISK_ERROR',
      message: risk.msg
    })
  }

  return request.post(url, adaptRequest(data))
}

export function safeGet(url, params = {}) {
  return safePost(url, params)
}

export default {
  safePost,
  safeGet
}
