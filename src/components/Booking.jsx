import React, { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'bookingForm:v1';

const Booking = () => {
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
          
          // Возвращаем информацию о брони
          return {
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

  // Восстановление состояния формы (для незавершенного заполнения)
  const getInitialFormState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Если это подтвержденная бронь - не восстанавливаем форму
        if (parsed.isConfirmed) {
          return {
            date: '',
            time: '',
            contact: '',
            consentPersonal: false,
          };
        }
        
        // Возвращаем только поля формы
        return {
          date: parsed.date || '',
          time: parsed.time || '',
          contact: parsed.contact || '',
          consentPersonal: parsed.consentPersonal || false,
        };
      }
    } catch (error) {
      console.error('Ошибка при восстановлении данных из localStorage:', error);
    }
    return {
      date: '',
      time: '',
      contact: '',
      consentPersonal: false,
    };
  };

  const [bookingInfo, setBookingInfo] = useState(getBookingInfo);
  const [formData, setFormData] = useState(getInitialFormState);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  // Слоты времени (только свободные, возвращаются с API)
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const debounceTimerRef = useRef(null);

  // Автосохранение в localStorage с debounce 300ms
  const saveToLocalStorage = useCallback((data) => {
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

  const handleChange = (e) => {
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
          const startDate = new Date(`${newData.date}T${newData.time}:00`);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +60 минут (1 час)
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
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    // При любом изменении формы убираем предыдущий success, чтобы не сбивать пользователя
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  // Загрузка свободных слотов времени из API
  useEffect(() => {
    const loadAvailableSlots = async () => {
      if (!formData.date) {
        setAvailableTimeSlots([]);
        // Сбрасываем выбранное время, если дата не выбрана
        if (formData.time) {
          setFormData(prev => ({ ...prev, time: '' }));
        }
        return;
      }

      setLoadingSlots(true);
      try {
        const response = await fetch(`/api/availability?date=${formData.date}`);
        if (!response.ok) {
          throw new Error('Ошибка при загрузке доступных слотов');
        }
        
        const slots = await response.json();
        
        // Преобразуем слоты из формата API (startUtc, endUtc) в формат времени для отображения
        console.log('Получены слоты от API:', slots);
        const timeSlotsSet = new Set();
        
        slots.forEach(slot => {
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
        
        // Преобразуем Set в отсортированный массив
        const uniqueTimeSlots = Array.from(timeSlotsSet).sort();
        console.log('Уникальные слоты после обработки:', uniqueTimeSlots);
        setAvailableTimeSlots(uniqueTimeSlots);
        
        // Если выбранное время больше не доступно, сбрасываем его
        if (formData.time && !uniqueTimeSlots.includes(formData.time)) {
          setFormData(prev => ({ ...prev, time: '' }));
        }
      } catch (error) {
        console.error('Ошибка при загрузке доступных слотов:', error);
        setAvailableTimeSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    loadAvailableSlots();
  }, [formData.date]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const validate = () => {
    const newErrors = {};
    
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Не отправлять POST без consentPersonal: true
    if (!formData.consentPersonal) {
      setErrors(prev => ({
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
    // Объявляем переменные ДО try блока, чтобы они были доступны после успешной отправки
    const moscowTimeString = `${formData.date}T${formData.time}:00+03:00`;
    const startDate = new Date(moscowTimeString);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +60 минут (1 час)
    
    try {
      // ===== РАБОТА С ВРЕМЕНЕМ В МОСКОВСКОМ ЧАСОВОМ ПОЯСЕ (UTC+3) =====
      // 1. Пользователь выбирает время в московском часовом поясе (например: 10:00)
      // 2. Создаем ISO строку с явным указанием UTC+3: 2025-11-15T10:00:00+03:00
      // 3. Конвертируем в UTC для отправки на сервер: 2025-11-15T07:00:00.000Z
      // 4. Сервер сохраняет в БД в UTC (стандарт PostgreSQL)
      // 5. При отображении конвертируем обратно в московское время
      
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
        date: formData.date, // Дата (YYYY-MM-DD)
        startUtc: startDate.toISOString(), // Время начала в UTC (10:00 МСК → 07:00 UTC)
        endUtc: endDate.toISOString(), // Время окончания в UTC (11:00 МСК → 08:00 UTC)
        contactRaw: formData.contact,
        contactType: formData.contact.includes('@') ? 'EMAIL' : 'TELEGRAM',
        consentPersonal: formData.consentPersonal,
      };

      let response;
      try {
        response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
      } catch (networkError) {
        // Ошибка сети (сервер не запущен или недоступен)
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
        // Если ответ не JSON (например, HTML страница ошибки или пустой ответ)
        console.error('Ошибка парсинга ответа:', parseError);
        console.error('Статус ответа:', response.status);
        console.error('Заголовки ответа:', response.headers);
        throw new Error(`Ошибка сервера (${response.status}). Проверьте логи бэкенда для деталей.`);
      }

      if (!response.ok) {
        // Обработка ошибок 400 с error.fields
        if (response.status === 400 && data.error?.code === 'VALIDATION_ERROR' && data.error?.fields) {
          const fieldErrors = {};
          Object.keys(data.error.fields).forEach(field => {
            // Маппинг полей API на поля формы
            let formField = field;
            if (field === 'contactRaw') formField = 'contact';
            else if (field === 'startUtc' || field === 'endUtc') formField = 'time';
            // date, consentPersonal остаются как есть
            fieldErrors[formField] = data.error.fields[field];
          });
          setErrors(fieldErrors);
          return;
        }

        // Обработка конфликтов 409
        if (response.status === 409) {
          setErrors({
            time: 'Слот уже забронирован, выберите другой',
            date: data.error?.fields?.date || undefined, // Если есть ошибка по дате
          });
          return;
        }

        // Другие ошибки
        throw new Error(data.error?.message || 'Произошла ошибка при отправке формы');
      }
      
      // Успешная отправка
      // Сохраняем информацию о подтвержденной брони в localStorage
      const confirmedBooking = {
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
      setSuccessMessage(''); // Очищаем сообщение, так как теперь показываем карточку
    } catch (error) {
      console.error('Ошибка при отправке формы:', error);
      setErrors({
        _general: error.message || 'Произошла ошибка. Пожалуйста, попробуйте еще раз.',
      });
      setSuccessMessage('');
    }
  };

  // Минимальная дата - сегодня
  const today = new Date().toISOString().split('T')[0];
  
  // Состояние для календаря Windows 11
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef(null);
  
  // Состояние для выбора времени
  const [showTimeList, setShowTimeList] = useState(false);
  const [isTimeHovered, setIsTimeHovered] = useState(false);
  const [isTimeListHovered, setIsTimeListHovered] = useState(false);
  const timeListRef = useRef(null);

  // Закрытие календаря при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
      if (timeListRef.current && !timeListRef.current.contains(event.target)) {
        setShowTimeList(false);
      }
    };

    if (showCalendar || showTimeList) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar, showTimeList]);

  // Форматирование даты для отображения
  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    // Парсим дату напрямую из строки YYYY-MM-DD, чтобы избежать проблем с часовыми поясами
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Генерация дней месяца
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Дни предыдущего месяца
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }
    
    // Дни текущего месяца
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Дни следующего месяца для заполнения сетки
    const remainingDays = 42 - days.length; // 6 недель * 7 дней
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  // Функция отмены брони
  const handleCancelBooking = () => {
    if (window.confirm('Вы уверены, что хотите отменить запись?')) {
      // Очищаем localStorage
      localStorage.removeItem(STORAGE_KEY);
      // Сбрасываем состояние
      setBookingInfo(null);
      setSuccessMessage('');
      // Показываем форму снова
      const emptyState = {
        date: '',
        time: '',
        contact: '',
        consentPersonal: false,
      };
      setFormData(emptyState);
    }
  };

  const handleDateSelect = (date) => {
    // Формируем строку даты напрямую из компонентов, избегая проблем с часовыми поясами
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Сравниваем даты без учета времени
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const selectedDate = new Date(year, date.getMonth(), date.getDate());
    selectedDate.setHours(0, 0, 0, 0);
    
    // Проверяем, что выбранная дата не в прошлом
    if (selectedDate >= todayDate) {
      setFormData(prev => ({ ...prev, date: dateString }));
      setShowCalendar(false);
    }
  };

  const navigateMonth = (direction) => {
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
  
  // Создаем дату для сравнения без учета времени
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  // Парсим выбранную дату из строки YYYY-MM-DD
  let selectedDate = null;
  if (formData.date) {
    const [year, month, day] = formData.date.split('-').map(Number);
    selectedDate = new Date(year, month - 1, day);
    selectedDate.setHours(0, 0, 0, 0);
  }

  // Форматирование даты и времени для отображения информации о брони
  const formatBookingDate = (dateString) => {
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
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
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <h2 className="section__title" style={{ marginBottom: 0 }}>
          Записаться на консультацию
        </h2>
        {/* Маркер секции: /100% — в том же стиле, что / start и / FAQ.
            Отображается только на десктопе (на мобильных скрываем через CSS). */}
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
          <label htmlFor="date" className="form__label">
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
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              zIndex: 1000,
              minWidth: '320px',
              animation: 'calendarFadeIn 0.2s ease-out',
            }}>
              <style>{`
                @keyframes calendarFadeIn {
                  from {
                    opacity: 0;
                    transform: translateY(-10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                .calendar-header {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  margin-bottom: 1rem;
                  padding-bottom: 0.75rem;
                  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                }
                .calendar-nav-btn {
                  background: transparent;
                  border: none;
                  width: 32px;
                  height: 32px;
                  border-radius: 6px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  transition: all 150ms ease;
                  color: #1a1a1a;
                }
                .calendar-nav-btn:hover {
                  background: rgba(0, 0, 0, 0.05);
                }
                .calendar-month {
                  font-family: var(--font-body);
                  font-size: 0.95rem;
                  font-weight: 600;
                  color: #1a1a1a;
                }
                .calendar-weekdays {
                  display: grid;
                  grid-template-columns: repeat(7, 1fr);
                  gap: 0.25rem;
                  margin-bottom: 0.5rem;
                }
                .calendar-weekday {
                  text-align: center;
                  font-family: var(--font-body);
                  font-size: 0.75rem;
                  font-weight: 600;
                  color: #666;
                  padding: 0.5rem 0;
                }
                .calendar-days {
                  display: grid;
                  grid-template-columns: repeat(7, 1fr);
                  gap: 0.25rem;
                }
                .calendar-day {
                  aspect-ratio: 1;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 6px;
                  font-family: var(--font-body);
                  font-size: 0.875rem;
                  cursor: pointer;
                  transition: all 150ms ease;
                  background: transparent;
                  border: none;
                  color: #1a1a1a;
                }
                .calendar-day--other-month {
                  color: #999;
                  opacity: 0.4;
                }
                .calendar-day--today {
                  background: rgba(67, 113, 244, 0.1);
                  color: var(--color-primary);
                  font-weight: 600;
                }
                .calendar-day--selected {
                  background: var(--color-primary);
                  color: white;
                  font-weight: 600;
                }
                .calendar-day--disabled {
                  opacity: 0.3;
                  cursor: not-allowed;
                }
                .calendar-day:not(.calendar-day--disabled):not(.calendar-day--selected):hover {
                  background: rgba(67, 113, 244, 0.1);
                }
              `}</style>
              
              <div className="calendar-header">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateMonth(-1);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="calendar-month">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </div>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateMonth(1);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              
              <div className="calendar-weekdays">
                {weekDays.map(day => (
                  <div key={day} className="calendar-weekday">{day}</div>
                ))}
              </div>
              
              <div className="calendar-days">
                {days.map((dayObj, index) => {
                  const dayDate = dayObj.date;
                  // Создаем копию даты для сравнения без времени
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
                      className={`calendar-day ${
                        isOtherMonth ? 'calendar-day--other-month' : ''
                      } ${isToday ? 'calendar-day--today' : ''} ${
                        isSelected ? 'calendar-day--selected' : ''
                      } ${isPast ? 'calendar-day--disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isPast) {
                          handleDateSelect(dayDate);
                        }
                      }}
                      disabled={isPast}
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
          <label htmlFor="time" className="form__label">
            Время <span style={{ color: 'var(--color-primary)' }}>*</span>
          </label>
          
          <div
            className="time-input"
            onClick={() => {
              if (formData.date && !loadingSlots && availableTimeSlots.length > 0) {
                setShowTimeList(!showTimeList);
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
              borderWidth: errors.time ? '2px' : '1px',
              opacity: !formData.date || loadingSlots ? 0.6 : 1,
            }}
            onMouseEnter={() => setIsTimeHovered(true)}
            onMouseLeave={() => setIsTimeHovered(false)}
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
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 20 20" 
              fill="none" 
              style={{ 
                opacity: 0.7,
                animation: (loadingSlots || ((isTimeHovered || isTimeListHovered) && !formData.time)) ? 'rotateIcon 2s linear infinite' : 'none',
                transition: 'animation 0.3s ease',
              }}
            >
              <style>{`
                @keyframes rotateIcon {
                  from {
                    transform: rotate(0deg);
                  }
                  to {
                    transform: rotate(360deg);
                  }
                }
              `}</style>
              <path d="M10 2V6M10 14V18M2 10H6M14 10H18M4.343 4.343L7.172 7.172M12.828 12.828L15.657 15.657M4.343 15.657L7.172 12.828M12.828 7.172L15.657 4.343" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          
          {showTimeList && formData.date && !loadingSlots && availableTimeSlots.length > 0 && (
            <div 
              className="time-list-popup" 
              onMouseEnter={() => setIsTimeListHovered(true)}
              onMouseLeave={() => setIsTimeListHovered(false)}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.5rem',
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(20px)',
                borderRadius: '12px',
                padding: '0.5rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                zIndex: 1000,
                maxHeight: '300px',
                overflowY: 'auto',
                animation: 'calendarFadeIn 0.2s ease-out',
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
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
                        if (errors.time) {
                          setErrors(prev => ({ ...prev, time: '' }));
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.875rem 1rem',
                        background: isSelected ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.98)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'rgba(67, 113, 244, 0.3)'}`,
                        borderRadius: '8px',
                        color: isSelected ? 'var(--color-white)' : 'var(--color-primary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '1rem',
                        fontWeight: isSelected ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        textAlign: 'center',
                        boxShadow: isSelected ? '0 2px 8px rgba(67, 113, 244, 0.3)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.target.style.background = 'rgba(67, 113, 244, 0.1)';
                          e.target.style.borderColor = 'var(--color-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.98)';
                          e.target.style.borderColor = 'rgba(67, 113, 244, 0.3)';
                        }
                      }}
                    >
                      {timeSlot}
                    </button>
                  );
                })}
              </div>
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
            style={{
              borderColor: errors.contact ? '#F97316' : undefined,
              borderWidth: errors.contact ? '2px' : undefined,
            }}
          />
          {errors.contact && <span className="form__error">{errors.contact}</span>}
        </div>

        <div className="form__checkbox-group" style={{
          border: errors.consentPersonal ? '2px solid #F97316' : undefined,
          borderRadius: errors.consentPersonal ? '4px' : undefined,
          padding: errors.consentPersonal ? '0.5rem' : undefined,
        }}>
          <input
            type="checkbox"
            id="consentPersonal"
            name="consentPersonal"
            className="form__checkbox"
            checked={formData.consentPersonal}
            onChange={handleChange}
          />
          <label htmlFor="consentPersonal" className="form__checkbox-label" style={{
            color: errors.consentPersonal ? '#F97316' : undefined,
          }}>
            Я даю согласие на{' '}
            <a href="https://disk.yandex.ru/i/tZ7ac45-cGZGVA" target="_blank" rel="noopener noreferrer">
              обработку персональных данных
            </a>
            {' '}и ознакомлен(а) с{' '}
            <a href="https://disk.yandex.ru/d/YyMkaf2X3p0F_A" target="_blank" rel="noopener noreferrer">
              Политикой конфиденциальности
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
            border: '1px solid #F97316'
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
              // Нежный синий информер в фирменных цветах
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

        <button type="submit" className="btn btn--primary btn--full" style={{ marginTop: '1.5rem' }}>
          Записаться на консультацию
        </button>
      </form>
    </div>
  );
};

export default Booking;

