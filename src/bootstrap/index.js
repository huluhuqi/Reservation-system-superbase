let booted = false

export async function bootstrap(app) {
  if (booted) return
  booted = true

  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  app.config.globalProperties.$auth = {
    token,
    role
  }

  return true
}
