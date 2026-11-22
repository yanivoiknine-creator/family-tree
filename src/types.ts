export type Sex = 'M' | 'F' | 'U';

/** Partial dates are common: "1963", "1963-10", "1963-10-28". */
export interface LifeEvent {
  date?: string;
  /** about / before / after — for uncertain dates */
  qualifier?: 'about' | 'before' | 'after';
  place?: string;
}

export interface Person {
  id: string;
  /** Names as written in the original records (usually Latin letters). lastName = birth surname. */
  firstName: string;
  lastName: string;
  /** Hebrew spelling, filled in by family members */
  firstNameHe?: string;
  lastNameHe?: string;
  /** Surname after marriage (MyHeritage _MARNM); lastName stays the birth surname */
  marriedName?: string;
  marriedNameHe?: string;
  sex: Sex;
  birth?: LifeEvent;
  death?: LifeEvent & { cause?: string };
  burial?: LifeEvent;
  /** true when the person is known to have died, even without a date */
  deceased: boolean;
  photo?: string;
  bio?: string;
  facts?: { label: string; value: string }[];
  /** Id from the source system (MyHeritage _UID), used for re-imports */
  externalId?: string;
}

/** A couple (or single parent) and their children. */
export interface Union {
  id: string;
  partners: string[];
  children: string[];
  kind: 'married' | 'partners';
  marriage?: LifeEvent;
  divorced?: boolean;
  divorce?: LifeEvent;
  externalId?: string;
}

export interface FamilyData {
  people: Record<string, Person>;
  unions: Record<string, Union>;
}

export type Side = 'all' | 'father' | 'mother';

/** A piece of information found by web research, waiting for approval. */
export interface Finding {
  id: string;
  personId: string;
  personName?: string;
  type: 'field' | 'newPerson';
  /** for type 'field': birth.date, death.place, bio, fact, photo, firstNameHe, ... */
  field?: string;
  /** for type 'newPerson' */
  relation?: 'parent' | 'child' | 'partner' | 'sibling';
  value: unknown;
  current?: unknown;
  confidence: 'high' | 'medium' | 'low';
  sourceTitle?: string;
  sourceUrl?: string;
  note?: string;
}

export type Decision = 'approved' | 'rejected';

/** What we remember about each review decision so it can be undone. */
export interface DecisionRecord {
  d: Decision;
  personBefore?: Person;
  createdIds?: string[];
}
