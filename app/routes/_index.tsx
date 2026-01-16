import type { MetaFunction } from '@remix-run/node';
import Header from '../components/Layout/Header';
import Hero from '../components/Hero';
import About from '../components/About';
import AuditForm from '../components/AuditForm';
import Preparation from '../components/Preparation';
import BookingRemix from '../components/BookingRemix';
import FAQ from '../components/FAQ';
import Legal from '../components/Legal';

export const meta: MetaFunction = () => {
  return [
    { title: 'LITEBRICK — Внедрение ИИ в бизнес | AI-ассистенты и агенты,чат-боты, веб-приложения, приложения в телеграмме' },
    { 
      name: 'description', 
      content: 'Автоматизируем бизнес с помощью искусственного интеллекта. Снижаем издержки, ускоряем операции, внедряем решения, которые окупаются.' 
    },
  ];
};

export default function Index() {
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
          <BookingRemix />
        </section>
        <section id="faq">
          <FAQ />
        </section>
        <Legal />
      </main>
    </>
  );
}

