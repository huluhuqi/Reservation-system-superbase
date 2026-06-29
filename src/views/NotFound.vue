<template>
  <div class="not-found">
    <div class="not-found-card">
      <div class="error-code">404</div>
      <h2>页面不存在</h2>
      <p>您访问的页面不存在或已被移除</p>
      <button class="back-btn" type="button" @click="goBack">
        返回首页
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.push('/home/booking')
}
</script>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.not-found-card {
  background: white;
  padding: 48px 60px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.error-code {
  font-size: 72px;
  font-weight: 800;
  color: #4a90e2;
  line-height: 1;
  margin-bottom: 16px;
}

.not-found-card h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2a44;
}

.not-found-card p {
  margin: 0 0 24px;
  font-size: 14px;
  color: #6b7a99;
}

.back-btn {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s;
}

.back-btn:hover {
  transform: translateY(-2px);
}
</style>