import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/home/booking'
    },
    {
      path: '/admin',
      redirect: '/admin/dashboard'
    },
    {
      path: '/home',
      redirect: '/home/booking'
    },
    {
      path: '/login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/home/booking',
      component: () => import('../views/user/Booking.vue')
    },
    {
      path: '/home/records',
      component: () => import('../views/user/Records.vue')
    },
    {
      path: '/home/account',
      component: () => import('../views/user/Account.vue')
    },
    {
      path: '/admin/dashboard',
      component: () => import('../views/admin/Dashboard.vue')
    },
    {
      path: '/admin/booking',
      component: () => import('../views/admin/Booking.vue')
    },
    {
      path: '/admin/category',
      component: () => import('../views/admin/Category.vue')
    },
    {
      path: '/admin/instrument',
      component: () => import('../views/admin/Instrument.vue')
    },
    {
      path: '/admin/timeslot',
      component: () => import('../views/admin/TimeSlot.vue')
    },
    {
      path: '/admin/lock',
      component: () => import('../views/admin/Lock.vue')
    },
    {
      path: '/admin/user',
      component: () => import('../views/admin/User.vue')
    },
    {
      path: '/admin/risk',
      component: () => import('../views/admin/Risk.vue')
    },
    {
      path: '/admin/password',
      component: () => import('../views/admin/Password.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/home/booking'
    }
  ]
})

export default router
