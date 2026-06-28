import md5 from 'md5'
import { ALLOWED_FIELDS } from '../utils/fieldAdapter.js'

const LEGACY_FIELD_PATTERN = /[A-Z]/

function isLegacyField(key) {
  return LEGACY_FIELD_PATTERN.test(key)
}

const FIELD_WHITELIST = ALLOWED_FIELDS

export function filterFields(data) {
  if (!data || typeof data !== 'object') return data

  const result = {}
  for (const key of Object.keys(data)) {
    if (FIELD_WHITELIST.includes(key)) {
      result[key] = data[key]
    }
  }
  return result
}

export function isFieldAllowed(field) {
  return FIELD_WHITELIST.includes(field)
}

const SECRET_KEY = 'SaaS_SECRET_2026'

export function createSign(data) {
  if (!data || typeof data !== 'object') return ''

  const sortedKeys = Object.keys(data)
    .filter(k => k !== 'sign' && data[k] !== undefined && data[k] !== null)
    .sort()

  let str = ''
  sortedKeys.forEach((k, i) => {
    str += k + '=' + data[k]
    if (i < sortedKeys.length - 1) {
      str += '&'
    }
  })

  str += '&key=' + SECRET_KEY

  return md5(str)
}

export function sign(data) {
  return createSign(data)
}

export function verifySign(data) {
  if (!data || !data.sign) return false
  const receivedSign = data.sign
  const dataWithoutSign = { ...data }
  delete dataWithoutSign.sign
  const calculatedSign = createSign(dataWithoutSign)
  return receivedSign === calculatedSign
}

let lastRequestTime = 0
const MIN_INTERVAL = 800

export function checkThrottle() {
  const now = Date.now()
  if (now - lastRequestTime < MIN_INTERVAL) {
    return false
  }
  lastRequestTime = now
  return true
}

export function throttle() {
  return checkThrottle()
}

const throttleMap = new Map()

export function throttleByKey(key, delay = 1000) {
  const now = Date.now()
  const last = throttleMap.get(key) || 0
  if (now - last < delay) {
    return false
  }
  throttleMap.set(key, now)
  return true
}

export function useThrottle(fn, delay = 2000) {
  let lastTime = 0

  return function (...args) {
    const now = Date.now()
    if (now - lastTime < delay) {
      return
    }
    lastTime = now
    fn.apply(this, args)
  }
}

export function createRateLimiter(maxRequests, windowMs) {
  const requests = []

  return function checkRateLimit(key = 'default') {
    const now = Date.now()
    const windowStart = now - windowMs

    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift()
    }

    if (requests.length >= maxRequests) {
      return { allowed: false, retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000) }
    }

    requests.push(now)
    return { allowed: true, retryAfter: 0 }
  }
}

const usedNonce = new Set()
const NONCE_TTL = 5 * 60 * 1000
const MAX_NONCE_SIZE = 1000

export function generateNonce() {
  return md5(`${Date.now()}_${Math.random()}_${SECRET_KEY}`)
}

export function checkNonce(nonce) {
  if (!nonce) return false
  if (usedNonce.has(nonce)) return false

  if (usedNonce.size >= MAX_NONCE_SIZE) {
    const firstKey = usedNonce.values().next().value
    usedNonce.delete(firstKey)
  }

  usedNonce.add(nonce)
  setTimeout(() => {
    usedNonce.delete(nonce)
  }, NONCE_TTL)
  return true
}

const TIMESTAMP_TOLERANCE = 60 * 1000

export function checkTimestamp(timestamp) {
  if (!timestamp) return false
  const now = Date.now()
  return Math.abs(now - Number(timestamp)) <= TIMESTAMP_TOLERANCE
}

export function securityGateway(data, options = {}) {
  const { enableThrottle = true, enableNonce = true, enableSign = true, strict = false } = options

  if (!data || typeof data !== 'object') {
    return data
  }

  for (const key of Object.keys(data)) {
    if (isLegacyField(key)) {
      if (strict) {
        throw new Error(`非法字段: ${key}`)
      } else {
        console.warn(`[Security] 检测到旧字段: ${key}，建议使用 snake_case 格式`)
      }
    }
  }

  const filtered = filterFields(data)

  if (enableThrottle) {
    if (!checkThrottle()) {
      throw new Error('请求过于频繁，请稍后再试')
    }
  }

  const result = { ...filtered }

  if (enableNonce) {
    result.nonce = generateNonce()
  }

  result.timestamp = Date.now()

  if (enableSign) {
    result.sign = createSign(result)
  }

  return result
}

export { SECRET_KEY, FIELD_WHITELIST }

export default {
  filterFields,
  isFieldAllowed,
  createSign,
  sign,
  verifySign,
  checkThrottle,
  throttle,
  throttleByKey,
  useThrottle,
  createRateLimiter,
  generateNonce,
  checkNonce,
  checkTimestamp,
  securityGateway,
  FIELD_WHITELIST,
  SECRET_KEY,
  isLegacyField
}
