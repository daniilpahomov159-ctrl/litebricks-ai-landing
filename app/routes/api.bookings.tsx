import { json, type ActionFunctionArgs } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  // Парсим FormData (работает БЕЗ JavaScript!)
  const formData = await request.formData();
  
  const date = formData.get('date') as string;
  const time = formData.get('time') as string;
  const contact = formData.get('contact') as string;
  const consentPersonal = formData.get('consentPersonal') === 'on';

  // Валидация
  const errors: Record<string, string> = {};
  if (!date) errors.date = 'Пожалуйста, выберите дату';
  if (!time) errors.time = 'Пожалуйста, выберите время';
  if (!contact) errors.contact = 'Пожалуйста, укажите контакт';
  if (!consentPersonal) errors.consentPersonal = 'Необходимо согласие';

  if (Object.keys(errors).length > 0) {
    return json({ success: false, errors }, { status: 400 });
  }

  // Конвертируем время в UTC
  const moscowTimeString = `${date}T${time}:00+03:00`;
  const startDate = new Date(moscowTimeString);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  // Отправляем на backend API
  try {
    const response = await fetch('http://backend:3001/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        startUtc: startDate.toISOString(),
        endUtc: endDate.toISOString(),
        contactRaw: contact,
        contactType: contact.includes('@') ? 'EMAIL' : 'TELEGRAM',
        consentPersonal: true,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      
      // Конфликт бронирования
      if (response.status === 409) {
        return json({
          success: false,
          errors: { time: 'Слот уже забронирован, выберите другой' },
        }, { status: 409 });
      }
      
      // Ошибка валидации от backend
      if (response.status === 400 && data.error?.fields) {
        return json({
          success: false,
          errors: data.error.fields,
        }, { status: 400 });
      }

      throw new Error(data.error?.message || 'Ошибка при создании брони');
    }

    const booking = await response.json();

    return json({
      success: true,
      message: 'Запись прошла успешно!',
      booking,
    });
  } catch (error) {
    console.error('Ошибка при создании брони:', error);
    return json({
      success: false,
      errors: { _general: 'Произошла ошибка. Попробуйте еще раз.' },
    }, { status: 500 });
  }
}

// Метод OPTIONS для CORS (если нужен)
export async function loader() {
  return json({ message: 'Use POST method' }, { status: 405 });
}

