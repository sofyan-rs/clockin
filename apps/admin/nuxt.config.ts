// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  devServer: { port: 3001 },
  // Read from NUXT_* env at runtime, so one image serves staging and production (DEPLOYMENT §3).
  runtimeConfig: {
    apiBase: 'http://localhost:3000',
    sessionSecret: '',
    public: {
      appName: 'ClockIn',
    },
  },
  typescript: { strict: true },
});
