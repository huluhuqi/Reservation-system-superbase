const USER_KEY = 'user'

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function setUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(USER_KEY)
  }
}

export function clearUser() {
  localStorage.removeItem(USER_KEY)
}

export function getUserId() {
  const user = getUser()
  return user.user_id || user.id || user.user_name || ''
}

export function getUserRole() {
  const user = getUser()
  return user.role || user.user_role || ''
}

export function getUserName() {
  const user = getUser()
  return user.user_name || ''
}

export function isUserLoggedIn() {
  const user = getUser()
  return !!(user && (user.user_id || user.id || user.user_name))
}

export function isAdmin() {
  const user = getUser()
  return user && user.role === 'admin'
}

export function buildUserKey(user_name, employee_no) {
  const user = getUser()
  if (user && user.user_name) {
    return user.user_name
  }
  return `${(user_name || '').trim()}_${(employee_no || '').trim()}`
}
