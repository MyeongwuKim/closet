import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  const isNativeWebBundle = process.env.CLOSET_NATIVE_WEB_BUNDLE === '1'

  return {
    base: isNativeWebBundle ? './' : '/',
    plugins: [react(), tailwindcss()],
    build: {
      modulePreload: isNativeWebBundle ? false : undefined,
    },
  }
})
