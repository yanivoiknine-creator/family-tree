/**
 * Material Symbols (Rounded), loaded from Google Fonts in index.html with only the icons below.
 * Adding an icon: add its Material name to NAMES here AND to the icon_names list in index.html.
 */
const NAMES: Record<string, string> = {
  tree: 'account_tree',
  map: 'map',
  search: 'search',
  close: 'close',
  back: 'chevron_left',
  forward: 'chevron_right',
  arrowBack: 'arrow_back',
  arrowForward: 'arrow_forward',
  up: 'expand_less',
  down: 'expand_more',
  filter: 'tune',
  target: 'my_location',
  image: 'photo_library',
  doc: 'description',
  pencil: 'edit',
  userPlus: 'person_add',
  manage: 'inbox',
  globe: 'translate',
  signOut: 'logout',
  download: 'download',
  share: 'share',
  external: 'open_in_new',
  trash: 'delete',
  plus: 'add',
  minus: 'remove',
  menu: 'menu',
  check: 'check',
  person: 'person',
  more: 'more_vert',
  addPhoto: 'add_photo_alternate',
  camera: 'photo_camera',
  badge: 'badge',
  fit: 'fit_screen',
};

export function Icon({ name, size = 24, className, filled }: { name: string; size?: number; className?: string; filled?: boolean }) {
  return (
    <span className={`ms${filled ? ' fill' : ''}${className ? ` ${className}` : ''}`} style={{ fontSize: size }} aria-hidden="true">
      {NAMES[name] ?? name}
    </span>
  );
}

export function MoreDots({ size = 24 }: { size?: number }) {
  return <Icon name="more" size={size} />;
}
