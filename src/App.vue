<template>
  <component :is="layout" />
</template>

<script>
import UserLayout from './layout/UserLayout.vue'
import AdminLayout from './layout/AdminLayout.vue'
import Login from './views/Login.vue'

export default {
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
  }
}
</script>
