import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { bootstrap } from './bootstrap'
import './permission'

const app = createApp(App)

async function start() {
  await bootstrap(app)

  app.use(router)
  app.mount('#app')
}

start()
