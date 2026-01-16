import React, { useState, useEffect, useRef } from 'react';

const About = () => {
  const [visibleCards, setVisibleCards] = useState([]);
  const cardRefs = useRef([]);

  const cards = [
    {
      title: 'Прозрачная окупаемость',
      text: 'Мы подбираем решения под ваш бизнес и заранее считаем ROI. Если шанс окупаемости слабый, мы честно рекомендуем «не внедрять».',
      highlight: 'Средняя окупаемость — 3–6 месяцев',
    },
    {
      title: 'Стратегический подход',
      text: 'Учитываем нормы законодательства (ФЗ-152) и безопасность данных. Осуществляем техническую поддержку после внедрения.',
      highlight: 'Сертифицированные серверы',
    },
    {
      title: 'Ваше время - дорогой ресурс',
      text: 'ИИ — это инвестиции в высвобождение вашего главного ресурса.',
      highlight: '60+ часов в месяц',
    },
  ];

  useEffect(() => {
    const observers = [];

    cardRefs.current.forEach((ref, index) => {
      if (!ref) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleCards((prev) => {
                if (!prev.includes(index)) {
                  return [...prev, index];
                }
                return prev;
              });
              observer.unobserve(ref);
            }
          });
        },
        {
          threshold: 0.2,
          rootMargin: '0px 0px -50px 0px',
        }
      );

      observer.observe(ref);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return (
    <div id="about" className="section">
      {/* Поднимаем карточку так, чтобы она наполовину заходила на предыдущий блок (Hero) */}
      <div
        className="about-card"
        style={{
          position: 'relative',
          zIndex: 3,            // гарантируем перекрытие над Hero
          marginTop: 'calc(-24vh + 70px)',   // поднимем блок ещё выше, чтобы больше заходил на Hero, опускаем на 70px
        }}
      >
        <div className="about-card__content">
          <h2 className="about-card__title">
            Внедряем искусственный интеллект в бизнес, автоматизируя процессы и{' '}
            <span className="about-card__highlight">освобождая время для главного</span>
          </h2>
          <p className="about-card__text">
            Помогаем определить оптимальные направления для применения ИИ, разработать стратегию цифровой трансформации 
            и реализовать проекты, которые приносят прибыль.
          </p>
        </div>
        <div className="about-card__visual">
          <div className="about-card__graphic"></div>
          <img
            src="/docs/челик.png"
            alt="Предприниматель работает с искусственным интеллектом на ноутбуке"
            className="about-card__character-image"
          />
        </div>
      </div>
      
      <div className="grid-3" style={{ marginTop: 'calc(1rem + 70px)' }}>
        {cards.map((card, index) => (
          <article
            key={index}
            ref={(el) => (cardRefs.current[index] = el)}
            className={`card card--fade-in ${visibleCards.includes(index) ? 'card--visible' : ''}`}
            style={{ transitionDelay: `${index * 0.15}s` }}
          >
            <h3 className="card__title">{card.title}</h3>
            <p className="card__text">
              {card.text}
              {card.highlight && (
                <>
                  <br />
                  <strong className="card__highlight-text">{card.highlight}</strong>
                </>
              )}
            </p>
          </article>
        ))}
      </div>

      <p className="section__description" style={{ marginTop: 'calc(2rem + 70px)', textAlign: 'left', fontStyle: 'italic' }}>
      «Инновации отличают лидера от догоняющего», — Стив Джобс
      </p>
    </div>
  );
};

export default About;

