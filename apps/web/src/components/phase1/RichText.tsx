type Props = { value: string; className?: string };

const safe = (value: string) => value.replace(/<\/?[^>]+>/g, (tag) => {
  const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
  const allowed = new Set(['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'br']);
  if (!match || !allowed.has(match[2].toLowerCase())) return '';
  const name = match[2].toLowerCase();
  if (match[1] === '/' || name !== 'a') return `<${match[1] === '/' ? '/' : ''}${name}>`;
  const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  return /^https?:\/\//i.test(href) ? `<a href="${href.replace(/"/g, '')}" rel="noopener noreferrer">` : '<a>';
});

export function RichText({ value, className }: Props) {
  if (!/<\/?[a-z][^>]*>/i.test(value)) return <p className={className} style={{ whiteSpace: 'pre-line' }}>{value}</p>;
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe(value) }} />;
}
