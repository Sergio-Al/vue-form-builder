import en from '@vueform/vueform/locales/en'
import vueform from '@vueform/vueform/themes/vueform'
import { defineConfig } from '@vueform/vueform'

export default defineConfig({
  theme: vueform,
  locales: { en },
  locale: 'en',
  apiKey: import.meta.env.VITE_VUEFORM_API_KEY,
})
