<template>
  <div style="display: flex; min-height: 100vh;">
    <div style="width: 200px; background: #1f2a44; color: white; padding: 20px 0; display: flex; flex-direction: column; height: 100vh;">
      <div style="padding: 0 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 10px;">
        <div style="font-size: 16px; font-weight: 600;">管理后台</div>
      </div>
      <div style="flex: 1;">
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
      <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
        <button @click="$router.push('/home/booking')">用户界面</button>
        <button @click="handleLogout">退出登录</button>
      </div>
    </div>
    <div style="flex: 1; background: #f5f7fa;">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()

async function handleLogout() {
  try {
    await supabase.auth.signOut()
    localStorage.removeItem('user')
    router.push('/login')
  } catch (e) {
    console.error('退出失败', e)
  }
}
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
