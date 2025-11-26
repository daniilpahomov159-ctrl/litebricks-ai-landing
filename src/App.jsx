import React from 'react';
import Header from './components/Layout/Header';
import Hero from './components/Hero';
import About from './components/About';
import AuditForm from './components/AuditForm';
import Preparation from './components/Preparation';
import Booking from './components/Booking';
import FAQ from './components/FAQ';
import Legal from './components/Legal';

function App() {
  return (
    <>
      <Header />
      <main>
        <section id="hero">
          <Hero />
        </section>
        <section id="about">
          <About />
        </section>
        <section id="audit">
          <AuditForm />
        </section>
        <section id="preparation">
          <Preparation />
        </section>
        <section id="booking">
          <Booking />
        </section>
        <section id="faq">
          <FAQ />
        </section>
        <section id="legal">
          <Legal />
        </section>
      </main>
      <a href="#faq" className="floating-cta" onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }); }}>
        <svg className="floating-cta__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        Спросить ИИ
      </a>
    </>
  );
}

export default App;

