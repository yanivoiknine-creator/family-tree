import { useMemo, useState } from 'react';
import type { FamilyGraph } from '../lib/graph';
import { displayName, lifeSpan, searchText } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { Avatar } from './Avatar';

export function SearchBox({ graph, onPick }: { graph: FamilyGraph; onPick: (id: string) => void }) {
  const { lang, t } = useLang();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return Object.values(graph.people)
      .filter((p) => {
        const s = searchText(p);
        return terms.every((term) => s.includes(term));
      })
      .slice(0, 12);
  }, [q, graph]);

  const pick = (id: string) => {
    onPick(id);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        type="search"
        value={q}
        placeholder={t('searchPlaceholder')}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && results[active]) pick(results[active].id);
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && q.trim() && (
        <ul className="search-results">
          {results.length === 0 && <li className="muted">{t('noResults')}</li>}
          {results.map((p, i) => (
            <li key={p.id}>
              <button className={i === active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p.id)}>
                <Avatar person={p} size={28} />
                <span>{displayName(p, lang)}</span>
                <span className="muted">{lifeSpan(p, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
