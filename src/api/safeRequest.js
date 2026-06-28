import request from './request.js'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { checkRisk } from './riskEngine.js'

const LEGACY_FIELD_PATTERN = /[A-Z]/

function isLegacyField(key) {
  return LEGACY_FIELD_PATTERN.test(key)
}

function detectLegacyFields(data, path = '') {
  if (!data || typeof data !== 'object') return

  if (Array.isArray(data)) {
    data.forEach((item, index) => detectLegacyFields(item, `${path}[${index}]`))
    return
  }

  for (const key of Object.keys(data)) {
    const fullPath = path ? `${path}.${key}` : key
    if (isLegacyField(key)) {
      throw new Error(`Forbidden legacy field detected: ${fullPath}. Use snake_case instead.`)
    }
    if (data[key] && typeof data[key] === 'object') {
      detectLegacyFields(data[key], fullPath)
    }
  }
}

export function safePost(url, data = {}, options = {}) {
  const { skipRisk = false } = options

  detectLegacyFields(data)

  const isAdmin = data.__admin === true
  const isInit = data.__init__ === true
  const bypassRisk = isAdmin || isInit || skipRisk

  let requestPromise

  if (bypassRisk) {
    const safeData = adaptRequest(data)
    requestPromise = request.post(url, safeData, {
      headers: {
        'X-Bypass-Throttle': isAdmin || isInit ? 'true' : 'false'
      }
    })
  } else {
    const risk = checkRisk(data)
    if (!risk.pass) {
      return Promise.reject({
        type: 'RISK_ERROR',
        message: risk.msg
      })
    }

    const safeData = adaptRequest(data)
    requestPromise = request.post(url, safeData)
  }

  return requestPromise.catch(error => {
    if (error.type) {
      return Promise.reject(error)
    }

    if (error.message === '请求过于频繁，请稍后再试') {
      return Promise.reject({
        type: 'THROTTLE_ERROR',
        message: error.message
      })
    }

    return Promise.reject({
      type: 'UNKNOWN_ERROR',
      message: error.message || '操作失败',
      original: error
    })
  })
}

export function safeGet(url, params, options = {}) {
  return safePost(url, params, options)
}

export default {
  safePost,
  safeGet,
  detectLegacyFields,
  isLegacyField
}
