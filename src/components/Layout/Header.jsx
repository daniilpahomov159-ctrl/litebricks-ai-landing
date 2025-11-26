import React, { useState, useEffect } from 'react';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  const navLinks = [
    { id: 'hero', label: 'Главная' },
    { id: 'about', label: 'О нас' },
    { id: 'audit', label: 'Аудит' },
    { id: 'preparation', label: 'Подготовка' },
    { id: 'booking', label: 'Консультация' },
    { id: 'faq', label: 'FAQ' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Определение активной секции
      const sections = navLinks.map(link => document.getElementById(link.id)).filter(Boolean);
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Закрытие мобильного меню при клике вне его области
  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = '';
      return;
    }

    // Блокируем прокрутку страницы при открытом меню
    document.body.style.overflow = 'hidden';

    const handleClickOutside = (event) => {
      // Не закрываем меню, если клик был на бургер-кнопку, внутри меню или на overlay
      const target = event.target;
      const isBurgerClick = target.closest('.header__burger');
      const isMenuClick = target.closest('.mobile-nav');
      const isOverlayClick = target.classList.contains('mobile-nav__overlay');

      if (!isBurgerClick && !isMenuClick && !isOverlayClick) {
        setIsMobileMenuOpen(false);
      }
    };

    // Небольшая задержка, чтобы не закрыть меню сразу после открытия
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // Высота header (60px) + дополнительный отступ
      const headerHeight = 60;
      // Для секции "about" используем больший отступ для более высокого позиционирования
      const additionalOffset = sectionId === 'about' ? 100 : 15;
      const totalOffset = headerHeight + additionalOffset;
      
      // Получаем абсолютную позицию элемента на странице
      const elementTop = element.offsetTop;
      
      // Вычисляем финальную позицию скролла с учетом отступа
      const scrollPosition = elementTop - totalOffset;
      
      window.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
      
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header className={`header ${isScrolled ? 'header--scrolled' : ''}`}>
      <div className="header__container">
        <a href="#hero" className="header__logo" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }}>
          <div className="header__logo-icon">
            <img 
              src="/docs/Логотип_без фона_белый.svg" 
              alt="LITEBRICK" 
              className="header__logo-img"
            />
          </div>
          <span>LITEBRICK</span>
        </a>

        <nav className="header__nav">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`header__nav-link ${activeSection === link.id ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); scrollToSection(link.id); }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#booking"
          className="header__cta"
          onClick={(e) => { e.preventDefault(); scrollToSection('booking'); }}
        >
          Аудит бизнеса
        </a>

        <button
          className={`header__burger ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsMobileMenuOpen(!isMobileMenuOpen);
          }}
          aria-label="Меню"
          aria-expanded={isMobileMenuOpen}
        >
          <span className="header__burger-line"></span>
          <span className="header__burger-line"></span>
          <span className="header__burger-line"></span>
        </button>
      </div>

      {/* Overlay для затемнения фона */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-nav__overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <nav className={`mobile-nav ${isMobileMenuOpen ? 'active' : ''}`}>
        {navLinks.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            className={`mobile-nav__link ${activeSection === link.id ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); scrollToSection(link.id); }}
          >
            {link.label}
          </a>
        ))}
        <a
          href="#booking"
          className="mobile-nav__cta"
          onClick={(e) => { e.preventDefault(); scrollToSection('booking'); }}
        >
          Аудит бизнеса
        </a>
      </nav>
    </header>
  );
};

export default Header;

