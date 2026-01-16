import React, { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'auditForm:v1';

const AuditForm = () => {
  // Скролл к секции с учётом фиксированного header —
  // используем ту же логику, что и в Header/Hero,
  // чтобы поведение было предсказуемым.
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (!element) return;

    const headerHeight = 60;
    const additionalOffset = sectionId === 'about' ? 100 : 15;
    const totalOffset = headerHeight + additionalOffset;

    const elementTop = element.offsetTop;
    const scrollPosition = elementTop - totalOffset;

    window.scrollTo({
      top: scrollPosition,
      behavior: 'smooth',
    });
  };

  // Восстановление состояния из localStorage при монтировании
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          // Поля формы будут добавлены позже
          // Пока сохраняем базовую структуру
          ...parsed,
          consentPersonal: parsed.consentPersonal || false,
          marketingConsent: parsed.marketingConsent || false,
        };
      }
    } catch (error) {
      console.error('Ошибка при восстановлении данных из localStorage:', error);
    }
    return {
      consentPersonal: false,
      marketingConsent: false,
    };
  };

  const [formData, setFormData] = useState(getInitialState);
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

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleCalendarClick = () => {
    // При клике ведём пользователя сразу к блоку записи на консультацию,
    // так же, как и из Hero (секция booking).
    scrollToSection('booking');
  };

  // Функция для очистки localStorage при успешной отправке формы
  const clearFormData = useCallback(() => {
    setFormData({
      consentPersonal: false,
      marketingConsent: false,
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <div className="section">
      <div className="audit-banner audit-banner--dark">
        <div className="audit-banner__content">
          <h2 className="audit-banner__title">
            Встреча-знакомство + AI-аудит
          </h2>
          <p className="audit-banner__text">
            Давайте познакомимся, разберем ваш бизнес и обсудим план, который поможет вам автоматизировать процессы и получить желаемый результат.
          </p>
        </div>
        <div className="audit-banner__action">
          <button 
            type="button" 
            className="btn btn--calendar"
            onClick={handleCalendarClick}
          >
            <svg 
              className="btn__calendar-icon" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <span>Выбрать время</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditForm;
