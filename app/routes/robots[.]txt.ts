import { type LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const host = request.headers.get('X-Forwarded-Host') ?? request.headers.get('host');
  const protocol = host?.includes('localhost') ? 'http' : 'https';
  const domain = `${protocol}://${host}`;

  const robotsTxt = `# Robots.txt для LITEBRICK
# ${domain}

# Разрешаем всем поисковикам индексировать весь сайт
User-agent: *
Allow: /

# Запрещаем индексацию служебных директорий
Disallow: /api/
Disallow: /build/
Disallow: /_next/
Disallow: /node_modules/

# Специальные правила для Яндекса
User-agent: Yandex
Allow: /

# Специальные правила для Google
User-agent: Googlebot
Allow: /

# Ссылка на sitemap
Sitemap: ${domain}/sitemap.xml

# Дополнительные настройки
Host: ${host}
`;

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400', // 24 часа
    },
  });
}

