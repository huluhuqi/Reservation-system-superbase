<template>
  <div v-if="ready">
    <component :is="layout" />
  </div>
</template>

<script>
import UserLayout from './layout/UserLayout.vue'
import AdminLayout from './layout/AdminLayout.vue'
import Login from './views/Login.vue'

export default {
  data() {
    return {
      ready: false
    }
  },
  computed: {
    layout() {
      const path = this.$route.path

      if (path === '/login') {
        return Login
      }

      if (path.startsWith('/admin')) {
        return AdminLayout
      }

      return UserLayout
    }
  },
  mounted() {
    setTimeout(() => {
      this.ready = true
    }, 50)
  }
}
</script>
