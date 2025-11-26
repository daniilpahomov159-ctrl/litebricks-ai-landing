import React from 'react';

const Logo = () => {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Левый нижний куб */}
      {/* Передняя грань */}
      <path
        d="M6 30 L6 38 L14 34 L14 26 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Верхняя грань */}
      <path
        d="M6 30 L14 26 L18 28 L10 32 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Правая грань */}
      <path
        d="M14 26 L18 28 L18 20 L14 18 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      
      {/* Правый нижний куб */}
      {/* Передняя грань */}
      <path
        d="M22 28 L22 20 L30 16 L30 24 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Верхняя грань */}
      <path
        d="M22 28 L30 24 L34 26 L26 30 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Правая грань */}
      <path
        d="M30 24 L34 26 L34 18 L30 16 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      
      {/* Верхний центральный куб */}
      {/* Передняя грань */}
      <path
        d="M16 18 L20 20 L24 18 L20 16 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Верхняя грань */}
      <path
        d="M20 16 L24 18 L24 10 L20 8 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Левая грань */}
      <path
        d="M16 18 L20 16 L20 8 L16 10 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
};

export default Logo;

