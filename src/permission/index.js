import router from '../router'

let init = false

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  if (!init) {
    init = true
    return next()
  }

  if (!token && to.path !== '/login') {
    return next('/login')
  }

  next()
})
