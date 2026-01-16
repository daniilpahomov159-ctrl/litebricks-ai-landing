import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
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
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

export default App;

