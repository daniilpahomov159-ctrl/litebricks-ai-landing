import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'theme-preference';

// Цветовая палитра для дневной темы (текущая)
const lightTheme = {
  '--color-primary': '#4371F4',
  '--color-primary-dark': '#003983',
  '--color-dark': '#07192C',
  '--color-fuchsia': '#4371F4',
  '--color-electric-purple': '#003983',
  '--color-deep-violet': '#07192C',
  '--color-hot-pink': '#4371F4',
  '--color-black-purple': '#07192C',
  '--gradient-primary': 'linear-gradient(135deg, #4371F4, #003983)',
  '--gradient-card': 'linear-gradient(135deg, rgba(67, 113, 244, 0.10), rgba(0, 57, 131, 0.10))',
  '--shadow-glow': '0 0 20px rgba(67, 113, 244, 0.3)',
  '--body-gradient': 'linear-gradient(135deg, #07192C 0%, #000000 50%, #003983 100%)',
  // Дополнительные переменные для rgba эффектов
  '--color-primary-rgb': '67, 113, 244',
  '--color-primary-dark-rgb': '0, 57, 131',
};

// Цветовая палитра для ночной темы (после 18:00)
const nightTheme = {
  '--color-primary': '#ad2831',
  '--color-primary-dark': '#800e13',
  '--color-dark': '#250902',
  '--color-fuchsia': '#ad2831',
  '--color-electric-purple': '#800e13',
  '--color-deep-violet': '#250902',
  '--color-hot-pink': '#ad2831',
  '--color-black-purple': '#250902',
  '--gradient-primary': 'linear-gradient(135deg, #ad2831, #800e13)',
  '--gradient-card': 'linear-gradient(135deg, rgba(173, 40, 49, 0.10), rgba(128, 14, 19, 0.10))',
  '--shadow-glow': '0 0 20px rgba(173, 40, 49, 0.3)',
  '--body-gradient': 'linear-gradient(135deg, #250902 0%, #38040e 50%, #640d14 100%)',
  // Дополнительные переменные для rgba эффектов
  '--color-primary-rgb': '173, 40, 49',
  '--color-primary-dark-rgb': '128, 14, 19',
};

/**
 * Применяет цветовую палитру к документу через CSS-переменные
 */
const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(theme).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
};

/**
 * Определяет, наступило ли 18:00 по локальному времени пользователя
 */
const isNightTime = () => {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 18;
};

/**
 * Проверяет системные настройки prefers-color-scheme
 */
const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'night';
  }
  
  return 'light';
};

/**
 * Определяет начальную тему с учетом всех факторов
 */
const getInitialTheme = (savedPreference) => {
  // 1. Если есть явное сохраненное предпочтение (не auto), используем его
  if (savedPreference && savedPreference.theme !== 'auto') {
    return savedPreference.theme;
  }
  
  // 2. Если режим auto или нет сохраненных настроек, проверяем системные настройки
  const systemTheme = getSystemTheme();
  if (systemTheme === 'night') {
    return 'night';
  }
  
  // 3. Если системные настройки светлые, проверяем время суток
  return isNightTime() ? 'night' : 'light';
};

/**
 * Загружает сохраненное предпочтение темы из localStorage
 */
const loadThemePreference = () => {
  if (typeof window === 'undefined') return { theme: 'auto', lastCheck: null };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Ошибка при загрузке предпочтения темы:', error);
  }
  return { theme: 'auto', lastCheck: null };
};

/**
 * Сохраняет предпочтение темы в localStorage
 */
const saveThemePreference = (preference) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch (error) {
    console.error('Ошибка при сохранении предпочтения темы:', error);
  }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState('auto'); // 'auto' | 'light' | 'night'
  const [isNight, setIsNight] = useState(false);

  // Определение текущей активной темы
  const getActiveTheme = useCallback(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'night') return 'night';
    // auto режим - определяем по системным настройкам и времени
    const systemTheme = getSystemTheme();
    if (systemTheme === 'night') return 'night';
    return isNightTime() ? 'night' : 'light';
  }, [themeMode]);

  // Применение темы к документу
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const activeTheme = getActiveTheme();
    const theme = activeTheme === 'night' ? nightTheme : lightTheme;
    applyTheme(theme);
    
    // Обновляем класс на body и data-атрибут для дополнительной стилизации
    document.body.classList.remove('theme-light', 'theme-night');
    document.body.classList.add(`theme-${activeTheme}`);
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [getActiveTheme]);

  // Загрузка сохраненного предпочтения при монтировании
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const preference = loadThemePreference();
    setThemeMode(preference.theme);
    
    // Определяем начальную тему с учетом всех факторов
    const initialTheme = getInitialTheme(preference);
    const night = initialTheme === 'night';
    setIsNight(night);
    
    // Применяем тему сразу при загрузке (на случай, если inline script не сработал)
    const theme = night ? nightTheme : lightTheme;
    applyTheme(theme);
    document.body.classList.remove('theme-light', 'theme-night');
    document.body.classList.add(`theme-${initialTheme}`);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  // Периодическая проверка времени и системных настроек (каждую минуту) для автоматического режима
  useEffect(() => {
    if (typeof window === 'undefined' || themeMode !== 'auto') return;

    const checkTheme = () => {
      const systemTheme = getSystemTheme();
      let night = false;
      
      // Приоритет: системные настройки > время суток
      if (systemTheme === 'night') {
        night = true;
      } else {
        night = isNightTime();
      }
      
      setIsNight(night);
    };

    // Проверяем сразу
    checkTheme();

    // Устанавливаем интервал проверки каждую минуту
    const interval = setInterval(checkTheme, 60000);
    
    // Слушаем изменения системных настроек темы
    let mediaQuery = null;
    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => checkTheme();
      // Современные браузеры
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else {
        // Старые браузеры
        mediaQuery.addListener(handleChange);
      }
    }

    return () => {
      clearInterval(interval);
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', checkTheme);
        } else {
          mediaQuery.removeListener(checkTheme);
        }
      }
    };
  }, [themeMode]);

  // Функция для ручного переключения темы
  const toggleTheme = useCallback((mode?: string) => {
    const newMode = mode || (themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'night' : 'auto');
    setThemeMode(newMode);
    
    const preference = {
      theme: newMode,
      lastCheck: new Date().toISOString(),
    };
    saveThemePreference(preference);
  }, [themeMode]);

  // Функция для установки конкретного режима
  const setTheme = useCallback((mode: string) => {
    if (['auto', 'light', 'night'].includes(mode)) {
      setThemeMode(mode);
      const preference = {
        theme: mode,
        lastCheck: new Date().toISOString(),
      };
      saveThemePreference(preference);
    }
  }, []);

  const value = {
    themeMode,
    isNight: getActiveTheme() === 'night',
    activeTheme: getActiveTheme(),
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Хук для доступа к контексту темы
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

