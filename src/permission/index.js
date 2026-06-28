import router from '../router'

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function isLoggedIn() {
  const user = getCurrentUser()
  return !!(user && (user.user_id || user.id || user.user_name))
}

function isAdmin() {
  const user = getCurrentUser()
  return user && user.role === 'admin'
}

router.beforeEach((to, from, next) => {

  if (!isLoggedIn() && to.path !== '/login') {
    return next('/login')
  }

  if (to.path.startsWith('/admin')) {
    if (isAdmin()) return next()
    return next('/home/booking')
  }

  next()
})
