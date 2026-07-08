import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

// Callers can set `skipErrorToast` to handle their own error UI.
declare module 'axios' {
    export interface AxiosRequestConfig {
        skipErrorToast?: boolean;
    }
}

// Same-origin in prod (served by the api); dev uses the Vite proxy for /admin.
export const api = axios.create({
    baseURL: '/',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
    (r) => r,
    (error: AxiosError<{ message?: string }>) => {
        const cfg = (error.config ?? {}) as InternalAxiosRequestConfig & { skipErrorToast?: boolean };
        const status = error.response?.status;
        if (status === 401) {
            // Auth gate re-checks /auth/me and shows the login screen; don't toast.
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.dispatchEvent(new CustomEvent('sdmail:unauthorized'));
            }
        } else if (!cfg.skipErrorToast) {
            const msg =
                error.response?.data?.message ||
                (error.code === 'ERR_NETWORK' ? 'Network error — is the API running?' : 'Something went wrong');
            toast.error(msg);
        }
        return Promise.reject(error);
    },
);
