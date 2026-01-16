import React from 'react';

const Hero = () => {
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // Используем ту же логику смещения, что и в Header,
      // чтобы поведение совпадало с кликом по пункту «Консультация».
      const headerHeight = 60;
      const additionalOffset = sectionId === 'about' ? 100 : 15;
      const totalOffset = headerHeight + additionalOffset;

      const elementTop = element.offsetTop;
      const scrollPosition = elementTop - totalOffset;

      window.scrollTo({
        top: scrollPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    // Внешняя обертка без отступов, чтобы блок занял весь экран
    // Используем фиксированную минимальную высоту для предотвращения CLS
    <div
      className="section section--hero"
      style={{
        margin: 0,
        padding: 0,
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
        minHeight: '660px', // Фиксированная высота вместо calc(100vh - 60px)
      }}
    >
      {/* Основной слой: 100% по ширине, фиксированная высота для предотвращения CLS */}
      <div
        className="hero"
        style={{
          minHeight: '660px', // Фиксированная высота вместо 100vh
          width: '100%',
          maxWidth: '100%',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
          /* Аппаратное ускорение для плавной отрисовки */
          willChange: 'auto',
          transform: 'translateZ(0)',
        }}
      >
        {/* Диагональные лучи и лёгкие фигуры */}
        <div
          className="hero__shapes"
          aria-hidden="true"
          style={{
            filter: 'brightness(1.05)',
            // Убрали общий трансформ, чтобы управлять каждой фигурой отдельно
          }}
        >
          {/* Каждая фигура со своим масштабом и позицией.
             Масштаб задаём на обёртке, анимации остаются на внутреннем элементе */}
          <span
            className="hero__shapeWrap"
            style={{
              position: 'absolute',
              top: 'calc(34% - 20px)',
              left: '12%',
              transform: 'scale(1.60)', // меняйте это число для размера квадрата
              transformOrigin: 'center',
            }}
          >
            <span className="hero__shape hero__shape--square"></span>
          </span>
          <span
            className="hero__shapeWrap"
            style={{
              position: 'absolute',
              top: 'calc(9% - 20px)',            // верхняя правая треть
              left: '72%',
              transform: 'scale(1.85)', // немного крупнее как акцент
              transformOrigin: 'center',
            }}
          >
            <span className="hero__shape hero__shape--diamond"></span>
          </span>
          <span
            className="hero__shapeWrap"
            style={{
              position: 'absolute',
              bottom: 'calc(12% + 20px)',         // нижняя правая треть
              left: '64%',
              transform: 'scale(1.44)', // немного крупнее, но мягче ромба
              transformOrigin: 'center',
            }}
          >
            <span className="hero__shape hero__shape--ring"></span>
          </span>
        </div>
        {/* Эффект тумана — отключён по требованию */}
        
        {/* Чёрные элементы для глубины */}
        <div className="hero__depth hero__depth--1"></div>
        <div className="hero__depth hero__depth--2"></div>
        <div className="hero__depth hero__depth--3"></div>

        {/* Орбитальное кольцо — удалено по требованию */}

        {/* Схематические паттерны (circuit board) — отключены по требованию */}

        {/* Центральное свечение */}
        <div className="hero__glow"></div>

        <div className="hero__content">
          <h1 className="hero__title">
            Внедряем искусственный интеллект, который повышает КПД бизнеса
          </h1>
          <p className="hero__subtitle">
            Убираем рутину и повышаем продуктивность команды на 35%
          </p>

          <div className="hero__actions">
            <button
              className="btn btn--primary btn--pulse"
              // Направляем пользователя сразу к блоку записи на консультацию
              // вместо секции аудита, чтобы упростить путь к действию.
              onClick={() => scrollToSection('booking')}
            >
              Бесплатный аудит бизнес-процессов
              <svg className="btn__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
