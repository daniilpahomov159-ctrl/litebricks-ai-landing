import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const ThemeToggle = () => {
  const { themeMode, activeTheme, setTheme } = useTheme();

  const handleToggle = () => {
    // Циклическое переключение: auto -> light -> night -> auto
    if (themeMode === 'auto') {
      setTheme('light');
    } else if (themeMode === 'light') {
      setTheme('night');
    } else {
      setTheme('auto');
    }
  };

  const getThemeLabel = () => {
    if (themeMode === 'auto') {
      return activeTheme === 'night' ? '🌙 Авто (Ночь)' : '☀️ Авто (День)';
    }
    if (themeMode === 'light') {
      return '☀️ День';
    }
    return '🌙 Ночь';
  };

  const getThemeIcon = () => {
    if (themeMode === 'auto') {
      return activeTheme === 'night' ? '🌙' : '☀️';
    }
    if (themeMode === 'light') {
      return '☀️';
    }
    return '🌙';
  };

  return (
    <button
      className="theme-toggle"
      onClick={handleToggle}
      aria-label={`Переключить тему. Текущая: ${getThemeLabel()}`}
      title={getThemeLabel()}
    >
      <span className="theme-toggle__icon">{getThemeIcon()}</span>
      <span className="theme-toggle__label">{themeMode === 'auto' ? 'Авто' : themeMode === 'light' ? 'День' : 'Ночь'}</span>
    </button>
  );
};

export default ThemeToggle;

