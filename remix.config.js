/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ['**/.*'],
  // Поддержка серверного рендеринга
  serverModuleFormat: 'esm',
  // Настройка для продакшена
  serverMinify: true,
  // Путь к публичной директории
  publicPath: '/build/',
  // Директория для сборки
  assetsBuildDirectory: 'public/build',
  // Таймаут для загрузки данных
  serverBuildTimeout: 60,
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
  },
};

