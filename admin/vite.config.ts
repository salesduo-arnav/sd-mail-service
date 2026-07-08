import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Standalone admin dev server (5180) proxying the Admin API to the backend (3100).
const apiTarget = process.env.VITE_API_PROXY || 'http://localhost:3100';

export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
        port: 5180,
        host: true,
        proxy: { '/admin': apiTarget },
    },
});
