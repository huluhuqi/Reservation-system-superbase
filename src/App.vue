<template>
  <div v-if="ready">
    <component :is="layout" />
  </div>

  <div v-else class="loading">
    Loading...
  </div>
</template>

<script>
import UserLayout from './layout/UserLayout.vue'
import AdminLayout from './layout/AdminLayout.vue'

export default {
  data() {
    return {
      ready: false
    }
  },

  mounted() {
    this.ready = true
  },

  computed: {
    layout() {
      const path = this.$route.path

      if (!path) return UserLayout

      if (path.startsWith('/admin')) {
        return AdminLayout
      }

      return UserLayout
    }
  }
}
</script>
