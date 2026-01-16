import React, { useState } from 'react';

const FAQ = () => {
  const [activeIndex, setActiveIndex] = useState(null);

  const faqs = [
    {
      question: 'Вы создаёте только ИИ-агенты?',
      answer: 'Наша работа выходит за рамки создания ИИ-агентов: мы разрабатываем полноценные Веб-приложения и TWA — функциональные интерфейсы, оркестрирующие и демонстрирующие результаты работы этих агентов.',
    },
    {
      question: 'Как обеспечивается безопасность данных?',
      answer: 'Безопасность — приоритет. Мы работаем с шифрованием данных, разграничением доступа, соответствием требованиям защиты информации. Все данные обрабатываются в соответствии с политикой конфиденциальности. При необходимости можем организовать on-premise решение или работу в вашей инфраструктуре.',
    },
    {
      question: 'Могу ли я пользоваться зарубежными нейросетями, если работаю с персональными данными?',
      answer: 'Да, но только если персональные данные не отправляются в зарубежный сервис. По ФЗ-152 они должны обрабатываться внутри РФ. Можно использовать фильтр/шлюз, который удаляет персональные данные, или через локальное (on-premise) развертывание, где данные остаются внутри вашей инфраструктуры.',
    },
    {
      question: 'Какие риски неокупаемости проекта?',
      answer: 'Мы минимизируем риски через пилотный этап. Сначала запускаем MVP на ограниченном сегменте, измеряем результаты и только потом масштабируем. Если пилот не показывает ожидаемого эффекта, мы анализируем причины и корректируем подход. Прозрачная отчётность на каждом этапе позволяет принимать решения на основе данных, а не предположений.',
    },
    {
      question: 'Какие сроки реализации пилота?',
      answer: 'Сроки зависят от сложности задачи. Простой чат-бот для ответов на частые вопросы может быть готов за 2-4 недели. Более сложные решения с интеграцией в существующие системы требуют 1-3 месяцев. После аудита мы даём конкретные сроки с разбивкой по этапам.',
    },
    {
      question: 'Нужна ли техническая экспертиза с нашей стороны?',
      answer: 'Не обязательно. Мы берём на себя всю техническую часть: разработку, интеграцию, настройку. С вашей стороны нужен только эксперт по бизнес-процессам, который поможет понять специфику задач и оценить результаты. Мы обучаем вашу команду работе с системой после внедрения.',
    },
  ];

  const toggleFAQ = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

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
          Часто задаваемые вопросы
        </h2>
        {/* Маркер секции FAQ в том же стиле, что и / start в блоке подготовки */}
        <span
          className="section__marker section__marker--faq"
          style={{ fontFamily: 'var(--font-accent)', fontSize: '1.5rem', color: 'var(--color-primary)' }}
        >
          / FAQ
        </span>
      </div>
      <p className="section__description section__description--faq">
        Ответы на наиболее частые вопросы о внедрении ИИ в бизнес-процессы.
      </p>

      <div className="faq" style={{ marginTop: '3rem' }}>
        {faqs.map((faq, index) => (
          <div key={index} className={`faq__item ${activeIndex === index ? 'active' : ''}`}>
            <button className="faq__question" onClick={() => toggleFAQ(index)}>
              <span>{faq.question}</span>
              <svg className="faq__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="faq__answer">
              <div className="faq__answer-content">{faq.answer}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;

