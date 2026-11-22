import type { Person } from '../types';
import { nameParts } from '../lib/i18n';
import { useLang } from '../lib/LangContext';

export function Avatar({ person, size }: { person: Person; size: number }) {
  const { lang } = useLang();
  const { first, last } = nameParts(person, lang);
  const initials = `${first.charAt(0)}${last.charAt(0)}`;
  return (
    <span className={`avatar sex-${person.sex}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {person.photo ? <img src={person.photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initials}
    </span>
  );
}
