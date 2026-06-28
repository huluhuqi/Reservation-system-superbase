// =========================
// 🛡️ 风控执行引擎（唯一入口）
// =========================
import { getUserId } from './context.js'

const RISK_LEVEL = {
  NORMAL: 0,
  THROTTLE: 1,
  LIMITED: 2,
  BANNED: 3
}

const RISK_LABELS = {
  [RISK_LEVEL.NORMAL]: '正常',
  [RISK_LEVEL.THROTTLE]: '限流中',
  [RISK_LEVEL.LIMITED]: '限制中',
  [RISK_LEVEL.BANNED]: '已封禁'
}

const behaviorLogs = []
const MAX_LOGS = 500

export function addBehaviorLog(action, detail = {}) {
  const log = {
    user_id: getUserId(),
    action,
    detail,
    time: Date.now()
  }
  behaviorLogs.push(log)
  if (behaviorLogs.length > MAX_LOGS) {
    behaviorLogs.shift()
  }
  return log
}

export function getUserBehaviorLogs(user_id, action = null, windowMs = 60000) {
  const now = Date.now()
  return behaviorLogs.filter(log => {
    if (log.user_id !== user_id) return false
    if (action && log.action !== action) return false
    if (now - log.time > windowMs) return false
    return true
  })
}

export function calculateRiskLevel(user_id) {
  const oneMinuteBookings = getUserBehaviorLogs(user_id, 'booking_submit', 60000).length
  const fiveMinuteBookings = getUserBehaviorLogs(user_id, 'booking_submit', 300000).length
  const oneHourFailures = getUserBehaviorLogs(user_id, 'booking_failed', 3600000).length

  if (oneHourFailures > 20) return RISK_LEVEL.BANNED
  if (fiveMinuteBookings > 10) return RISK_LEVEL.LIMITED
  if (oneMinuteBookings > 3) return RISK_LEVEL.THROTTLE

  return RISK_LEVEL.NORMAL
}

export function baseRiskControl(user_id) {
  const level = calculateRiskLevel(user_id)

  if (level === RISK_LEVEL.BANNED) {
    return { level, banned: true, message: '账户操作异常，已被临时限制，请稍后再试' }
  }

  if (level === RISK_LEVEL.LIMITED) {
    return { level, cooldown: 60000, message: '操作过于频繁，请1分钟后再试' }
  }

  if (level === RISK_LEVEL.THROTTLE) {
    return { level, cooldown: 2000, message: '请求频繁，请稍候' }
  }

  return { level: RISK_LEVEL.NORMAL, cooldown: 0, message: '', banned: false }
}

export function recordBookingSuccess() {
  addBehaviorLog('booking_submit', { result: 'success' })
}

export function recordBookingFailed(reason = '') {
  addBehaviorLog('booking_failed', { reason })
}

export function resetRisk(user_id) {
  for (let i = behaviorLogs.length - 1; i >= 0; i--) {
    if (behaviorLogs[i].user_id === user_id) {
      behaviorLogs.splice(i, 1)
    }
  }
}

// =========================
// 🧠 行为画像 + riskEngine
// =========================
const userProfiles = new Map()

function getOrCreateProfile(user_id) {
  if (!userProfiles.has(user_id)) {
    userProfiles.set(user_id, {
      user_id,
      click_count: 0,
      click_timestamps: [],
      booking_count: 0,
      booking_timestamps: [],
      fail_count: 0,
      fail_timestamps: [],
      last_action: null,
      last_action_time: 0,
      risk_level: RISK_LEVEL.NORMAL,
      created_at: Date.now()
    })
  }
  return userProfiles.get(user_id)
}

function cleanupTimestamps(timestamps, windowMs) {
  const now = Date.now()
  const cutoff = now - windowMs
  return timestamps.filter(t => t > cutoff)
}

