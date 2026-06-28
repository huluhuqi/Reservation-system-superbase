<template>
  <div v-if="ready">
    <component :is="layout" />
  </div>
</template>

<script>
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
        return () => import('./views/Login.vue')
      }

      if (path.startsWith('/admin')) {
        return () => import('./layout/AdminLayout.vue')
      }

      return () => import('./layout/UserLayout.vue')
    }
  },
  mounted() {
    this.ready = true
  }
}
</script>
