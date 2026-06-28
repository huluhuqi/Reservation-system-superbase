// =========================
// 📊 审计系统（企业级行为记录）
// =========================
// 记录所有关键行为，支持日志查询和导出

import { getUser, getUserId, getUserRole, getUserName } from '../api/context.js'
import { getDeviceId } from '../utils/device.js'

const MAX_AUDIT_LOGS = 1000

function createAuditEntry(action, category, data = {}, result = 'success', error_msg = '') {
  const user = getUser()
  return {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    date: new Date().toISOString(),
    user_id: getUserId() || 'guest',
    user_name: getUserName() || '未知用户',
    role: getUserRole() || 'unknown',
    device_id: getDeviceId(),
    action,
    category,
    data,
    result,
    error_msg,
    ip: 'client'
  }
}

const auditLogs = []

export function logAction(action, data = {}, category = 'system', result = 'success', error_msg = '') {
  const entry = createAuditEntry(action, category, data, result, error_msg)
  auditLogs.push(entry)

  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.shift()
  }

  console.log(`[AUDIT] [${category.toUpperCase()}] [${result}] ${entry.user_id}:${action}`, data)

  return entry
}

export function logLogin(user, result = 'success') {
  return logAction('login', { user_name: user.user_name || user.username, role: user.role }, 'auth', result)
}

export function logLogout() {
  const user = getUser()
  return logAction('logout', { user_name: user.user_name || user.username }, 'auth')
}

export function logBooking(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'booking', result, error_msg)
}

export function logInstrument(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'instrument', result, error_msg)
}

export function logCategory(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'category', result, error_msg)
}

export function logUser(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'user', result, error_msg)
}

export function logSettings(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'settings', result, error_msg)
}

export function logRisk(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'risk', result, error_msg)
}

export function logSecurity(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'security', result, error_msg)
}

export function logPermission(action, data, result = 'success', error_msg = '') {
  return logAction(action, data, 'permission', result, error_msg)
}

export function getAuditLogs(options = {}) {
  const { category, user_id, action, start_time, end_time, limit = 100 } = options

  let filtered = [...auditLogs]

  if (category) {
    filtered = filtered.filter(log => log.category === category)
  }
  if (user_id) {
    filtered = filtered.filter(log => log.user_id === user_id)
  }
  if (action) {
    filtered = filtered.filter(log => log.action === action)
  }
  if (start_time) {
    filtered = filtered.filter(log => log.timestamp >= start_time)
  }
  if (end_time) {
    filtered = filtered.filter(log => log.timestamp <= end_time)
  }

  filtered.sort((a, b) => b.timestamp - a.timestamp)

  return filtered.slice(0, limit)
}

export function exportAuditLogs(options = {}) {
  const logs = getAuditLogs({ ...options, limit: MAX_AUDIT_LOGS })
  const csv = [
    ['ID', '时间', '用户', '角色', '操作', '类别', '结果', '详情'].join(','),
    ...logs.map(log => [
      log.id,
      log.date,
      log.user_id,
      log.role,
      log.action,
      log.category,
      log.result,
      JSON.stringify(log.data)
    ].join(','))
  ].join('\n')

  return csv
}

export function clearAuditLogs() {
  auditLogs.length = 0
}

export function getAuditStats() {
  const stats = {
    total: auditLogs.length,
    by_category: {},
    by_result: { success: 0, fail: 0 },
    by_role: {},
    recent_24h: 0
  }

  const day_ago = Date.now() - 24 * 60 * 60 * 1000

  for (const log of auditLogs) {
    stats.by_category[log.category] = (stats.by_category[log.category] || 0) + 1
    stats.by_result[log.result] = (stats.by_result[log.result] || 0) + 1
    stats.by_role[log.role] = (stats.by_role[log.role] || 0) + 1
    if (log.timestamp > day_ago) {
      stats.recent_24h++
    }
  }

  return stats
}
