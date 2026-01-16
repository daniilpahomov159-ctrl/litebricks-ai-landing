import React, { useState, useRef } from 'react';

const Preparation = () => {
  const [selectedStep, setSelectedStep] = useState(0);
  const detailRef = useRef(null);
  const flowTopRef = useRef(null); // верх контура таблиц/грида
  
  const steps = [
    {
      title: 'Первичная консультация',
      description: 'Знакомимся с вашими задачами и целями.',
      details: 'Проводим полный аудит всех бизнес-процессов, создаем их визуальную карту и выявляем точки для оптимизации с помощью ИИ. Определяем приоритеты и последовательность внедрения решений.',
      outcome: 'Детальная карта процессов с приоритетами внедрения.',
    },
    {
      title: 'Сбор данных',
      description: 'Полный учет и оценка качества всех доступных данных.',
      details: 'Проводим инвентаризацию всех данных компании: структурированных и неструктурированных. Оцениваем качество, объем и доступность данных для обучения моделей. Разрабатываем план по улучшению качества данных.',
      outcome: 'Полный отчет о данных с планом улучшения.',
    },
    {
      title: 'Диагностика процессов',
      description: 'Анализируем ваш бизнес и определяем наиболее эффективные области для внедрения ИИ-решений.',
      details: 'Разрабатываем политику безопасности данных, настраиваем систему контроля доступа и обеспечиваем соответствие требованиям защиты персональных данных. Подбираем оптимальный способ внедрения системы в текущие процессы вашего бизнеса.',
      outcome: 'Настроенная система безопасности и контроль доступа.',
    },
    {
      title: 'Разработка ИИ-решения',
      description: 'Подготовка технической базы для внедрения ИИ-решений.',
      details: 'Оцениваем текущую техническую инфраструктуру и определяем необходимые изменения для поддержки ИИ-решений. Планируем масштабирование, облачные решения и интеграцию с существующими системами.',
      outcome: 'План технической инфраструктуры и рекомендации.',
    },
    {
      title: 'Обучение команды',
      description: 'Подготовка сотрудников к работе с ИИ-инструментами',
      details: 'Разрабатываем программу обучения для сотрудников, которые будут работать с ИИ-решениями. Создаем инструкции, проводим тренинги и обеспечиваем поддержку на этапе адаптации.',
      outcome: 'Обученная команда, готовая к работе с ИИ',
    },
    {
      title: 'Внедрение и тестирование',
      description: 'Запуск пилотного проекта для проверки эффективности',
      details: 'Выбираем один процесс для пилотного внедрения ИИ-решения. Тестируем работу системы, собираем метрики эффективности и обратную связь. Оптимизируем решение перед масштабированием.',
      outcome: 'Протестированное решение с метриками эффективности',
    },
  ];

  const currentStep = steps[selectedStep];

  const handleStepClick = (index) => {
    setSelectedStep(index);

    // На мобильных важно, чтобы пользователь после выбора шага
    // оказывался в начале описания (белый блок справа),
    // а не возвращался к списку шагов / другим секциям страницы.
    // Делаем плавный скролл к detailRef после обновления DOM.
    requestAnimationFrame(() => {
      const targetEl = detailRef.current || flowTopRef.current;
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
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

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="section__title" style={{ marginBottom: 0 }}>Подготовка бизнеса</h2>
        {/* Маркер шага: вместо числового индекса используем понятное обозначение /start.
            Дополнительный класс позволяет скрывать элемент на мобильных, сохраняя его на десктопе. */}
        <span
          className="section__marker section__marker--preparation"
          style={{ fontFamily: 'var(--font-accent)', fontSize: '1.5rem', color: 'var(--color-primary)' }}
        >
          / start
        </span>
      </div>
      
      <p className="section__description section__description--preparation">
        Успешное внедрение искусственного интеллекта начинается с правильной подготовки. Мы помогаем заложить фундамент, 
        который обеспечит максимальную эффективность и безопасность будущих решений.
      </p>

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
                {/* Разделяем стрелку и подпись, чтобы на мобильных
                    можно было скрыть текст и оставить только иконку. */}
                <span className="preparation-nav__icon">←</span>
                <span className="preparation-nav__label">Назад</span>
              </button>
              <button
                type="button"
                className="preparation-nav__btn preparation-nav__btn--next"
                onClick={handleNext}
                disabled={selectedStep === steps.length - 1}
              >
                <span className="preparation-nav__icon">→</span>
                <span className="preparation-nav__label">Вперёд</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preparation;
