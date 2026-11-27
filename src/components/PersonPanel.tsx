import type { ReactNode } from 'react';
import type { Person } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { RelationFinder } from '../lib/relation';
import type { RelativeKind } from '../lib/ops';
import { MobileSheet } from './PersonSheet';
import { useIsMobile } from '../lib/useMobile';

export interface Props {
  graph: FamilyGraph;
  person: Person;
  relations: RelationFinder | undefined;
  isAdmin: boolean;
  /** edit = change directly, suggest = changes go to an admin, none = names-only viewer */
  editMode: 'edit' | 'suggest' | 'none';
  onOpen: (id: string) => void;
  onEdit: () => void;
  onEditUnion: (unionId: string) => void;
  onAdd: (kind: RelativeKind) => void;
  onDelete: () => void;
  onClose: () => void;
  /** open the photos & documents gallery */
  onDocuments: (index?: number, adding?: boolean) => void;
  /** admins: a "suggestions" tab with what waits for approval about this person */
  review?: { count: number; content: ReactNode };
}

/** The selected person: a sheet over the tree on a phone, a panel beside the tree on a computer. */
export function PersonPanel(props: Props) {
  const mobile = useIsMobile();
  return <MobileSheet {...props} variant={mobile ? 'mobile' : 'side'} />;
}
