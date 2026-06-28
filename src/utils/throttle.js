const throttleMap = new Map()

export function throttle(key, delay = 1000) {
  const now = Date.now()
  const last = throttleMap.get(key) || 0
  if (now - last < delay) {
    return false
  }
  throttleMap.set(key, now)
  return true
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

export function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}
