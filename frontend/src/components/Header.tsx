import { Link, NavLink } from 'react-router-dom';
import { LogoMark } from './Icons';

const NAV_ITEMS = [
  { to: '/', label: 'Главная', end: true },
  { to: '/upload', label: 'Загрузка', end: false },
  { to: '/analysis', label: 'Анализ', end: false },
  { to: '/results', label: 'Результаты', end: false },
];

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="BonAI — на главную">
      <LogoMark className="logo__mark" />
      <span className="logo__text">
        Bon<span className="logo__accent">AI</span>
      </span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="header">
      <Logo />
      <nav className="nav" aria-label="Основная навигация">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="header__spacer" aria-hidden="true" />
    </header>
  );
}
