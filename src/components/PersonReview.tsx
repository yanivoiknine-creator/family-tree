import type { Decision, Finding } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { Profile } from '../lib/supabase';
import type { Suggestion } from '../data/cloudStore';
import { useLang } from '../lib/LangContext';
import { FindingCard } from './ReviewPage';
import { SuggestionsList } from './SuggestionsList';

/** Family members' suggestions that touch this person (their card, or a relationship they are part of). */
export function personSuggestions(all: Suggestion[], id: string): Suggestion[] {
  return all.filter((s) => s.change.people[id]
    || Object.values(s.change.unions).some(({ before, after }) => [before, after].some((u) => u && (u.partners.includes(id) || u.children.includes(id)))));
}

interface Props {
  graph: FamilyGraph;
  /** research findings about this person (including ones that would add their relatives) */
  findings: Finding[];
  decisions: Record<string, Decision>;
  resolveId: (personId: string) => string | undefined;
  onDecide: (f: Finding, d: Decision | undefined) => void;
  suggestions: Suggestion[];
  profiles: Record<string, Profile>;
  onDecideSuggestion: (s: Suggestion, status: 'approved' | 'rejected') => void;
  onShowPerson: (id: string) => void;
}

const CONF_ORDER = { high: 0, medium: 1, low: 2 };

/** Admins: the "suggestions" tab of the person panel. */
export function PersonReview({ graph, findings, decisions, resolveId, onDecide, suggestions, profiles, onDecideSuggestion, onShowPerson }: Props) {
  const { t } = useLang();
  const pending = findings.filter((f) => !decisions[f.id]).sort((a, b) => CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence]);
  const decided = findings.filter((f) => decisions[f.id]);
  if (!findings.length && !suggestions.length) return <p className="muted empty-line">{t('noSuggestionsForPerson')}</p>;
  return (
    <div className="person-review">
      {suggestions.length > 0 && (
        <section className="info-card">
          <h3>{t('familySuggestionsTitle')}</h3>
          <SuggestionsList graph={graph} suggestions={suggestions} profiles={profiles} onDecide={onDecideSuggestion} onShowPerson={onShowPerson} />
        </section>
      )}
      {findings.length > 0 && (
        <section className="info-card">
          <h3>{t('researchFindingsTitle')}{pending.length ? ` · ${pending.length}` : ''}</h3>
          {pending.map((f) => <FindingCard key={f.id} f={f} state="pending" waiting={!resolveId(f.personId)} onDecide={onDecide} />)}
          {decided.length > 0 && (
            <details className="rt-decided">
              <summary>{t('decidedEarlier')} · {decided.length}</summary>
              {decided.map((f) => <FindingCard key={f.id} f={f} state={decisions[f.id]} waiting={false} onDecide={onDecide} />)}
            </details>
          )}
        </section>
      )}
    </div>
  );
}
