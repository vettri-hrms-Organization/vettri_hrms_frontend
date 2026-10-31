import { useT } from '../../i18n/LanguageContext';
export default function PageHeader({ eyebrow, title, description, actions, className = '' }) {
  const t = useT();
  return (
    <div className={`hz-page-header d-flex align-items-end justify-content-between flex-wrap gap-3 ${className}`.trim()}>
      <div className="min-w-0 flex-grow-1">
        {eyebrow && <p className="hz-page-header__eyebrow">{t(eyebrow)}</p>}
        <h1 className="hz-page-header__title">{t(title)}</h1>
        {description && <p className="hz-page-header__description">{t(description)}</p>}
      </div>
      {actions && <div className="hz-page-header__actions d-flex align-items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
