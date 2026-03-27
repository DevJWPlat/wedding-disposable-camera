import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '@/views/LandingView.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import CameraView from '@/views/CameraView.vue'
import FinishedView from '@/views/FinishedView.vue'
import AdminView from '@/views/AdminView.vue'
import AnLoginView from '@/views/AnLoginView.vue'
import AnCameraView from '@/views/AnCameraView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import ExtraShotsCameraView from '@/views/ExtraShotsCameraView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: LandingView,
    },
    {
      path: '/welcome',
      name: 'welcome',
      component: WelcomeView,
    },
    {
      path: '/camera',
      name: 'camera',
      component: CameraView,
    },
    {
      path: '/finished',
      name: 'finished',
      component: FinishedView,
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
    },
    {
      path: '/an',
      name: 'an-login',
      component: AnLoginView,
    },
    {
      path: '/an/camera',
      name: 'an-camera',
      component: AnCameraView,
    },
    {
      path: '/extra-shots-camera',
      name: 'extra-shots-camera',
      component: ExtraShotsCameraView,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
})

router.beforeEach((to, from, next) => {
  if (to.path === '/an/camera') {
    const isAuthed = sessionStorage.getItem('wedding_camera_an_auth') === 'true'
    if (!isAuthed) {
      next('/an')
      return
    }
  }

  next()
})

export default router