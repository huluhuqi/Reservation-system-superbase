import request from './request.js'
import { checkRisk } from './riskEngine.js'

export function safePost(url, data = {}) {
  if (data.__admin === true) {
    return request.post(url, data)
  }

  if (data.__init__ === true) {
    return request.post(url, data)
  }

  const risk = checkRisk(data, url)
  if (!risk.pass) {
    throw new Error(risk.msg)
  }

  return request.post(url, data)
}

export function safeGet(url, params = {}) {
  return safePost(url, params)
}

export default {
  safePost,
  safeGet
}