export function updateUserProfile(user_id, action) {
  const profile = getOrCreateProfile(user_id)
  const now = Date.now()

  profile.last_action = action
  profile.last_action_time = now

  profile.click_timestamps.push(now)
  profile.click_timestamps = cleanupTimestamps(profile.click_timestamps, 60000)

  if (action === 'booking_submit') {
    profile.booking_timestamps.push(now)
    profile.booking_timestamps = cleanupTimestamps(profile.booking_timestamps, 24 * 60 * 60 * 1000)
  }

  if (action === 'booking_failed') {
    profile.fail_timestamps.push(now)
    profile.fail_timestamps = cleanupTimestamps(profile.fail_timestamps, 60 * 60 * 1000)
  }

  profile.click_count = profile.click_timestamps.length
  profile.booking_count = profile.booking_timestamps.length
  profile.fail_count = profile.fail_timestamps.length

  return profile
}

export function getUserProfile(user_id) {
  const profile = getOrCreateProfile(user_id)
  const now = Date.now()

  return {
    ...profile,
    click_rate: profile.click_count / 60,
    booking_count_24h: profile.booking_timestamps.filter(t => now - t < 24 * 60 * 60 * 1000).length,
    fail_count_1h: profile.fail_timestamps.filter(t => now - t < 60 * 60 * 1000).length
  }
}

export function riskEngine(user_id) {
  const profile = getUserProfile(user_id)

  let risk_level = RISK_LEVEL.NORMAL

  if (profile.fail_count_1h > 5) {
    risk_level = Math.max(risk_level, RISK_LEVEL.LIMITED)
  }

  if (profile.click_rate > 10 / 60) {
    risk_level = Math.max(risk_level, RISK_LEVEL.THROTTLE)
  }

  if (profile.booking_count_24h > 20) {
    risk_level = Math.max(risk_level, RISK_LEVEL.LIMITED)
  }

  const recent_fails = profile.fail_timestamps.filter(t => Date.now() - t < 60 * 60 * 1000)
  if (recent_fails.length > 20) {
    risk_level = RISK_LEVEL.BANNED
  }

  profile.risk_level = risk_level

  return {
    risk_level,
    risk_label: RISK_LABELS[risk_level],
    profile,
    suggestions: generateRiskSuggestions(profile)
  }
}

function generateRiskSuggestions(profile) {
  const suggestions = []

  if (profile.fail_count_1h > 5) {
    suggestions.push('检测到频繁失败操作，建议检查预约信息是否正确')
  }

  if (profile.click_rate > 10 / 60) {
    suggestions.push('点击频率过高，建议降低操作频率')
  }

  if (profile.booking_count_24h > 20) {
    suggestions.push('当日预约次数过多，建议次日再试')
  }

  return suggestions
}

export function getAllProfiles() {
  return Array.from(userProfiles.entries()).map(([user_id, profile]) => ({
    user_id,
    ...profile
  }))
}

// =========================
// 🚀 风控执行守卫（强制执行链）
// =========================
function resolveUserId(user) {
  if (typeof user === 'string') return user
  return user?.id || user?.user_name || user?.username || 'guest'
}

export function riskGuard(user) {
  if (!user) {
    throw new Error('未登录')
  }

  const user_id = resolveUserId(user)
  const result = baseRiskControl(user_id)

  if (result.banned) {
    throw new Error(result.message || '账号已封禁')
  }

  if (result.level === RISK_LEVEL.LIMITED) {
    throw new Error(result.message || '账号受限')
  }

  if (result.level === RISK_LEVEL.THROTTLE) {
    return { delay: result.cooldown || 1000, message: result.message }
  }

  return { ok: true }
}

// =========================
// 🚀 checkRisk 简化版（统一入口）
// =========================
export function checkRisk(data) {
  const user_id = data.user_id

  if (!user_id) {
    return { pass: false, msg: '未登录' }
  }

  const key = `risk_${user_id}`
  const count = Number(localStorage.getItem(key) || 0)

  if (count >= 5) {
    return { pass: false, msg: '操作过于频繁' }
  }

  localStorage.setItem(key, count + 1)

  return { pass: true }
}

export function getRiskLevel(user) {
  const user_id = resolveUserId(user)
  return calculateRiskLevel(user_id)
}

export function getRiskLabel(level) {
  return RISK_LABELS[level] || '未知'
}

export function runRiskEngine(user) {
  const user_id = resolveUserId(user)
  return riskEngine(user_id)
}

export function riskControl(user) {
  return riskGuard(user)
}

export { RISK_LEVEL, RISK_LABELS }
