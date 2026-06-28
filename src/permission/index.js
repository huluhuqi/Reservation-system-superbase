import router from '../router'

router.beforeEach((to, from, next) => {

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
