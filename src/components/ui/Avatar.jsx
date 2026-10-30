import { API_BASE_URL } from '../../api/axiosClient';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Same name -> same tint on every screen, so people are recognisable in
// long tables. Tones are defined in hrms-product.css (.hz-avatar--tone-N).
const TONE_COUNT = 6;
function getTone(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash) % TONE_COUNT;
}

const SIZES = { sm: 28, md: 36, lg: 48, xl: 64 };

/** Uploaded profile photos are stored as API paths (/api/profile-photos/...); other values are full URLs. */
export function photoUrl(src) {
  return typeof src === 'string' && src.startsWith('/api/') ? `${API_BASE_URL.replace(/\/$/, '')}${src}` : src;
}

export default function Avatar({ name, size = 'md', src }) {
  const px = SIZES[size] || SIZES.md;
  const style = { width: px, height: px, fontSize: px * 0.38 };

  if (src) {
    return <img src={photoUrl(src)} alt={name} className="hz-avatar" style={{ ...style, objectFit: 'cover' }} />;
  }

  const tone = getTone(name || '');
  return (
    <span className={`hz-avatar${tone ? ` hz-avatar--tone-${tone}` : ''}`} style={style} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
