const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

/**
 * Splits plain text into text and http(s) link parts. Everything is rendered
 * as React text nodes (escaped), so no HTML from the body can ever execute.
 */
export function linkifyParts(text) {
  if (!text) return [];
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    let url = match[0];
    // Trailing punctuation usually belongs to the sentence, not the URL.
    const trailing = /[.,;:!?)\]]+$/.exec(url)?.[0] || '';
    if (trailing) url = url.slice(0, -trailing.length);
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    parts.push({ type: 'link', value: url });
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
  return parts;
}

export default function AnnouncementBody({ text, clamp = false }) {
  return (
    <div
      style={{
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        ...(clamp ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
      }}
    >
      {linkifyParts(text).map((part, index) => (part.type === 'link'
        ? <a key={index} href={part.value} target="_blank" rel="noopener noreferrer nofollow">{part.value}</a>
        : <span key={index}>{part.value}</span>))}
    </div>
  );
}
