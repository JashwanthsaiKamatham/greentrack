import { Fragment } from 'react';

/** Small, safe Markdown renderer for AI replies (headings, lists, bold, italics). No raw HTML is ever injected. */
function inline(text, keyPrefix) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith('**') || tok.startsWith('__')) out.push(<strong key={key} className="font-semibold text-slate-900">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text = '' }) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let list = null;

  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'h', text: h[2].replace(/[#*]+$/g, '').trim() });
    } else if (ul) {
      if (!list || list.type !== 'ul') {
        flush();
        list = { type: 'ul', items: [] };
      }
      list.items.push(ul[1]);
    } else if (ol) {
      if (!list || list.type !== 'ol') {
        flush();
        list = { type: 'ol', items: [] };
      }
      list.items.push(ol[2]);
    } else if (/^[-*_]{3,}$/.test(line)) {
      flush();
    } else {
      flush();
      blocks.push({ type: 'p', text: line });
    }
  }
  flush();

  return (
    <div className="space-y-2.5 text-[15px] leading-relaxed text-slate-700">
      {blocks.map((b, i) => {
        if (b.type === 'h') {
          return (
            <h4 key={i} className="pt-1.5 text-[15px] font-bold text-emerald-700 first:pt-0">
              {inline(b.text.replace(/\*\*/g, ''), `h${i}`)}
            </h4>
          );
        }
        if (b.type === 'ul' || b.type === 'ol') {
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5">
                  {b.type === 'ol' ? (
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">{j + 1}</span>
                  ) : (
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  )}
                  <span className="min-w-0 flex-1">{inline(it, `l${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(b.text, `p${i}`)}</p>;
      })}
      {!blocks.length && <Fragment />}
    </div>
  );
}
