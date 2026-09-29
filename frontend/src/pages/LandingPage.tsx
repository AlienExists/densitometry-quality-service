import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Artwork } from '@/components/ui';
import { ChevronRightIcon } from '@/components/Icons';

const SLIDES = [
  { key: 'spine', label: 'Поясничный отдел' },
  { key: 'femur', label: 'Проксимальный отдел бедра' },
];

const STATS = [
  { value: '≤ 5°', caption: 'Допустимый наклон оси позвоночника' },
  { value: '~3 мин', caption: 'Среднее время обработки одного исследования' },
  { value: '2', caption: 'Поддерживаемые области для исследования' },
];

const STEPS = [
  { title: 'Загрузка DICOM', text: 'Одно исследование или пакет из ZIP-архива' },
  { title: 'Автоматический анализ', text: 'Классификация качества и типа нарушения' },
  { title: 'Визуализация', text: 'Тепловая карта нарушения и ось позвоночника с углом наклона' },
  { title: 'Экспорт отчёта', text: 'Сохранение отчёта в формате XLSX' },
];

const AUTOPLAY_MS = 8000;
const REVEAL_STEP_MS = 90;

const revealDelay = (index: number) =>
  ({ '--reveal-delay': `${index * REVEAL_STEP_MS}ms` }) as CSSProperties;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function useRevealOnScroll(root: RefObject<HTMLElement>) {
  useEffect(() => {
    const container = root.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-reveal]'));
    const showAll = () => items.forEach((item) => item.classList.add('is-visible'));

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      showAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );

    items.forEach((item) => observer.observe(item));

    let frame = 0;
    const revealPassed = () => {
      frame = 0;
      items.forEach((item) => {
        if (!item.classList.contains('is-visible') && item.getBoundingClientRect().top < window.innerHeight) {
          item.classList.add('is-visible');
          observer.unobserve(item);
        }
      });
    };
    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(revealPassed);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [root]);
}

function usePointerTilt(target: RefObject<HTMLElement>, enabled: boolean) {
  useEffect(() => {
    const element = target.current;
    if (!element || !enabled) return;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;

    let frame = 0;
    const goal = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const tick = () => {
      current.x += (goal.x - current.x) * 0.06;
      current.y += (goal.y - current.y) * 0.06;
      element.style.setProperty('--tilt-x', current.x.toFixed(4));
      element.style.setProperty('--tilt-y', current.y.toFixed(4));
      const settled =
        Math.abs(goal.x - current.x) < 0.001 && Math.abs(goal.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const handleMove = (event: PointerEvent) => {
      goal.x = (event.clientX / window.innerWidth) * 2 - 1;
      goal.y = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const handleLeave = () => {
      goal.x = 0;
      goal.y = 0;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', handleMove);
    document.documentElement.addEventListener('pointerleave', handleLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
      document.documentElement.removeEventListener('pointerleave', handleLeave);
    };
  }, [target, enabled]);
}

function Hero() {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const artRef = useRef<HTMLDivElement>(null);
  const slide = SLIDES[index];

  usePointerTilt(artRef, !reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [index, reducedMotion]);

  return (
    <section className="hero" aria-roledescription="карусель">
      <div className="hero__art" aria-hidden="true" ref={artRef}>
        {SLIDES.map((item, i) => (
          <div
            key={item.key}
            className={`hero__slide hero__slide--${item.key}${i === index ? ' hero__slide--visible' : ''}`}
          >
            <div className="hero__float hero__float--shadow">
              <Artwork
                src={`/images/hero-${item.key}-shadow.png`}
                alt=""
                className="hero__layer hero__layer--shadow"
              />
            </div>
            <div className="hero__float">
              <Artwork
                src={`/images/hero-${item.key}-bone.png`}
                alt=""
                className="hero__layer hero__layer--bone"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="hero__content">
        <p className="eyebrow">ИИ-сервис • контроль качества денситометрии</p>
        <h1 className="hero__title">Проверьте качество исследований</h1>
        <p className="hero__lead">
          Система проверяет качество укладки и разметки ДРА-исследований в формате DICOM, а также
          выявляет нарушения
        </p>
      </div>

      <div className="hero__footer">
        <p className="eyebrow" aria-live="polite">
          {slide.label}
        </p>
        <div className="hero__dots">
          {SLIDES.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className={i === index ? 'hero__dot hero__dot--active' : 'hero__dot'}
              aria-label={item.label}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="hero__next"
        aria-label="Следующий слайд"
        onClick={() => setIndex((i) => (i + 1) % SLIDES.length)}
      >
        <ChevronRightIcon />
      </button>
    </section>
  );
}

function Stats() {
  return (
    <section className="stats" aria-label="Ключевые параметры">
      {STATS.map((stat, i) => (
        <div key={stat.value} className="stats__item" data-reveal style={revealDelay(i)}>
          <p className="stats__value">{stat.value}</p>
          <p className="stats__caption">{stat.caption}</p>
        </div>
      ))}
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="how__heading" data-reveal>
        <h2 id="how-title" className="section-title">
          Как это работает
        </h2>
        <p className="section-lead">Всего 4 шага от загрузки DICOM до готового отчёта</p>
      </div>

      <div className="how__grid">
        <div className="how__visual" aria-hidden="true" data-reveal>
          <div className="how__sway">
            <div className="how__breath">
              <Artwork src="/images/how-it-works.png" alt="" className="how__image" />
              <span className="how__glow" />
            </div>
          </div>
        </div>

        <ol className="how__steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step" data-reveal style={revealDelay(i + 1)}>
              <span className="step__number" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__text">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__column" data-reveal style={revealDelay(0)}>
        <h2 className="footer__title">BonAI</h2>
        <p className="footer__text">
          Хакатон «Лидеры цифровой трансформации» • Центр диагностики и телемедицины, 2026
        </p>
      </div>
      <div className="footer__column" data-reveal style={revealDelay(1)}>
        <h2 className="footer__title">Область анализа</h2>
        <p className="footer__text">
          Поясничный отдел позвоночника •
          <br />
          Проксимальный отдел бедра
        </p>
      </div>
      <div className="footer__column" data-reveal style={revealDelay(2)}>
        <h2 className="footer__title">Приложение</h2>
        <nav className="footer__links" aria-label="Разделы приложения">
          <Link to="/upload">Загрузка</Link>
          <Link to="/analysis">Анализ</Link>
          <Link to="/results">Результаты</Link>
        </nav>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const rootRef = useRef<HTMLElement>(null);
  useRevealOnScroll(rootRef);

  return (
    <main className="landing" ref={rootRef}>
      <Hero />
      <Stats />
      <HowItWorks />
      <Footer />
    </main>
  );
}
