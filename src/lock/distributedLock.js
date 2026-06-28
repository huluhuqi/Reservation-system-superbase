// =========================
// 🔒 唯一核心锁系统
// =========================
const store = new Map()

export function tryLock(key, ttl = 3000) {
  const now = Date.now()
  const expire = store.get(key)

  if (expire && expire > now) {
    return false
  }

  store.set(key, now + ttl)
  return true
}

export function unlock(key) {
  store.delete(key)
}

export function clearAll() {
  store.clear()
}

export function isLocked(key) {
  const expire = store.get(key)
  if (!expire) return false
  if (expire <= Date.now()) {
    store.delete(key)
    return false
  }
  return true
}

export function buildLockKey(instrument_id, date, slot_start) {
  return `${instrument_id}_${date}_${slot_start}`
}
