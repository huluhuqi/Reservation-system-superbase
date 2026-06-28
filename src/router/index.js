import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/home',
      component: () => import('../layout/UserLayout.vue'),
      children: [
        {
          path: '',
          redirect: '/home/booking'
        },
        {
          path: 'booking',
          component: () => import('../views/user/Booking.vue')
        },
        {
          path: 'records',
          component: () => import('../views/user/Records.vue')
        },
        {
          path: 'account',
          component: () => import('../views/user/Account.vue')
        }
      ]
    },
    {
      path: '/admin',
      component: () => import('../layout/AdminLayout.vue'),
      children: [
        {
          path: '',
          redirect: '/admin/dashboard'
        },
        {
          path: 'dashboard',
          component: () => import('../views/admin/Dashboard.vue')
        },
        {
          path: 'booking',
          component: () => import('../views/admin/Booking.vue')
        },
        {
          path: 'category',
          component: () => import('../views/admin/Category.vue')
        },
        {
          path: 'instrument',
          component: () => import('../views/admin/Instrument.vue')
        },
        {
          path: 'timeslot',
          component: () => import('../views/admin/TimeSlot.vue')
        },
        {
          path: 'lock',
          component: () => import('../views/admin/Lock.vue')
        },
        {
          path: 'user',
          component: () => import('../views/admin/User.vue')
        },
        {
          path: 'risk',
          component: () => import('../views/admin/Risk.vue')
        },
        {
          path: 'password',
          component: () => import('../views/admin/Password.vue')
        }
      ]
    }
  ]
})

export default router
