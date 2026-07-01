<template>
  <router-view v-slot="{ Component, route }">
    <transition name="page-transition" mode="out-in">
      <component :is="Component" :key="route.path" />
    </transition>
  </router-view>
</template>
