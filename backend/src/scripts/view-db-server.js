/**
 * Простой веб-сервер для просмотра данных БД через браузер
 * Запуск: node src/scripts/view-db-server.js
 */

import express from 'express';
import { prisma } from '../utils/prisma.js';
import { decryptField } from '../utils/encryption.js';
import { maskContact } from '../utils/mask-sensitive-data.js';

const app = express();
const PORT = 5556;

app.get('/', async (req, res) => {
  try {
    // Получаем все таблицы
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const users = await prisma.user.findMany({
      take: 100,
    });

    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Расшифровываем данные для отображения
    const bookingsWithDecrypted = bookings.map(booking => {
      let decryptedContact = null;
      if (booking.contactRawEncrypted) {
        try {
          decryptedContact = decryptField(booking.contactRawEncrypted);
        } catch (error) {
          decryptedContact = booking.contactRaw || 'Ошибка расшифровки';
        }
      } else {
        decryptedContact = booking.contactRaw;
      }

      return {
        ...booking,
        contactRaw: decryptedContact,
        contactRawMasked: maskContact(decryptedContact, booking.contactType),
        contactRawEncrypted: undefined, // Не показываем зашифрованные данные
      };
    });

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Просмотр базы данных</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }
        .section {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
            color: #555;
            margin-bottom: 15px;
            font-size: 1.5em;
        }
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }
        .stat {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 6px;
            flex: 1;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #4CAF50;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #4CAF50;
            color: white;
            font-weight: 600;
        }
        tr:hover {
            background: #f9f9f9;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge-confirmed {
            background: #4CAF50;
            color: white;
        }
        .badge-cancelled {
            background: #f44336;
            color: white;
        }
        .badge-email {
            background: #2196F3;
            color: white;
        }
        .badge-telegram {
            background: #9C27B0;
            color: white;
        }
        .encrypted {
            color: #999;
            font-style: italic;
        }
        .refresh-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            margin-bottom: 20px;
        }
        .refresh-btn:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Просмотр базы данных Litebrick</h1>
        
        <button class="refresh-btn" onclick="location.reload()">🔄 Обновить данные</button>

        <div class="section">
            <h2>📈 Статистика</h2>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${bookings.length}</div>
                    <div class="stat-label">Броней</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${users.length}</div>
                    <div class="stat-label">Пользователей</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${auditLogs.length}</div>
                    <div class="stat-label">Записей аудита</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📅 Бронирования (последние ${bookings.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Дата</th>
                        <th>Время (МСК)</th>
                        <th>Контакт (расшифровано)</th>
                        <th>Контакт (замаскировано)</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th>Создано</th>
                    </tr>
                </thead>
                <tbody>
                    ${bookingsWithDecrypted.map(booking => {
                        const startMoscow = new Date(booking.startUtc).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
                        const endMoscow = new Date(booking.endUtc).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' });
                        const date = new Date(booking.date).toLocaleDateString('ru-RU');
                        return `
                        <tr>
                            <td><code>${booking.id.substring(0, 8)}...</code></td>
                            <td>${date}</td>
                            <td>${startMoscow} - ${endMoscow}</td>
                            <td>${booking.contactRaw || '-'}</td>
                            <td class="encrypted">${booking.contactRawMasked || '-'}</td>
                            <td><span class="badge badge-${booking.contactType?.toLowerCase() || 'unknown'}">${booking.contactType || '-'}</span></td>
                            <td><span class="badge badge-${booking.status?.toLowerCase() || 'unknown'}">${booking.status || '-'}</span></td>
                            <td>${new Date(booking.createdAt).toLocaleString('ru-RU')}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>👥 Пользователи (${users.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Telegram</th>
                        <th>Броней</th>
                        <th>Создан</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td><code>${user.id.substring(0, 8)}...</code></td>
                            <td>${user.email || '-'}</td>
                            <td>${user.telegram || '-'}</td>
                            <td>${user.bookings?.length || 0}</td>
                            <td>${new Date(user.createdAt).toLocaleString('ru-RU')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📝 Аудит логи (последние ${auditLogs.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Действие</th>
                        <th>Booking ID</th>
                        <th>Метаданные</th>
                        <th>Создан</th>
                    </tr>
                </thead>
                <tbody>
                    ${auditLogs.map(log => `
                        <tr>
                            <td><code>${log.id.substring(0, 8)}...</code></td>
                            <td><strong>${log.action}</strong></td>
                            <td>${log.bookingId ? `<code>${log.bookingId.substring(0, 8)}...</code>` : '-'}</td>
                            <td><pre style="font-size: 0.8em; margin: 0;">${JSON.stringify(log.metadata || {}, null, 2)}</pre></td>
                            <td>${new Date(log.createdAt).toLocaleString('ru-RU')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send(`
      <h1>Ошибка</h1>
      <pre>${error.message}</pre>
      <pre>${error.stack}</pre>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Веб-интерфейс БД доступен на http://localhost:${PORT}`);
});



