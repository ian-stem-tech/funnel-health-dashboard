import type { ReactNode } from 'react';

type Props = {
  title?: string;
  subtitle?: string;
  iconLetter?: string;
  iconElement?: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
};

export function BentoCard({
  title,
  subtitle,
  iconLetter,
  iconElement,
  className,
  headerExtra,
  children,
}: Props) {
  const classes = ['bento-card', className].filter(Boolean).join(' ');
  return (
    <section className={classes}>
      {(title || subtitle || iconLetter || iconElement || headerExtra) && (
        <header className="card-head">
          <div className="card-title-group">
            {(iconElement || iconLetter) && (
              <span className="card-icon-tag" aria-hidden="true">
                {iconElement ?? iconLetter}
              </span>
            )}
            <div>
              {title && <h2 className="card-title">{title}</h2>}
              {subtitle && <p className="card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {headerExtra && <div className="card-head-extra">{headerExtra}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
