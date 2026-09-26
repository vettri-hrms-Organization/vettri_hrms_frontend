/**
 * Vettri HRMS brand mark.
 * -----------------------------------------------------------------
 * A single source of truth for the logo so every surface (landing page,
 * login screen, app sidebar, careers pages) renders the exact same mark
 * instead of ad-hoc "H1" badges. The mark is a monogram: two pillars and
 * a crossbar read as an "H", and the small accent node standing on the
 * right pillar stands for the "One" - a single person represented within
 * the platform.
 *
 * Usage:
 *   <Logo />                                  // color mark + wordmark
 *   <Logo tone="onDark" />                    // for dark/gradient backgrounds
 *   <Logo variant="mark" size={32} />         // icon only, e.g. sidebar
 *   <Logo tagline="Careers" />                // wordmark + small suffix
 */
export default function Logo({
  variant = 'full', // 'full' | 'mark'
  tone = 'onLight', // 'onLight' | 'onDark'
  size = 36,
  tagline,
  className = '',
  wordmarkSize,
}) {
  const isOnDark = tone === 'onDark';
  const source = variant === 'mark' ? '/brand/vettri-mark-transparent.png' : '/brand/vettri-logo-full-transparent.png';
  const ratio = variant === 'mark' ? 292 / 260 : 677 / 260;
  const logoWidth = Math.round(size * ratio);

  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className}`} style={{ lineHeight: 1 }}>
      <img
        src={source}
        alt=""
        width={logoWidth}
        height={size}
        style={{ width: logoWidth, height: size, objectFit: 'contain', filter: isOnDark ? 'none' : 'brightness(0)' }}
      />

      {variant === 'full' && (
        <span className="d-inline-flex align-items-baseline gap-2">
          <span
            style={{
              fontFamily: 'var(--hz-font-display, var(--hz-font-sans))',
              fontWeight: 700,
              fontSize: wordmarkSize || 'var(--hz-text-lg)',
              letterSpacing: '-0.01em',
              display: 'none',
            }}
          >
            <span>Vettri</span>
          </span>
          {tagline && (
            <span
              style={{
                fontSize: 'var(--hz-text-sm)',
                fontWeight: 500,
                color: isOnDark ? 'rgba(255,255,255,0.7)' : 'var(--hz-text-muted)',
                paddingLeft: 8,
                borderLeft: `1px solid ${isOnDark ? 'rgba(255,255,255,0.25)' : 'var(--hz-border)'}`,
              }}
            >
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
