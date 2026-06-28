import router from '../router'

let init = false

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  if (!init) {
    init = true
    return next(to.fullPath)
  }

  if (!token && to.path !== '/login') {
    return next('/login')
  }

  if (to.path === '/login') {
    return next()
  }

  if (to.path.startsWith('/admin')) {
    if (role === 'admin' || role === 'super_admin') {
      return next()
    }
    return next('/home/booking')
  }

  next()
})
