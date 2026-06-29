import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { supabase } from './lib/supabase'
import './permission'

async function initApp() {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        const user = {
          id: session.user.id,
          user_name: profile?.username || session.user.email?.split('@')[0],
          email: session.user.email,
          employee_no: profile?.employee_no || '',
          role: profile?.role || (session.user.email === 'admin@admin.com' ? 'admin' : 'user')
        }
        localStorage.setItem('user', JSON.stringify(user))
      } catch (e) {
        console.warn('获取用户profile失败', e)
      }
    } else {
      localStorage.removeItem('user')
    }
  } catch (e) {
    console.warn('初始化session失败', e)
    localStorage.removeItem('user')
  }

  const app = createApp(App)
  app.use(router)

  await router.isReady()
  app.mount('#app')
}

initApp()