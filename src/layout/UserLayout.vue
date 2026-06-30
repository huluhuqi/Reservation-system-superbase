<template>
  <div class="user-layout">
    <router-view />
    <div class="tabbar">
      <button @click="$router.push('/home/booking')">预约</button>
      <button @click="$router.push('/home/records')">记录</button>
      <button @click="$router.push('/home/account')">账号</button>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.user-layout {
  min-height: 100vh;
  padding-bottom: 60px;
  background: var(--bg);
}

.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  background: var(--card);
  border-top: 1px solid var(--line);
  z-index: 100;
}

.tabbar button {
  flex: 1;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
}

.tabbar button:hover {
  color: var(--primary);
}
</style>
