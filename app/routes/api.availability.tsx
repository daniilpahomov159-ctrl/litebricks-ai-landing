import { json, type LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');

  if (!date) {
    return json({ error: 'Требуется параметр date' }, { status: 400 });
  }

  try {
    // Проксируем запрос к backend API
    const response = await fetch(`http://backend:3001/api/availability?date=${date}`);
    
    if (!response.ok) {
      throw new Error('Ошибка при получении доступных слотов');
    }

    const slots = await response.json();
    return json(slots);
  } catch (error) {
    console.error('Ошибка при загрузке доступных слотов:', error);
    return json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

