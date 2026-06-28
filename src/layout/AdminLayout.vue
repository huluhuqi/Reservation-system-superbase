<template>
  <div style="display: flex; min-height: 100vh;">
    <div style="width: 200px; background: #1f2a44; color: white; padding: 20px 0;">
      <button @click="$router.push('/admin/dashboard')">Dashboard</button>
      <button @click="$router.push('/admin/booking')">Booking</button>
      <button @click="$router.push('/admin/category')">Category</button>
      <button @click="$router.push('/admin/instrument')">Instrument</button>
      <button @click="$router.push('/admin/timeslot')">TimeSlot</button>
      <button @click="$router.push('/admin/lock')">Lock</button>
      <button @click="$router.push('/admin/user')">User</button>
      <button @click="$router.push('/admin/risk')">Risk</button>
      <button @click="$router.push('/admin/password')">Password</button>
    </div>
    <div style="flex: 1; background: #f5f7fa;">
      <router-view />
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
button {
  display: block;
  width: 100%;
  padding: 12px 20px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  text-align: left;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}
</style>
