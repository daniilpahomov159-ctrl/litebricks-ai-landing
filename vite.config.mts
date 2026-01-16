import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['litebrick.ru'],
    // Исключаем .git директорию из обработки файлов
    fs: {
      // Блокируем доступ к .git директории и её содержимому
      deny: ['.git', '**/.git/**'],
      // Включаем строгий режим для безопасности
      strict: true,
    },
    proxy: {
      '/api': {
        // Во фронтенд-контейнере backend доступен по имени сервиса Docker,
        // поэтому указываем backend:3001, иначе proxy выдаёт 500.
        target: 'http://backend:3001',
        changeOrigin: true,
      },
    },
  },
});

