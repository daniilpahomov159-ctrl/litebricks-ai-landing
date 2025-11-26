import React, { useState, useRef } from 'react';

const Preparation = () => {
  const [selectedStep, setSelectedStep] = useState(0);
  const detailRef = useRef(null);
  const flowTopRef = useRef(null); // верх контура таблиц/грида
  const [bookingId, setBookingId] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const steps = [
    {
      title: 'Первичная консультация',
      description: 'Знакомимся с вашими задачами и целями',
      details: 'Проводим полный аудит всех бизнес-процессов, создаем их визуальную карту и выявляем точки для оптимизации с помощью ИИ. Определяем приоритеты и последовательность внедрения решений.',
      duration: '1-2 недели',
      outcome: 'Детальная карта процессов с приоритетами внедрения',
    },
    {
      title: 'Сбор данных',
      description: 'Полный учет и оценка качества всех доступных данных',
      details: 'Проводим инвентаризацию всех данных компании: структурированных и неструктурированных. Оцениваем качество, объем и доступность данных для обучения моделей. Разрабатываем план по улучшению качества данных.',
      duration: '2-3 недели',
      outcome: 'Полный отчет о данных с планом улучшения',
    },
    {
      title: 'Диагностика процессов',
      description: 'Анализируем ваш бизнес и определяем наиболее эффективные области для внедрения ИИ-решений',
      details: 'Разрабатываем политику безопасности данных, настраиваем систему контроля доступа и обеспечиваем соответствие требованиям защиты персональных данных. Внедряем механизмы аудита и мониторинга.',
      duration: '1-2 недели',
      outcome: 'Настроенная система безопасности и контроля доступа',
    },
    {
      title: 'Разработка ИИ-решения',
      description: 'Подготовка технической базы для внедрения ИИ-решений',
      details: 'Оцениваем текущую техническую инфраструктуру и определяем необходимые изменения для поддержки ИИ-решений. Планируем масштабирование, облачные решения и интеграцию с существующими системами.',
      duration: '2-4 недели',
      outcome: 'План технической инфраструктуры и рекомендации',
    },
    {
      title: 'Обучение команды',
      description: 'Подготовка сотрудников к работе с ИИ-инструментами',
      details: 'Разрабатываем программу обучения для сотрудников, которые будут работать с ИИ-решениями. Создаем инструкции, проводим тренинги и обеспечиваем поддержку на этапе адаптации.',
      duration: '1-2 недели',
      outcome: 'Обученная команда, готовая к работе с ИИ',
    },
    {
      title: 'Внедрение и тестирование',
      description: 'Запуск пилотного проекта для проверки эффективности',
      details: 'Выбираем один процесс для пилотного внедрения ИИ-решения. Тестируем работу системы, собираем метрики эффективности и обратную связь. Оптимизируем решение перед масштабированием.',
      duration: '2-4 недели',
      outcome: 'Протестированное решение с метриками эффективности',
    },
  ];

  const currentStep = steps[selectedStep];

  const handleStepClick = (index) => {
    setSelectedStep(index);
    // Прокручиваем к началу контура таблиц (верх грида) после перерисовки
    // Делаем через rAF, чтобы попасть после обновления DOM (особенно на крайних шагах)
    requestAnimationFrame(() => {
      if (flowTopRef.current) {
        const rect = flowTopRef.current.getBoundingClientRect();
        const offset = 80; // компенсация фиксированного хедера
        const targetY = window.pageYOffset + rect.top - offset;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    });
  };

  const handlePrev = () => {
    if (selectedStep > 0) {
      handleStepClick(selectedStep - 1);
    }
  };

  const handleNext = () => {
    if (selectedStep < steps.length - 1) {
      handleStepClick(selectedStep + 1);
    }
  };

  // Проверка записи по ID или контакту
  const handleCheckBooking = async (e) => {
    e.preventDefault();
    
    if (!bookingId.trim()) {
      setError('Пожалуйста, введите ID записи или контакт (email/telegram)');
      return;
    }

    setLoading(true);
    setError(null);
    setBooking(null);

    try {
      // Сначала пробуем найти по ID
      let response = await fetch(`/api/bookings/${bookingId.trim()}`);
      
      // Если не найдено по ID, пробуем найти по контакту
      if (!response.ok && response.status === 404) {
        response = await fetch(`/api/bookings/by-contact?contact=${encodeURIComponent(bookingId.trim())}`);
      }

      if (!response.ok) {
        if (response.status === 404) {
          setError('Запись не найдена. Проверьте правильность введённых данных.');
        } else {
          const data = await response.json();
          setError(data.error?.message || 'Ошибка при поиске записи');
        }
        return;
      }

      const bookingData = await response.json();
      setBooking(bookingData);
    } catch (err) {
      console.error('Ошибка при проверке записи:', err);
      setError('Не удалось подключиться к серверу. Проверьте, что бэкенд запущен.');
    } finally {
      setLoading(false);
    }
  };

  // ===== ОТОБРАЖЕНИЕ ВРЕМЕНИ В МОСКОВСКОМ ЧАСОВОМ ПОЯСЕ (UTC+3) =====
  // Форматирование даты и времени для отображения пользователю
  const formatDateTime = (dateString) => {
    // 1. Получаем время из БД в UTC (например: 2025-11-15T07:00:00.000Z)
    // 2. Конвертируем в московское время для отображения: 15 ноября 2025 г., 10:00
    const date = new Date(dateString);
    
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow', // Явная конвертация в московское время (UTC+3)
    });
  };

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="section__title" style={{ marginBottom: 0 }}>Подготовка бизнеса к ИИ</h2>
        <span style={{ fontFamily: 'var(--font-accent)', fontSize: '1.5rem', color: 'var(--color-primary)' }}>/ 01</span>
      </div>
      
      <p className="section__description">
        Успешное внедрение ИИ начинается с правильной подготовки. Мы помогаем заложить фундамент, 
        который обеспечит максимальную эффективность и безопасность будущих решений.
      </p>

      {/* Форма проверки записи */}
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1.5rem', 
        backgroundColor: 'rgba(249, 115, 22, 0.05)', 
        borderRadius: '8px',
        border: '1px solid rgba(249, 115, 22, 0.2)'
      }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
          Проверить мою запись
        </h3>
        <form onSubmit={handleCheckBooking} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input
            type="text"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Введите ID записи или контакт (email/telegram)"
            style={{
              flex: '1',
              minWidth: '250px',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Поиск...' : 'Проверить'}
          </button>
        </form>

        {error && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            color: '#dc2626',
            borderRadius: '4px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        {booking && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1.5rem', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{ 
              marginBottom: '1rem', 
              fontSize: '1.125rem', 
              fontWeight: 600,
              color: '#16a34a'
            }}>
              ✓ Ваша запись найдена
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#666' }}>
                    Дата и время:
                  </strong>
                  <span>{formatDateTime(booking.startUtc)}</span>
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#666' }}>
                    Статус:
                  </strong>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '4px',
                    backgroundColor: booking.status === 'CONFIRMED' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: booking.status === 'CONFIRMED' ? '#16a34a' : '#dc2626',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}>
                    {booking.status === 'CONFIRMED' ? 'Подтверждена' : 'Отменена'}
                  </span>
                </div>
              </div>
              {booking.contactRaw && (
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#666' }}>
                    Контакт:
                  </strong>
                  <span>{booking.contactRaw}</span>
                </div>
              )}
              {booking.id && (
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#666' }}>
                    ID записи:
                  </strong>
                  <span style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.875rem',
                    color: '#666'
                  }}>
                    {booking.id}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="preparation-flow" ref={flowTopRef}>
        <div className="preparation-flow__left">
          <div className="preparation-flowchart">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <button
                  className={`preparation-step ${selectedStep === index ? 'preparation-step--active' : ''}`}
                  onClick={() => handleStepClick(index)}
                >
                  {step.title}
                </button>
                {index < steps.length - 1 && (
                  <div className="preparation-step__connector"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="preparation-flow__right">
          <div ref={detailRef} className="preparation-detail">
            <div key={selectedStep} className="preparation-detail__content">
              <h3 className="preparation-detail__title">{currentStep.title}</h3>
              <p className="preparation-detail__description">{currentStep.description}</p>
              
              <div className="preparation-detail__info">
                <div className="preparation-detail__info-item">
                  <span className="preparation-detail__info-label">Детали:</span>
                  <span className="preparation-detail__info-value">{currentStep.details}</span>
                </div>
                <div className="preparation-detail__info-item">
                  <span className="preparation-detail__info-label">Сроки:</span>
                  <span className="preparation-detail__info-value">{currentStep.duration}</span>
                </div>
                <div className="preparation-detail__info-item">
                  <span className="preparation-detail__info-label">Результат:</span>
                  <span className="preparation-detail__info-value">{currentStep.outcome}</span>
                </div>
              </div>
            </div>
            <div className="preparation-detail__footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <button
                type="button"
                className="preparation-nav__btn preparation-nav__btn--prev"
                onClick={handlePrev}
                disabled={selectedStep === 0}
              >
                ← Назад
              </button>
              <button
                type="button"
                className="preparation-nav__btn preparation-nav__btn--next"
                onClick={handleNext}
                disabled={selectedStep === steps.length - 1}
              >
                Вперёд →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preparation;
