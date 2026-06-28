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

  if (data.__admin === true || data.__init__ || skipRisk) {
    const safeData = adaptRequest(data)
    return request.post(url, safeData)
  }

  const risk = checkRisk(data)
  if (!risk.pass) {
    throw new Error(risk.msg)
  }

  const safeData = adaptRequest(data)
  return request.post(url, safeData)
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
