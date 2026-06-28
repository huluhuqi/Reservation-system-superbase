import router from '../router'

let ready = false

router.beforeEach((to, from, next) => {

  if (!ready) {
    ready = true
    return next(to.fullPath)
  }

  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  if (!token && to.path !== '/login') {
    return next('/login')
  }

  if (to.path.startsWith('/admin')) {
    if (role === 'admin') return next()
    return next('/home/booking')
  }

  next()
})
