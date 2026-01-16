import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import type { LinksFunction } from '@remix-run/node';
import { ThemeProvider } from './context/ThemeContext';

import globalStyles from './styles/global.css?url';

export const links: LinksFunction = () => [
  // Preload критических шрифтов для быстрой загрузки
  { 
    rel: 'preload', 
    href: '/fonts/EpilepsySansBold.ttf', 
    as: 'font',
    type: 'font/ttf',
    crossOrigin: 'anonymous'
  },
  // Главный CSS файл
  { rel: 'stylesheet', href: globalStyles },
  // Preload фавикона для мгновенного отображения
  { rel: 'preload', href: '/favicon.svg', as: 'image', type: 'image/svg+xml' },
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg', sizes: 'any' },
  { rel: 'alternate icon', href: '/favicon.svg' },
  { rel: 'apple-touch-icon', href: '/favicon.svg' },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { 
    rel: 'preconnect', 
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous'
  },
  // Добавлен &display=swap для предотвращения FOIT (Flash of Invisible Text)
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Orbitron:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Josefin+Sans:wght@400;700&display=swap',
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Поддержка темной/светлой темы для браузера */}
        <meta name="color-scheme" content="light dark" />
        {/* Синхронное применение темы ДО рендера (убирает FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const STORAGE_KEY = 'theme-preference';
                  const saved = localStorage.getItem(STORAGE_KEY);
                  let theme = 'light';
                  
                  if (saved) {
                    const pref = JSON.parse(saved);
                    if (pref.theme === 'night') {
                      theme = 'night';
                    } else if (pref.theme === 'light') {
                      theme = 'light';
                    } else if (pref.theme === 'auto') {
                      // Проверяем системные настройки
                      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                      if (prefersDark) {
                        theme = 'night';
                      } else {
                        // Проверяем время суток
                        const hours = new Date().getHours();
                        theme = hours >= 18 ? 'night' : 'light';
                      }
                    }
                  } else {
                    // Если нет сохраненных настроек, проверяем системные
                    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) {
                      theme = 'night';
                    } else {
                      const hours = new Date().getHours();
                      theme = hours >= 18 ? 'night' : 'light';
                    }
                  }
                  
                  // Применяем тему синхронно
                  const root = document.documentElement;
                  if (theme === 'night') {
                    root.style.setProperty('--color-primary', '#ad2831');
                    root.style.setProperty('--color-primary-dark', '#800e13');
                    root.style.setProperty('--color-dark', '#250902');
                    root.style.setProperty('--color-fuchsia', '#ad2831');
                    root.style.setProperty('--color-electric-purple', '#800e13');
                    root.style.setProperty('--color-deep-violet', '#250902');
                    root.style.setProperty('--color-hot-pink', '#ad2831');
                    root.style.setProperty('--color-black-purple', '#250902');
                    root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, #ad2831, #800e13)');
                    root.style.setProperty('--gradient-card', 'linear-gradient(135deg, rgba(173, 40, 49, 0.10), rgba(128, 14, 19, 0.10))');
                    root.style.setProperty('--shadow-glow', '0 0 20px rgba(173, 40, 49, 0.3)');
                    root.style.setProperty('--body-gradient', 'linear-gradient(135deg, #250902 0%, #38040e 50%, #640d14 100%)');
                    root.style.setProperty('--color-primary-rgb', '173, 40, 49');
                    root.style.setProperty('--color-primary-dark-rgb', '128, 14, 19');
                    root.setAttribute('data-theme', 'night');
                    document.body.classList.add('theme-night');
                    document.body.style.backgroundColor = '#250902';
                    document.body.style.color = '#FFF';
                  } else {
                    root.style.setProperty('--color-primary', '#4371F4');
                    root.style.setProperty('--color-primary-dark', '#003983');
                    root.style.setProperty('--color-dark', '#07192C');
                    root.style.setProperty('--color-fuchsia', '#4371F4');
                    root.style.setProperty('--color-electric-purple', '#003983');
                    root.style.setProperty('--color-deep-violet', '#07192C');
                    root.style.setProperty('--color-hot-pink', '#4371F4');
                    root.style.setProperty('--color-black-purple', '#07192C');
                    root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, #4371F4, #003983)');
                    root.style.setProperty('--gradient-card', 'linear-gradient(135deg, rgba(67, 113, 244, 0.10), rgba(0, 57, 131, 0.10))');
                    root.style.setProperty('--shadow-glow', '0 0 20px rgba(67, 113, 244, 0.3)');
                    root.style.setProperty('--body-gradient', 'linear-gradient(135deg, #07192C 0%, #000000 50%, #003983 100%)');
                    root.style.setProperty('--color-primary-rgb', '67, 113, 244');
                    root.style.setProperty('--color-primary-dark-rgb', '0, 57, 131');
                    root.setAttribute('data-theme', 'light');
                    document.body.classList.add('theme-light');
                    document.body.style.backgroundColor = '#07192C';
                    document.body.style.color = '#FFF';
                  }
                } catch(e) {
                  // Fallback на светлую тему при ошибке
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.body.style.backgroundColor = '#07192C';
                  document.body.style.color = '#FFF';
                }
              })();
            `,
          }}
        />
        {/* Критические стили для предотвращения FOUC */}
        <style dangerouslySetInnerHTML={{__html: `html,body{margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;transition:background-color 0.3s ease,color 0.3s ease}main{padding-top:60px}img{max-width:100%;height:auto}#__remix-loading{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:none}body:empty #__remix-loading{display:block}`}} />
        <meta 
          name="description" 
          content="Внедряем искусственный интеллект в бизнес-процессы: AI-консалтинг, автоматизация, разработка AI-решений. Снижаем издержки, ускоряем операции, создаём окупаемые решения, приносящие прибыль. AI-ассистенты и агенты,чат-боты, веб-приложения, приложения в телеграмме. Бесплатная консультация." 
        />
        <meta 
          name="keywords" 
          content="искусственный интеллект, AI, внедрение ИИ, AI-консалтинг, автоматизация бизнес-процессов, разработка AI-решений, машинное обучение, нейросети, чат-боты, автоматизация бизнеса, цифровая трансформация, AI-аудит, внедрение нейросетей, ИИ для бизнеса, веб-приложения, telegram mini app" 
        />
        
        {/* Open Graph */}
        <meta property="og:title" content="LITEBRICK - Внедрение ИИ в бизнес" />
        <meta 
          property="og:description" 
          content="Внедряем искусственный интеллект в бизнес-процессы. Снижаем издержки, ускоряем операции." 
        />
        <meta property="og:image" content="/og-cover.png" />
        <meta property="og:type" content="website" />
        
        {/* Schema.org structured data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ProfessionalService',
              name: 'LITEBRICK',
              description: 'Внедряем искусственный интеллект в бизнес-процессы. Снижаем издержки, ускоряем операции, создаём окупаемые решения, приносящие прибыль.',
              url: 'https://litebrick.ru',
              logo: 'https://litebrick.ru/docs/Логотип_без фона_белый.svg',
              image: 'https://litebrick.ru/og-cover.png',
              telephone: '+7-927-048-1765',
              email: 'litebrickstudios@gmail.com',
              address: {
                '@type': 'PostalAddress',
                addressCountry: 'RU',
              },
              priceRange: '$$',
              openingHoursSpecification: {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                opens: '09:00',
                closes: '18:00',
              },
              sameAs: [
                'https://t.me/dperson24',
                'https://wa.me/79270481765',
              ],
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '5',
                reviewCount: '12',
              },
              areaServed: {
                '@type': 'Country',
                name: 'Россия',
              },
              serviceType: [
                'Внедрение искусственного интеллекта',
                'AI-консалтинг',
                'Автоматизация бизнес-процессов',
                'Разработка AI-решений',
                'Чат-боты',
                'Веб-приложения',
                'Приложения в телеграмм',
                'Telegram mini app',
              ],
            }),
          }}
        />
        
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
        {/* LiveReload удален - вызывал ошибки WebSocket на продакшене */}
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

