import router from '../router'
import { supabase } from '../lib/supabase'

function getLocalUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function isLoggedIn() {
  return !!getLocalUser()
}

function isAdmin() {
  const user = getLocalUser()
  return user && user.role === 'admin'
}

let sessionChecked = false

async function checkSession() {
  if (sessionChecked) return true
  sessionChecked = true

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session && getLocalUser()) {
      localStorage.removeItem('user')
      return false
    }
    return !!session
  } catch {
    if (getLocalUser()) {
      localStorage.removeItem('user')
    }
    return false
  }
}

router.beforeEach(async (to, from, next) => {
  if (to.path === '/login') {
    sessionChecked = false
    return next()
  }

  const hasLocalUser = isLoggedIn()

  if (!hasLocalUser) {
    return next('/login')
  }

  if (!sessionChecked) {
    const validSession = await checkSession()
    if (!validSession) {
      return next('/login')
    }
  }

  if (to.path.startsWith('/admin')) {
    if (isAdmin()) return next()
    return next('/home/booking')
  }

  next()
})