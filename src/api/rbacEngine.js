// =========================
// 🔐 RBAC 规则引擎（唯一入口）
// =========================
// 数据结构：
// {
//   role: 'admin',
//   rules: {
//     booking: ['create', 'view', 'delete'],
//     instrument: ['view'],
//     ...
//   }
// }

const DEFAULT_RULES = {
  super_admin: {
    booking: ['view', 'create', 'delete', 'edit'],
    instrument: ['view', 'create', 'edit', 'delete'],
    category: ['view', 'create', 'edit', 'delete'],
    time_slot: ['view', 'edit'],
    lock: ['view', 'create', 'delete'],
    user: ['view', 'create', 'edit', 'delete'],
    risk: ['view', 'manage'],
    password: ['change'],
    settings: ['edit']
  },
  admin: {
    booking: ['view', 'create', 'delete', 'edit'],
    instrument: ['view', 'create', 'edit', 'delete'],
    category: ['view', 'create', 'edit', 'delete'],
    time_slot: ['view', 'edit'],
    lock: ['view', 'create', 'delete'],
    user: ['view'],
    risk: ['view'],
    password: ['change'],
    settings: ['edit']
  },
  user: {
    booking: ['view', 'create', 'deleteSelf'],
    instrument: ['view'],
    category: ['view']
  }
}

export function getRoleRules(role) {
  return DEFAULT_RULES[role] || {}
}

export function can(user, module, action = null) {
  if (!user) return false

  if (user.role === 'super_admin') return true

  const rules = user.rules || getRoleRules(user.role)

  if (!rules[module]) return false

  const actions = rules[module]

  if (!actions || actions.length === 0) return false

  if (!action) return true

  return actions.includes(action)
}

export function canAny(user, actions) {
  if (!user) return false
  return actions.some(a => {
    if (typeof a === 'string') return can(user, a)
    return can(user, a.module, a.action)
  })
}

export function canAll(user, actions) {
  if (!user) return false
  return actions.every(a => {
    if (typeof a === 'string') return can(user, a)
    return can(user, a.module, a.action)
  })
}

export function getModuleActions(user, module) {
  if (!user) return []
  if (user.role === 'super_admin') return ['*']
  const rules = user.rules || getRoleRules(user.role)
  return rules[module] || []
}

export function hasPermission(user, key) {
  if (!key) return false
  const parts = key.split(':')
  const module = parts[0]
  const action = parts[1]
  return can(user, module, action)
}

export function hasAnyPermission(user, keys) {
  if (!user) return false
  return keys.some(key => hasPermission(user, key))
}

export function hasAllPermissions(user, keys) {
  if (!user) return false
  return keys.every(key => hasPermission(user, key))
}

export function getUserPermissions(user) {
  if (!user) return []
  const rules = user.rules || getRoleRules(user.role)
  const perms = []
  for (const [module, actions] of Object.entries(rules)) {
    for (const action of actions) {
      perms.push(`${module}:${action}`)
    }
  }
  return perms
}

export function getRolePermissions(role) {
  const rules = getRoleRules(role)
  const perms = []
  for (const [module, actions] of Object.entries(rules)) {
    for (const action of actions) {
      perms.push(`${module}:${action}`)
    }
  }
  return perms
}

export function requirePermission(user, module, action, message = '无权限操作') {
  if (!can(user, module, action)) {
    throw new Error(message)
  }
  return true
}
