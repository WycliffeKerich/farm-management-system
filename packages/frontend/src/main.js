import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth.store';
import { setSessionExpiredHandler } from './services/api';

import Aura from '@primeuix/themes/aura';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

import '@/assets/tailwind.css';
import '@/assets/styles.scss';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.app-dark'
        }
    }
});
app.use(ToastService);
app.use(ConfirmationService);

// A refresh failed mid-session: drop the local session and ask the user to sign in again
const authStore = useAuthStore();
setSessionExpiredHandler(() => {
    authStore.clearSession();
    const current = router.currentRoute.value;
    if (current.meta.requiresAuth || current.matched.some((record) => record.meta.requiresAuth)) {
        router.push({ name: 'login', query: { redirect: current.fullPath } });
    }
});

// The router guard restores the session (refresh cookie) before the first page renders
app.mount('#app');
