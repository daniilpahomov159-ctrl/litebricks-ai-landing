import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'bookingForm:v1';

export default function BookingRemix() {
  
  // Проверка наличия подтвержденной брони
  const getBookingInfo = () => {
    // localStorage доступен только в браузере, не на сервере (SSR)
    if (typeof window === 'undefined') return null;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Проверяем, является ли это подтвержденной бронью
        if (parsed.isConfirmed && parsed.endUtc) {
          const endUtc = new Date(parsed.endUtc);
          const now = new Date();
          
          // Если бронь уже прошла - очищаем localStorage
          if (endUtc < now) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
          }
          
          // Возвращаем информацию о брони (включая bookingId / googleEventId, если они сохранены)
          return {
            bookingId: parsed.bookingId,
            googleEventId: parsed.googleEventId,
            date: parsed.date,
            time: parsed.time,
            contact: parsed.contact,
            startUtc: parsed.startUtc,
            endUtc: parsed.endUtc,
            isConfirmed: true,
          };
        }
      }
    } catch (error) {
      console.error('Ошибка при восстановлении данных из localStorage:', error);
    }
    return null;
  };

  // Состояние брони
  const [bookingInfo, setBookingInfo] = useState<any>(getBookingInfo);
  
  // Состояние формы (восстанавливаем из localStorage, если нет подтвержденной брони)
  const getInitialFormData = () => {
    if (typeof window === 'undefined') {
      return { date: '', time: '', contact: '', consentPersonal: false };
    }
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Восстанавливаем только если это НЕ подтвержденная бронь
        if (!parsed.isConfirmed) {
          return {
            date: parsed.date || '',
            time: parsed.time || '',
            contact: parsed.contact || '',
            consentPersonal: parsed.consentPersonal || false,
          };
        }
      }
    } catch (error) {
      console.error('Ошибка при восстановлении формы из localStorage:', error);
    }
    
    return { date: '', time: '', contact: '', consentPersonal: false };
  };
  
  const [formData, setFormData] = useState(getInitialFormData);

  const [errors, setErrors] = useState<any>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // UI состояние
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTimeList, setShowTimeList] = useState(false);
  
  const calendarRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);
  
  // Ref для отслеживания, был ли компонент уже смонтирован
  const isMountedRef = useRef(false);

  // Функция для загрузки слотов (вынесена для переиспользования)
  // Не добавляем formData.time в зависимости, используем функциональное обновление
  const loadAvailableSlots = useCallback(async (date: string, forceRefresh = false) => {
    if (!date) {
      setAvailableTimeSlots([]);
      return;
    }

    setLoadingSlots(true);
    
    try {
      // Определяем URL API в зависимости от окружения
      const apiUrl = typeof window !== 'undefined' && window.location.hostname === 'litebrick.ru'
        ? 'https://litebrick.ru/api/availability'
        : 'http://localhost:3001/api/availability';
      
      // Добавляем timestamp для предотвращения кеширования браузером
      // Если это принудительное обновление, добавляем дополнительный параметр
      const timestamp = Date.now();
      const refreshParam = forceRefresh ? `&_refresh=${timestamp}` : '';
      
      const response = await fetch(`${apiUrl}?date=${date}&_t=${timestamp}${refreshParam}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        cache: 'no-store', // Принудительно отключаем кеширование
      });
      
      const slots = await response.json();
      console.log('Получены слоты от API:', slots);
      const timeSlotsSet = new Set<string>();
      
      slots.forEach((slot: any) => {
        const startDate = new Date(slot.startUtc);
        
        // Самый надежный способ: получаем часы напрямую из московского времени
        const hourString = startDate.toLocaleString('ru-RU', {
          timeZone: 'Europe/Moscow',
          hour: '2-digit',
          hour12: false,
        });
        
        console.log('UTC:', slot.startUtc, '=> МСК час:', hourString);
        
        // Очищаем от всех нецифровых символов (пробелы, неразрывные пробелы и т.д.)
        const hours = hourString.replace(/\D/g, '').padStart(2, '0');
        const timeSlot = `${hours}:00`;
        
        console.log('Итоговый слот:', timeSlot);
        timeSlotsSet.add(timeSlot);
      });
      
      const uniqueTimeSlots = Array.from(timeSlotsSet).sort();
      console.log('Уникальные слоты после обработки:', uniqueTimeSlots);
      setAvailableTimeSlots(uniqueTimeSlots);
      
      // Проверяем, доступно ли выбранное время (используем функциональное обновление)
      setFormData(prev => {
        if (prev.time && !uniqueTimeSlots.includes(prev.time)) {
          console.warn('Выбранное время больше не доступно, очищаем:', prev.time);
          // Также очищаем из localStorage
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (!parsed.isConfirmed) {
                parsed.time = '';
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              }
            }
          } catch (error) {
            console.error('Ошибка при обновлении localStorage:', error);
          }
          return { ...prev, time: '' };
        }
        return prev;
      });
    } catch (error) {
      console.error('Ошибка загрузки слотов:', error);
      setAvailableTimeSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []); // Пустой массив зависимостей - функция не зависит от внешних переменных

  // Загрузка доступных слотов при изменении даты
  useEffect(() => {
    loadAvailableSlots(formData.date, false);
  }, [formData.date, loadAvailableSlots]);

  // Принудительное обновление слотов при монтировании компонента (если дата уже выбрана)
  useEffect(() => {
    // Выполняем только один раз при монтировании
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      
      // Очищаем старые слоты при монтировании, чтобы не показывать устаревшие данные
      setAvailableTimeSlots([]);
      
      // Получаем текущую дату из состояния (используем замыкание)
      const currentDate = formData.date;
      
      // Если дата уже выбрана (восстановлена из localStorage), принудительно обновляем слоты
      if (currentDate) {
        console.log('Компонент смонтирован, принудительно обновляем слоты для даты:', currentDate);
        // Небольшая задержка, чтобы убедиться, что компонент полностью инициализирован
        // и основной useEffect не перезапишет данные
        setTimeout(() => {
          loadAvailableSlots(currentDate, true);
        }, 150);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Пустой массив - выполняется только при монтировании

  // Автосохранение в localStorage с debounce 300ms
  const saveToLocalStorage = useCallback((data: any) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Ошибка при сохранении в localStorage:', error);
      }
    }, 300);
  }, []);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Закрытие попапов при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
      if (timeListRef.current && !timeListRef.current.contains(event.target as Node)) {
        setShowTimeList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };
      
      // Если изменилась дата, сбрасываем время
      if (name === 'date') {
        newData.time = '';
      }
      
      // Вычисляем endUtc для проверки прошедших броней
      let endUtc = null;
      if (newData.date && newData.time) {
        try {
          const startDate = new Date(`${newData.date}T${newData.time}:00+03:00`);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          endUtc = endDate.toISOString();
        } catch (error) {
          // Игнорируем ошибки парсинга даты
        }
      }
      
      // Сохраняем в localStorage с debounce (включая endUtc для проверки)
      const dataToSave = { ...newData };
      if (endUtc) {
        dataToSave.endUtc = endUtc;
      }
      saveToLocalStorage(dataToSave);
      
      return newData;
    });
    
    if (errors[name]) {
      setErrors((prev: any) => ({ ...prev, [name]: '' }));
    }
    
    // При любом изменении формы убираем предыдущий success
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  // Функция отмены брони
  const handleCancelBooking = async () => {
    if (!bookingInfo) {
      return;
    }

    if (!window.confirm('Вы уверены, что хотите отменить запись?')) {
      return;
    }

    try {
      // Определяем базовый URL API в зависимости от окружения
      const apiBase =
        typeof window !== 'undefined' && window.location.hostname === 'litebrick.ru'
          ? 'https://litebrick.ru/api/bookings'
          : 'http://localhost:3001/api/bookings';

      let bookingId = (bookingInfo as any).bookingId as string | undefined;

      // Фолбэк: если bookingId не сохранён (старые записи), пытаемся найти бронь по контакту
      if (!bookingId && (bookingInfo as any).contact) {
        try {
          const byContactResponse = await fetch(
            `${apiBase}/by-contact?contact=${encodeURIComponent((bookingInfo as any).contact)}`,
          );

          if (byContactResponse.ok) {
            const booking = await byContactResponse.json();
            bookingId = booking.id;
          } else {
            console.warn('Бронь по контакту не найдена при попытке отмены');
          }
        } catch (error) {
          console.error('Ошибка при попытке найти бронь по контакту:', error);
        }
      }

      // Если bookingId удалось получить — отправляем запрос на отмену в бэкенд
      if (bookingId) {
        try {
          const cancelResponse = await fetch(`${apiBase}/${bookingId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'CANCELLED' }),
          });

          if (!cancelResponse.ok) {
            const text = await cancelResponse.text();
            console.error('Ошибка при отмене брони на сервере:', cancelResponse.status, text);
          }
        } catch (error) {
          console.error('Сетевая ошибка при отмене брони на сервере:', error);
          // Даже если бэкенд недоступен, продолжаем локальную очистку, чтобы не блокировать пользователя
        }
      } else {
        console.warn(
          'Не удалось определить bookingId для отмены брони. Выполняем только локальную очистку.',
        );
      }
    } finally {
      // В любом случае очищаем локальное состояние, чтобы пользователь не видел устаревшую информацию
      localStorage.removeItem(STORAGE_KEY);
      setBookingInfo(null);
      setSuccessMessage('');
      setFormData({
        date: '',
        time: '',
        contact: '',
        consentPersonal: false,
      });
    }
  };

  // Валидация формы
  const validate = () => {
    const newErrors: any = {};
    
    if (!formData.date) {
      newErrors.date = 'Пожалуйста, выберите дату';
    }
    
    if (!formData.time) {
      newErrors.time = 'Пожалуйста, выберите время';
    }
    
    if (!formData.contact.trim()) {
      newErrors.contact = 'Пожалуйста, укажите контакт для связи';
    }
    
    if (!formData.consentPersonal) {
      newErrors.consentPersonal = 'Необходимо согласие на обработку персональных данных';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Не отправлять POST без consentPersonal: true
    if (!formData.consentPersonal) {
      setErrors((prev: any) => ({
        ...prev,
        consentPersonal: 'Необходимо согласие на обработку персональных данных',
      }));
      return;
    }
    
    // Сбрасываем предыдущую успешную надпись перед новой попыткой
    setSuccessMessage('');

    if (!validate()) {
      return;
    }

    // Создаем дату с явным указанием московского часового пояса (+03:00)
    const moscowTimeString = `${formData.date}T${formData.time}:00+03:00`;
    const startDate = new Date(moscowTimeString);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    setIsSubmitting(true);
    
    try {
      console.log('Выбранное пользователем время (МСК):', {
        date: formData.date,
        time: formData.time,
      });
      
      console.log('Время конвертировано в UTC для отправки:', {
        startUtc: startDate.toISOString(),
        endUtc: endDate.toISOString(),
      });
      
      // Подготовка данных для отправки на сервер (в UTC)
      const requestData = {
        date: formData.date,
        startUtc: startDate.toISOString(),
        endUtc: endDate.toISOString(),
        contactRaw: formData.contact,
        contactType: formData.contact.includes('@') ? 'EMAIL' : 'TELEGRAM',
        consentPersonal: formData.consentPersonal,
      };

      let response;
      try {
        // Определяем URL API в зависимости от окружения
        const apiUrl = typeof window !== 'undefined' && window.location.hostname === 'litebrick.ru'
          ? 'https://litebrick.ru/api/bookings'  // Продакшен
          : 'http://localhost:3001/api/bookings'; // Локальная разработка
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
      } catch (networkError) {
        console.error('Ошибка сети:', networkError);
        throw new Error('Не удалось подключиться к серверу. Убедитесь, что бэкенд запущен на порту 3001.');
      }

      let data;
      try {
        const text = await response.text();
        if (!text) {
          throw new Error('Пустой ответ от сервера');
        }
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Ошибка парсинга ответа:', parseError);
        console.error('Статус ответа:', response.status);
        throw new Error(`Ошибка сервера (${response.status}). Проверьте логи бэкенда для деталей.`);
      }

      if (!response.ok) {
        // Обработка ошибок 400 с error.fields
        if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR' && data.error?.fields) {
          const fieldErrors: any = {};
          Object.keys(data.error.fields).forEach(field => {
            let formField = field;
            if (field === 'contactRaw') formField = 'contact';
            else if (field === 'startUtc' || field === 'endUtc') formField = 'time';
            fieldErrors[formField] = data.error.fields[field];
          });
          setErrors(fieldErrors);
          return;
        }

        // Обработка конфликтов 409
        if (response.status === 409) {
          setErrors({
            time: 'Слот уже забронирован, выберите другой',
            date: data.error?.fields?.date || undefined,
          });
          return;
        }

        throw new Error(data.error?.message || 'Произошла ошибка при отправке формы');
      }
      
      // Успешная отправка
      // Сохраняем информацию о подтвержденной брони в localStorage
      // Бэкенд возвращает объект брони с полями id, googleEventId, startUtc, endUtc, date и т.д.
      const bookingFromServer = data;

      const confirmedBooking = {
        bookingId: bookingFromServer?.id,
        googleEventId: bookingFromServer?.googleEventId,
        date: formData.date,
        time: formData.time,
        contact: formData.contact,
        startUtc: startDate.toISOString(),
        endUtc: endDate.toISOString(),
        isConfirmed: true,
      };
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(confirmedBooking));
      } catch (error) {
        console.error('Ошибка при сохранении подтвержденной брони:', error);
      }
      
      // Обновляем состояние для отображения информации о брони
      setBookingInfo(confirmedBooking);
      
      // Очищаем форму и сообщения
      const emptyState = {
        date: '',
        time: '',
        contact: '',
        consentPersonal: false,
      };
      setFormData(emptyState);
      setErrors({});
      setSuccessMessage('');
    } catch (error: any) {
      console.error('Ошибка при отправке формы:', error);
      setErrors({
        _general: error.message || 'Произошла ошибка. Пожалуйста, попробуйте еще раз.',
      });
      setSuccessMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Форматирование даты
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Генерация дней месяца
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const selectedDate = new Date(year, date.getMonth(), date.getDate());
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate >= todayDate) {
      setFormData(prev => ({ ...prev, date: dateString }));
      setShowCalendar(false);
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const days = getDaysInMonth(currentMonth);
  
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  let selectedDate: Date | null = null;
  if (formData.date) {
    const [year, month, day] = formData.date.split('-').map(Number);
    selectedDate = new Date(year, month - 1, day);
    selectedDate.setHours(0, 0, 0, 0);
  }

  // Форматирование даты для отображения
  const formatBookingDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      weekday: 'long'
    });
  };

  // Если есть подтвержденная бронь - показываем информацию о записи
  if (bookingInfo) {
    return (
      <div className="section">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <h2 className="section__title" style={{ marginBottom: 0 }}>
            Ваша запись на консультацию
          </h2>
          <span
            className="section__marker section__marker--booking"
            style={{ fontFamily: 'var(--font-accent)', fontSize: '1.5rem', color: 'var(--color-primary)' }}
          >
            / 100%
          </span>
        </div>
        <p className="section__description section__description--booking">
          Мы ждем вас на консультации. Информация о встрече сохранена
        </p>

        <div style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, rgba(67, 113, 244, 0.12), rgba(0, 56, 131, 0.15))',
          border: '1px solid rgba(67, 113, 244, 0.4)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
              <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--color-white)',
            }}>
              Запись подтверждена
            </h3>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px', flexShrink: 0 }}>
                <path d="M6 2V4M14 2V4M3 8H17M4 4H16C16.5304 4 17.0391 4.21071 17.4142 4.58579C17.7893 4.96086 18 5.46957 18 6V16C18 16.5304 17.7893 17.0391 17.4142 17.4142C17.0391 17.7893 16.5304 18 16 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V6C2 5.46957 2.21071 4.96086 2.58579 4.58579C2.96086 4.21071 3.46957 4 4 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '0.25rem',
                }}>
                  Дата и время
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: 'var(--color-white)',
                  textTransform: 'capitalize',
                }}>
                  {formatBookingDate(bookingInfo.date)}, {bookingInfo.time}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px', flexShrink: 0 }}>
                <path d="M3 8L10 13L17 8M3 12L10 17L17 12M3 4L10 9L17 4L10 1L3 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '0.25rem',
                }}>
                  Контакт для связи
                </div>
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: 'var(--color-white)',
                }}>
                  {bookingInfo.contact}
                </div>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          }}>
            <button
              type="button"
              onClick={handleCancelBooking}
              className="btn"
              style={{
                width: '100%',
                padding: '0.875rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-white)',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              Отменить запись
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Если нет подтвержденной брони - показываем форму
  return (
    <div className="section">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <h2 className="section__title" style={{ marginBottom: 0 }}>
          Записаться на консультацию
        </h2>
        <span
          className="section__marker section__marker--booking"
          style={{ fontFamily: 'var(--font-accent)', fontSize: '1.5rem', color: 'var(--color-primary)' }}
        >
          / 100%
        </span>
      </div>
      <p className="section__description section__description--booking">
        Выберите удобное время для бесплатной консультации. Мы обсудим ваши задачи и возможности внедрения ИИ
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__group" style={{ position: 'relative' }} ref={calendarRef}>
          <label htmlFor="date-display" className="form__label">
            Дата <span style={{ color: 'var(--color-primary)' }}>*</span>
          </label>
          <div
            className="calendar-input"
            onClick={() => setShowCalendar(!showCalendar)}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${errors.date ? '#F97316' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: 'var(--radius-md)',
              color: formData.date ? 'var(--color-white)' : 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: errors.date ? '2px' : '1px',
            }}
          >
            <span>{formData.date ? formatDisplayDate(formData.date) : 'Выберите дату'}</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.7 }}>
              <path d="M6 2V4M14 2V4M3 8H17M4 4H16C16.5304 4 17.0391 4.21071 17.4142 4.58579C17.7893 4.96086 18 5.46957 18 6V16C18 16.5304 17.7893 17.0391 17.4142 17.4142C17.0391 17.7893 16.5304 18 16 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V6C2 5.46957 2.21071 4.96086 2.58579 4.58579C2.96086 4.21071 3.46957 4 4 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          {showCalendar && (
            <div className="calendar-popup" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '0.5rem',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              minWidth: '320px',
            }}>
              <div className="calendar-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateMonth(-1);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a' }}>
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateMonth(1);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.5rem' }}>
                {weekDays.map(day => (
                  <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#666', padding: '0.5rem 0' }}>
                    {day}
                  </div>
                ))}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                {days.map((dayObj, index) => {
                  const dayDate = dayObj.date;
                  const dayDateCompare = new Date(dayDate);
                  dayDateCompare.setHours(0, 0, 0, 0);
                  
                  const isToday = dayDateCompare.getTime() === todayDate.getTime();
                  const isSelected = selectedDate && dayDateCompare.getTime() === selectedDate.getTime();
                  const isPast = dayDateCompare < todayDate && !isToday;
                  const isOtherMonth = !dayObj.isCurrentMonth;
                  
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isPast) {
                          handleDateSelect(dayDate);
                        }
                      }}
                      disabled={isPast}
                      style={{
                        aspectRatio: '1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        cursor: isPast ? 'not-allowed' : 'pointer',
                        background: isSelected ? 'var(--color-primary)' : isToday ? 'rgba(67, 113, 244, 0.1)' : 'transparent',
                        border: 'none',
                        color: isSelected ? 'white' : isOtherMonth ? '#999' : '#1a1a1a',
                        opacity: isOtherMonth ? 0.4 : isPast ? 0.3 : 1,
                        fontWeight: isSelected || isToday ? 600 : 400,
                      }}
                    >
                      {dayDate.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {errors.date && <span className="form__error">{errors.date}</span>}
        </div>

        <div className="form__group" style={{ position: 'relative' }} ref={timeListRef}>
          <label htmlFor="time-display" className="form__label">
            Время <span style={{ color: 'var(--color-primary)' }}>*</span>
          </label>
          
          <div
            className="time-input"
            onClick={() => {
              if (formData.date && !loadingSlots && availableTimeSlots.length > 0) {
                setShowTimeList(!showTimeList);
              }
            }}
            onMouseEnter={(e) => {
              if (formData.date && !loadingSlots && availableTimeSlots.length > 0) {
                e.currentTarget.style.borderColor = 'rgba(67, 113, 244, 0.6)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!errors.time) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }
            }}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${errors.time ? '#F97316' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: 'var(--radius-md)',
              color: formData.time ? 'var(--color-white)' : 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              cursor: formData.date && !loadingSlots && availableTimeSlots.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: !formData.date || loadingSlots ? 0.6 : 1,
            }}
          >
            <span>
              {!formData.date 
                ? 'Сначала выберите дату' 
                : loadingSlots 
                  ? 'Загрузка...' 
                  : availableTimeSlots.length === 0 
                    ? 'Нет доступного времени' 
                    : formData.time || 'Выберите время'}
            </span>
            {/* Добавляем иконку часов */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.7 }}>
              <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 6V10L12.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          {showTimeList && formData.date && !loadingSlots && availableTimeSlots.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '0.5rem',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '12px',
              padding: '0.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              maxHeight: '300px',
              overflowY: 'auto',
            }}>
              {availableTimeSlots.map((timeSlot) => {
                const isSelected = formData.time === timeSlot;
                return (
                  <button
                    key={timeSlot}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, time: timeSlot }));
                      setShowTimeList(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      background: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.98)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'rgba(67, 113, 244, 0.3)'}`,
                      borderRadius: '8px',
                      color: isSelected ? 'white' : 'var(--color-primary)',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {timeSlot}
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Подсказка для пользователя */}
          {!formData.date && !errors.time && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: 'var(--font-body)',
            }}>
              💡 Выберите дату, чтобы увидеть доступное время
            </div>
          )}
          
          {formData.date && loadingSlots && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: 'var(--font-body)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round"/>
              </svg>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}}/>
              Загружаем доступное время...
            </div>
          )}
          
          {formData.date && !loadingSlots && availableTimeSlots.length === 0 && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: 'rgba(255, 165, 0, 0.9)',
              fontFamily: 'var(--font-body)',
            }}>
              ⚠️ На выбранную дату нет свободного времени. Попробуйте выбрать другую дату.
            </div>
          )}
          
          {formData.date && !loadingSlots && availableTimeSlots.length > 0 && !formData.time && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.875rem',
              color: 'rgba(67, 113, 244, 0.9)',
              fontFamily: 'var(--font-body)',
            }}>
              ✓ Доступно {availableTimeSlots.length} {availableTimeSlots.length === 1 ? 'слот' : availableTimeSlots.length < 5 ? 'слота' : 'слотов'} — нажмите, чтобы выбрать
            </div>
          )}
          
          {errors.time && <span className="form__error">{errors.time}</span>}
        </div>

        <div className="form__group">
          <label htmlFor="contact" className="form__label">
            Контакт (email / Telegram) <span style={{ color: 'var(--color-primary)' }}>*</span>
          </label>
          <input
            type="text"
            id="contact"
            name="contact"
            className="form__input"
            value={formData.contact}
            onChange={handleChange}
            placeholder="example@mail.com или @telegram"
            required
            style={{
              borderColor: errors.contact ? '#F97316' : undefined,
            }}
          />
          {errors.contact && <span className="form__error">{errors.contact}</span>}
        </div>

        <div className="form__checkbox-group">
          <input
            type="checkbox"
            id="consentPersonal"
            name="consentPersonal"
            className="form__checkbox"
            checked={formData.consentPersonal}
            onChange={handleChange}
            required
          />
          <label htmlFor="consentPersonal" className="form__checkbox-label">
            Я даю согласие на{' '}
            <a href="https://disk.yandex.ru/i/tZ7ac45-cGZGVA" target="_blank" rel="noopener noreferrer">
              обработку персональных данных
            </a>
            <span style={{ color: 'var(--color-primary)' }}> *</span>
          </label>
        </div>
        {errors.consentPersonal && <span className="form__error">{errors.consentPersonal}</span>}

        {errors._general && (
          <div style={{ 
            color: '#F97316', 
            marginTop: '1rem', 
            padding: '0.75rem', 
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            borderRadius: '4px',
          }}>
            {errors._general}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              marginTop: errors._general ? '0.75rem' : '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              background:
                'linear-gradient(135deg, rgba(67, 113, 244, 0.14), rgba(0, 56, 131, 0.18))',
              border: '1px solid rgba(67, 113, 244, 0.6)',
              color: 'rgba(255, 255, 255, 0.9)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            }}
          >
            {successMessage}
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn--primary btn--full" 
          style={{ marginTop: '1.5rem' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Отправка...' : 'Записаться на консультацию'}
        </button>
      </form>
    </div>
  );
}

