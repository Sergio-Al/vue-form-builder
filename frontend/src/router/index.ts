import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/forms',
    },
    {
      path: '/forms',
      name: 'forms',
      component: () => import('@/pages/FormsList.vue'),
    },
    {
      path: '/forms/new',
      name: 'forms-new',
      component: () => import('@/pages/FormBuilder.vue'),
    },
    {
      path: '/forms/:id/edit',
      name: 'forms-edit',
      component: () => import('@/pages/FormBuilder.vue'),
    },
    {
      path: '/forms/:id/responses',
      name: 'forms-responses',
      component: () => import('@/pages/ResponsesList.vue'),
    },
    {
      path: '/f/:id',
      name: 'form-fill',
      component: () => import('@/pages/FormRenderer.vue'),
    },
  ],
})

export default router
