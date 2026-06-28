export async function bootstrap(app, router) {

  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  app.config.globalProperties.$auth = { token, role }

  await router.isReady()

  return true
}
