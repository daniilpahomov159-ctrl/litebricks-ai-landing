import React from 'react';

const Legal = () => {
  const currentYear = new Date().getFullYear();
  const email = 'litebrickstudios@gmail.com';
  // Правильно кодируем тему письма для URL
  const emailSubject = encodeURIComponent('Обращение в LITEBRICK');
  // Ссылка для Gmail
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${emailSubject}`;

  // Обработчик клика: копирует email в буфер и открывает Gmail
  const handleEmailClick = async (e) => {
    e.preventDefault();
    
    // Копируем email в буфер обмена
    try {
      await navigator.clipboard.writeText(email);
    } catch (err) {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = email;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    
    // Открываем Gmail в новой вкладке
    window.open(gmailLink, '_blank', 'noopener,noreferrer');
  };

  const documents = [
    { name: 'Политика конфиденциальности', link: 'https://disk.yandex.ru/d/YyMkaf2X3p0F_A' },
    { name: 'Согласие на обработку персональных данных', link: 'https://disk.yandex.ru/i/tZ7ac45-cGZGVA' },
  ];

  return (
    <div className="legal">
      <div className="legal__container">
        <div className="legal__content">
          <div>
            <h3 className="legal__section-title">Контакты</h3>
            <p className="legal__contact">
              Email:{' '}
              <a 
                href={gmailLink}
                onClick={handleEmailClick}
                className="legal__contact-link"
              >
                {email}
              </a>
            </p>
            <p className="legal__contact">
              Telegram:{' '}
              <a href="https://t.me/dperson24" target="_blank" rel="noopener noreferrer">
              @dperson24
              </a>
            </p>
          </div>

          <div>
            <h3 className="legal__section-title">Документы</h3>
            <ul className="legal__docs">
              {documents.map((doc, index) => (
                <li key={index} className="legal__docs-item">
                  <a
                    href={doc.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="legal__docs-link"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {doc.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="legal__footer">
          <p>
            © {currentYear} LITEBRICK. Внедряем искусственный интеллект в бизнес-процессы.
            
          </p>
        </div>
      </div>
    </div>
  );
};

export default Legal;

