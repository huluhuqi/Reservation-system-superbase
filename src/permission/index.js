import router from '../router'
import { getUser, isUserLoggedIn, isAdmin } from '../api/context.js'

router.beforeEach((to, from, next) => {
  const user = getUser()

  if (to.path !== '/login' && !isUserLoggedIn()) {
    return next('/login')
  }

  if (to.path.startsWith('/admin')) {
    if (!isAdmin()) {
      return next('/home')
    }
  }

  next()
})
