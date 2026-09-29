import { fileURLToPath, URL } from 'node:url';

import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        noDiscovery: true
    },
    plugins: [
        vue(),
        tailwindcss(),
        Components({
            resolvers: [PrimeVueResolver()]
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    },
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.js'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            // The session and routing core; grow this list as views and stores get tests
            include: ['src/services/api.js', 'src/stores/auth.store.js', 'src/router/guard.js', 'src/router/menu.js', 'src/utils/**'],
            thresholds: { lines: 60 }
        }
    }
});
