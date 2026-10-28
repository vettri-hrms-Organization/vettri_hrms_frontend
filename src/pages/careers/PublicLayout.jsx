import { Link } from 'react-router-dom';
import Logo from '../../components/brand/Logo';

export default function PublicLayout({ children, hero = null }) {
  return (
    <div className="hz-public">
      <header className="hz-public__header">
        <div className="hz-public__bar">
          <Link to="/careers" className="text-decoration-none" aria-label="Careers home">
            <Logo tagline="Careers" />
          </Link>
          <Link to="/" className="hz-public__back">
            Back to Vettri HRMS
          </Link>
        </div>
      </header>
      {hero}
      <main className="hz-public__main">
        {children}
      </main>
      <footer className="hz-public__footer">
        &copy; {new Date().getFullYear()} Vettri HRMS. All rights reserved.
      </footer>
    </div>
  );
}
