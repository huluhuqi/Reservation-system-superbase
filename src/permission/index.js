import router from '../router'
import { isUserLoggedIn, getUserRole } from '../api/context.js'

let initialized = false

router.beforeEach((to, from, next) => {
  const token = isUserLoggedIn()
  const role = getUserRole()

  if (!token && to.path !== '/login') {
    return next('/login')
  }

  if (to.path === '/login') {
    if (token) {
      if (role === 'admin' || role === 'super_admin') {
        return next('/admin/dashboard')
      }
      return next('/home/booking')
    }
    return next()
  }

  if (!initialized) {
    initialized = true
    if (to.path === '/' || to.path === '/home') {
      if (role === 'admin' || role === 'super_admin') {
        return next('/admin/dashboard')
      }
      return next('/home/booking')
    }
  }

  if (to.path.startsWith('/admin')) {
    if (role === 'admin' || role === 'super_admin') {
      return next()
    }
    return next('/home/booking')
  }

  next()
})
