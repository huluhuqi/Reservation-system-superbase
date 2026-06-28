import router from '../router'
import { isUserLoggedIn, isAdmin, getUserRole } from '../api/context.js'

const WHITE_LIST = ['/login']

router.beforeEach((to, from, next) => {
  const loggedIn = isUserLoggedIn()
  const role = getUserRole()

  if (WHITE_LIST.includes(to.path)) {
    if (loggedIn) {
      if (role === 'admin' || role === 'super_admin') {
        return next('/admin/dashboard')
      }
      return next('/home/booking')
    }
    return next()
  }

  if (!loggedIn) {
    return next('/login')
  }

  if (to.path.startsWith('/admin')) {
    if (role === 'admin' || role === 'super_admin') {
      return next()
    }
    return next('/home/booking')
  }

  if (to.path === '/') {
    if (role === 'admin' || role === 'super_admin') {
      return next('/admin/dashboard')
    }
    return next('/home/booking')
  }

  next()
})
