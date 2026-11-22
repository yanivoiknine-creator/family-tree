import type { LifeEvent, Person, Sex } from '../types';
import type { BloodRel, PartnerStatus, Relation } from './relation';

export type Lang = 'he' | 'fr' | 'en';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'he', label: 'עברית' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];
export const isRtl = (lang: Lang) => lang === 'he';

const he = {
  appTitle: 'אילן היוחסין שלנו',
  searchPlaceholder: 'חיפוש לפי שם…',
  noResults: 'לא נמצאו תוצאות',
  backToMe: 'חזרה אליי',
  sideAll: 'כל המשפחה',
  sideFather: 'צד אבא',
  sideMother: 'צד אמא',
  generationsUp: 'דורות למעלה',
  generationsDown: 'דורות למטה',
  viewingAs: 'צופה בתור',
  admin: 'מנהל',
  devNote: 'מצב בדיקה מקומי. בגרסה החיה כל אחד ייכנס עם החשבון שלו',
  born: 'לידה',
  died: 'פטירה',
  buried: 'קבורה',
  cause: 'סיבה',
  married: 'נישואים',
  divorcedTag: 'גרושים',
  parents: 'הורים',
  partners: 'בני זוג',
  children: 'ילדים',
  siblings: 'אחים ואחיות',
  facts: 'פרטים נוספים',
  bio: 'סיפור חיים',
  edit: 'עריכה',
  save: 'שמירה',
  cancel: 'ביטול',
  delete: 'מחיקה',
  close: 'סגירה',
  confirmDelete: 'למחוק את {name} מהעץ? לא ניתן לבטל.',
  addRelative: 'הוספת קרוב משפחה',
  addParent: 'הורה',
  addPartner: 'בן/בת זוג',
  addChild: 'ילד/ה',
  addSibling: 'אח/אחות',
  newPerson: 'אדם חדש',
  addingAs: 'מוסיפים: {rel} של {name}',
  firstName: 'שם פרטי (לועזית)',
  lastName: 'שם משפחה מלידה (לועזית)',
  firstNameHe: 'שם פרטי (עברית)',
  lastNameHe: 'שם משפחה מלידה (עברית)',
  marriedName: 'שם משפחה אחרי נישואים (לועזית)',
  marriedNameHe: 'שם משפחה אחרי נישואים (עברית)',
  namesHint: 'מספיק למלא שם באחת השפות',
  sex: 'מין',
  male: 'זכר',
  female: 'נקבה',
  unknown: 'לא ידוע',
  date: 'תאריך',
  place: 'מקום',
  dateHint: 'שנה בלבד (1950), חודש (1950-04) או תאריך מלא (1950-04-23)',
  qualifier: 'דיוק',
  exact: 'מדויק',
  about: 'בערך',
  before: 'לפני',
  after: 'אחרי',
  deceased: 'נפטר/ה',
  photo: 'תמונה',
  uploadPhoto: 'העלאת תמונה',
  changePhoto: 'החלפת תמונה',
  removePhoto: 'הסרת תמונה',
  withPartner: 'עם מי?',
  noPartner: 'ללא בן/בת זוג',
  emptyTree: 'העץ עדיין ריק',
  addFirstPerson: 'הוספת האדם הראשון',
  makeCenter: 'הצגת העץ ממנו/ה',
  née: 'לבית',
  bornShort: 'נ׳',
  people: 'אנשים',
  needName: 'צריך למלא לפחות שם פרטי',
  zoomIn: 'הגדלה',
  zoomOut: 'הקטנה',
  fit: 'מרכוז',
  fact_religion: 'דת',
  fact_nationality: 'לאום',
  fact_occupation: 'מקצוע',
  fact_languages: 'שפות',
  hebrewDate: 'תאריך עברי',
  review: "ממצאים לאישור",
  reviewIntro: "מידע ותמונות שנמצאו במחקר ברשת. שום דבר לא נכנס לעץ בלי אישור שלך.",
  pending: "ממתינים",
  approvedTab: "אושרו",
  rejectedTab: "נדחו",
  approve: "אישור",
  reject: "דחייה",
  undo: "ביטול החלטה",
  conf_high: "ביטחון גבוה",
  conf_medium: "ביטחון בינוני",
  conf_low: "ביטחון נמוך",
  source: "מקור",
  current: "כרגע בעץ",
  proposed: "נמצא",
  newRelative: "קרוב משפחה חדש",
  noFindings: "אין כאן ממצאים",
  noResearch: "המחקר עדיין רץ. הממצאים יופיעו כאן כשיסתיים.",
  backToTree: "חזרה לעץ",
  showInTree: "הצגה בעץ",
  applyFailed: "לא ניתן להחיל את הממצא",
  all: "הכל",
  photosOnly: "תמונות ומסמכים",
  editRelationship: "עריכת הקשר",
  relationshipWith: "הקשר עם {name}",
  status: "סטטוס",
  statusMarried: "נשואים",
  statusPartners: "בני זוג (לא נשואים)",
  statusDivorced: "גרושים",
  divorce: "גירושין",
  deleteRelationship: "מחיקת הקשר",
  confirmDeleteRelationship: "למחוק את הקשר בין {a} ל-{b}? האנשים עצמם יישארו בעץ.",
  relationshipHint: "נישואין שניים: מסמנים את הקשר הקודם כ\"גרושים\" ומוסיפים בן/בת זוג חדש/ה",
  map: "מפה",
  tree: "עץ",
  bornHere: "נולדו כאן",
  diedHere: "נפטרו כאן",
  buriedHere: "נקברו כאן",
  marriedHere: "נישאו כאן",
  kind_birth: "לידה",
  kind_death: "פטירה",
  kind_burial: "קבורה",
  kind_marriage: "נישואין",
  lifeRoutes: "מסלולי חיים",
  lifeRoutesHint: "קו מקום הלידה למקום הפטירה",
  placesList: "כל המקומות",
  locating: "מאתר מקומות במפה… ({n})",
  notFound: "לא אותר",
  fixLocation: "תיקון מיקום",
  fixPrompt: "איך לחפש את \"{place}\" במפה? (למשל: עיר, מדינה)",
  fixFailed: "לא נמצא מקום כזה",
  mapEmpty: "אין עדיין מקומות להצגה",
  peopleCount: "{n} אנשים",
  approveFirst: "קודם צריך לאשר את הממצא שמוסיף את {name}",
  undoDependentsFirst: "קודם צריך לבטל את הממצאים שמתבססים על הממצא הזה",
  fromFamily: "מידע מהמשפחה",
  branchCount: "{n} אנשים בענף הזה",
  signInTitle: "ברוכים הבאים לאילן היוחסין של המשפחה",
  signInText: "כדי לראות את העץ צריך להתחבר עם חשבון Google.",
  signInGoogle: "התחברות עם Google",
  signOut: "התנתקות",
  registerTitle: "נעים להכיר! מי את/ה?",
  registerText: "כתבו את השם שלכם ואת שמות ההורים (בעברית או באנגלית), והאתר ימצא אתכם בעץ.",
  fatherName: "שם האב",
  motherName: "שם האם",
  continue: "המשך",
  registerNeedNames: "צריך שם פרטי ושם משפחה, וגם את שמות ההורים",
  attemptsLeft: "נשארו {n} ניסיונות",
  pendingBanner: "הבקשה שלך ממתינה לאישור מנהל. עד אז רואים בעץ רק שמות.",
  fixDetails: "תיקון הפרטים שלי",
  suggestionSent: "ההצעה נשלחה לאישור המנהל. תודה!",
  suggestEdit: "הצעת שינוי",
  suggestHint: "השינויים שלך יישלחו כהצעה, ומנהל יאשר אותם.",
  manage: "ניהול",
  tabSuggestions: "הצעות שינוי",
  tabResearch: "מחקר",
  tabUsers: "משתמשים",
  tabImport: "כלים וגיבוי",
  noSuggestions: "אין הצעות ממתינות",
  history: "היסטוריה",
  suggestedBy: "הוצע על ידי {name}",
  changeNew: "חדש",
  changeDeleted: "נמחק",
  changeEdited: "שונה",
  relationshipOf: "הקשר בין {a} ל{b}",
  role_pending: "ממתין לאישור",
  role_member: "בן/בת משפחה",
  role_admin: "מנהל",
  role: "הרשאה",
  linkedTo: "מקושר ל",
  notLinked: "לא מקושר לאדם בעץ",
  linkPerson: "קישור לאדם בעץ",
  unlink: "ביטול קישור",
  approveUser: "אישור צפייה",
  typedNames: "מה שהקליד/ה בהרשמה",
  you: "את/ה",
  importTitle: "העברת הנתונים מהדפדפן לענן",
  importText: "מעלה ל-Supabase את העץ כפי שהוא שמור בדפדפן הזה (כולל כל העדכונים שלך), את ממצאי המחקר ואת ההחלטות עליהם. רשומות עם אותו מזהה בענן יוחלפו.",
  importButton: "העלאה לענן",
  importDone: "ההעברה הסתיימה. הדף ייטען מחדש.",
  importNothing: "אין בדפדפן הזה נתונים מקומיים להעברה.",
  importCounts: "{people} אנשים, {unions} קשרים, {findings} ממצאי מחקר, {decisions} החלטות",
  loadFailed: "הטעינה נכשלה. נסו לרענן את הדף.",
  saveFailed: "השמירה נכשלה",
  wrongRole: "אין לך הרשאה לפעולה הזאת",
  researchUploadTitle: "ממצאי מחקר חדשים מהמחשב",
  researchUploadText: "נמצאו במחשב הזה {n} ממצאים שעוד לא בענן. ההעלאה מוסיפה רק אותם, לבדיקה בלשונית מחקר. העץ עצמו לא משתנה.",
  researchUploadButton: "העלאת הממצאים החדשים",
  researchUploaded: "{n} ממצאים חדשים הועלו",
  backupTitle: "גיבוי",
  backupText: "הורדת קובץ עם כל העץ, ממצאי המחקר וההחלטות, כפי שהם עכשיו בענן.",
  backupButton: "הורדת גיבוי",
  documents: "תמונות ומסמכים",
  document: "מסמך",
  openGallery: "הצגת הכול",
  addDocument: "הוספת תמונה או מסמך",
  chooseFiles: "בחירת קבצים (תמונות או PDF)",
  docTitlePlaceholder: "תיאור, למשל: תעודת לידה 1896",
  download: "הורדה",
  openNewTab: "פתיחה בחלון חדש",
  backToAll: "חזרה לכל המסמכים",
  confirmDeleteDoc: "למחוק את הקובץ?",
  fileTooBig: "קובץ גדול מ-20MB",
  noDocuments: "עדיין אין תמונות או מסמכים.",
  docsAdded: "הוספת תמונות ומסמכים ל{name}",
  docRemoved: "מחיקת מסמך של {name}",
  uploading: "מעלה…",
  fileDeleted: "הקובץ נמחק מהענן כשהממצא נדחה",
  fileDeleteFailed: "לא הצלחתי למחוק את הקובץ מהענן. ייתכן שחסרה הרשאה ב-Supabase (פקודת ה-SQL של \"admins list photos\").",
  cleanupTitle: "קבצים של ממצאים שנדחו",
  cleanupText: "{n} קבצים של ממצאים שנדחו עדיין שמורים בענן. אף אחד לא משתמש בהם, ואפשר למחוק אותם.",
  cleanupButton: "מחיקת הקבצים",
  cleanupDone: "{n} קבצים נמחקו מהענן",
};
export type MsgKey = keyof typeof he;

const en: Record<MsgKey, string> = {
  appTitle: 'Our Family Tree',
  searchPlaceholder: 'Search by name…',
  noResults: 'No results',
  backToMe: 'Back to me',
  sideAll: 'Whole family',
  sideFather: "Father's side",
  sideMother: "Mother's side",
  generationsUp: 'Generations up',
  generationsDown: 'Generations down',
  viewingAs: 'Viewing as',
  admin: 'Admin',
  devNote: 'Local test mode. In the live site everyone signs in with their own account',
  born: 'Born',
  died: 'Died',
  buried: 'Buried',
  cause: 'Cause',
  married: 'Married',
  divorcedTag: 'Divorced',
  parents: 'Parents',
  partners: 'Partners',
  children: 'Children',
  siblings: 'Siblings',
  facts: 'More details',
  bio: 'Life story',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  close: 'Close',
  confirmDelete: 'Delete {name} from the tree? This cannot be undone.',
  addRelative: 'Add a relative',
  addParent: 'Parent',
  addPartner: 'Partner',
  addChild: 'Child',
  addSibling: 'Sibling',
  newPerson: 'New person',
  addingAs: 'Adding: {rel} of {name}',
  firstName: 'First name (Latin)',
  lastName: 'Birth surname (Latin)',
  firstNameHe: 'First name (Hebrew)',
  lastNameHe: 'Birth surname (Hebrew)',
  marriedName: 'Married surname (Latin)',
  marriedNameHe: 'Married surname (Hebrew)',
  namesHint: 'A name in one script is enough',
  sex: 'Sex',
  male: 'Male',
  female: 'Female',
  unknown: 'Unknown',
  date: 'Date',
  place: 'Place',
  dateHint: 'Year only (1950), month (1950-04) or full date (1950-04-23)',
  qualifier: 'Accuracy',
  exact: 'Exact',
  about: 'About',
  before: 'Before',
  after: 'After',
  deceased: 'Deceased',
  photo: 'Photo',
  uploadPhoto: 'Upload photo',
  changePhoto: 'Change photo',
  removePhoto: 'Remove photo',
  withPartner: 'With whom?',
  noPartner: 'No partner',
  emptyTree: 'The tree is still empty',
  addFirstPerson: 'Add the first person',
  makeCenter: 'View tree from here',
  née: 'née',
  bornShort: 'b.',
  people: 'people',
  needName: 'Please enter at least a first name',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Center',
  fact_religion: 'Religion',
  fact_nationality: 'Nationality',
  fact_occupation: 'Occupation',
  fact_languages: 'Languages',
  hebrewDate: 'Hebrew date',
  review: "Findings to review",
  reviewIntro: "Information and photos found by web research. Nothing enters the tree without your approval.",
  pending: "Pending",
  approvedTab: "Approved",
  rejectedTab: "Rejected",
  approve: "Approve",
  reject: "Reject",
  undo: "Undo decision",
  conf_high: "High confidence",
  conf_medium: "Medium confidence",
  conf_low: "Low confidence",
  source: "Source",
  current: "Now in tree",
  proposed: "Found",
  newRelative: "New relative",
  noFindings: "No findings here",
  noResearch: "Research is still running. Findings will appear here when it finishes.",
  backToTree: "Back to tree",
  showInTree: "Show in tree",
  applyFailed: "Could not apply this finding",
  all: "All",
  photosOnly: "Photos & documents",
  editRelationship: "Edit relationship",
  relationshipWith: "Relationship with {name}",
  status: "Status",
  statusMarried: "Married",
  statusPartners: "Partners (not married)",
  statusDivorced: "Divorced",
  divorce: "Divorce",
  deleteRelationship: "Delete relationship",
  confirmDeleteRelationship: "Delete the relationship between {a} and {b}? Both people stay in the tree.",
  relationshipHint: "Second marriage: mark the earlier relationship as \"Divorced\", then add a new partner",
  map: "Map",
  tree: "Tree",
  bornHere: "Born here",
  diedHere: "Died here",
  buriedHere: "Buried here",
  marriedHere: "Married here",
  kind_birth: "Birth",
  kind_death: "Death",
  kind_burial: "Burial",
  kind_marriage: "Marriage",
  lifeRoutes: "Life journeys",
  lifeRoutesHint: "A line from birthplace to place of death",
  placesList: "All places",
  locating: "Locating places… ({n})",
  notFound: "Not found",
  fixLocation: "Fix location",
  fixPrompt: "How should \"{place}\" be searched on the map? (e.g. city, country)",
  fixFailed: "No such place found",
  mapEmpty: "No places to show yet",
  peopleCount: "{n} people",
  approveFirst: "First approve the finding that adds {name}",
  undoDependentsFirst: "First undo the findings that build on this one",
  fromFamily: "Family knowledge",
  branchCount: "{n} people in this branch",
  signInTitle: "Welcome to our family tree",
  signInText: "Sign in with your Google account to see the tree.",
  signInGoogle: "Sign in with Google",
  signOut: "Sign out",
  registerTitle: "Nice to meet you! Who are you?",
  registerText: "Type your name and your parents' names (in Hebrew or English) and the site will find you in the tree.",
  fatherName: "Father's name",
  motherName: "Mother's name",
  continue: "Continue",
  registerNeedNames: "Please fill in your first and last name and your parents' names",
  attemptsLeft: "{n} attempts left",
  pendingBanner: "Your request is waiting for an admin. Until then the tree shows names only.",
  fixDetails: "Fix my details",
  suggestionSent: "Your suggestion was sent to the admin. Thank you!",
  suggestEdit: "Suggest a change",
  suggestHint: "Your changes are sent as a suggestion for an admin to approve.",
  manage: "Admin",
  tabSuggestions: "Suggestions",
  tabResearch: "Research",
  tabUsers: "Users",
  tabImport: "Tools & backup",
  noSuggestions: "No pending suggestions",
  history: "History",
  suggestedBy: "Suggested by {name}",
  changeNew: "New",
  changeDeleted: "Deleted",
  changeEdited: "Changed",
  relationshipOf: "Relationship of {a} and {b}",
  role_pending: "Waiting for approval",
  role_member: "Family member",
  role_admin: "Admin",
  role: "Role",
  linkedTo: "Linked to",
  notLinked: "Not linked to a person",
  linkPerson: "Link to a person",
  unlink: "Unlink",
  approveUser: "Allow viewing",
  typedNames: "What they typed when registering",
  you: "you",
  importTitle: "Move the data from this browser to the cloud",
  importText: "Uploads to Supabase the tree saved in this browser (including all your edits), the research findings and your decisions on them. Cloud records with the same id are replaced.",
  importButton: "Upload to cloud",
  importDone: "Done. The page will reload.",
  importNothing: "This browser has no local data to move.",
  importCounts: "{people} people, {unions} relationships, {findings} research findings, {decisions} decisions",
  loadFailed: "Loading failed. Try refreshing the page.",
  saveFailed: "Saving failed",
  wrongRole: "You are not allowed to do this",
  researchUploadTitle: "New research findings from this computer",
  researchUploadText: "This computer has {n} findings that are not in the cloud yet. Uploading adds only them, for review in the Research tab. The tree itself is not changed.",
  researchUploadButton: "Upload the new findings",
  researchUploaded: "{n} new findings uploaded",
  backupTitle: "Backup",
  backupText: "Download a file with the whole tree, the research findings and the decisions, as they are in the cloud now.",
  backupButton: "Download backup",
  documents: "Photos & documents",
  document: "Document",
  openGallery: "Show all",
  addDocument: "Add a photo or document",
  chooseFiles: "Choose files (pictures or PDF)",
  docTitlePlaceholder: "Description, e.g. Birth certificate 1896",
  download: "Download",
  openNewTab: "Open in a new tab",
  backToAll: "Back to all",
  confirmDeleteDoc: "Delete this file?",
  fileTooBig: "File larger than 20MB",
  noDocuments: "No photos or documents yet.",
  docsAdded: "Photos and documents added to {name}",
  docRemoved: "Document of {name} deleted",
  uploading: "Uploading…",
  fileDeleted: "The file was deleted from the cloud when this finding was rejected",
  fileDeleteFailed: "Could not delete the file from the cloud. A Supabase permission may be missing (the \"admins list photos\" SQL).",
  cleanupTitle: "Files of rejected findings",
  cleanupText: "{n} files of rejected findings are still stored in the cloud. Nothing uses them, so they can be deleted.",
  cleanupButton: "Delete the files",
  cleanupDone: "{n} files deleted from the cloud",
};

const fr: Record<MsgKey, string> = {
  appTitle: 'Notre arbre généalogique',
  searchPlaceholder: 'Rechercher un nom…',
  noResults: 'Aucun résultat',
  backToMe: 'Revenir à moi',
  sideAll: 'Toute la famille',
  sideFather: 'Côté paternel',
  sideMother: 'Côté maternel',
  generationsUp: 'Générations au-dessus',
  generationsDown: 'Générations en dessous',
  viewingAs: 'Vu par',
  admin: 'Admin',
  devNote: 'Mode test local. Sur le site en ligne, chacun se connecte avec son propre compte',
  born: 'Naissance',
  died: 'Décès',
  buried: 'Inhumation',
  cause: 'Cause',
  married: 'Mariage',
  divorcedTag: 'Divorcés',
  parents: 'Parents',
  partners: 'Conjoints',
  children: 'Enfants',
  siblings: 'Frères et sœurs',
  facts: 'Autres informations',
  bio: 'Histoire de vie',
  edit: 'Modifier',
  save: 'Enregistrer',
  cancel: 'Annuler',
  delete: 'Supprimer',
  close: 'Fermer',
  confirmDelete: "Supprimer {name} de l'arbre ? Action irréversible.",
  addRelative: 'Ajouter un proche',
  addParent: 'Parent',
  addPartner: 'Conjoint(e)',
  addChild: 'Enfant',
  addSibling: 'Frère/sœur',
  newPerson: 'Nouvelle personne',
  addingAs: 'Ajout : {rel} de {name}',
  firstName: 'Prénom (latin)',
  lastName: 'Nom de naissance (latin)',
  firstNameHe: 'Prénom (hébreu)',
  lastNameHe: 'Nom de naissance (hébreu)',
  marriedName: "Nom d'épouse/époux (latin)",
  marriedNameHe: "Nom d'épouse/époux (hébreu)",
  namesHint: 'Un nom dans une seule écriture suffit',
  sex: 'Sexe',
  male: 'Homme',
  female: 'Femme',
  unknown: 'Inconnu',
  date: 'Date',
  place: 'Lieu',
  dateHint: 'Année seule (1950), mois (1950-04) ou date complète (1950-04-23)',
  qualifier: 'Précision',
  exact: 'Exacte',
  about: 'Vers',
  before: 'Avant',
  after: 'Après',
  deceased: 'Décédé(e)',
  photo: 'Photo',
  uploadPhoto: 'Ajouter une photo',
  changePhoto: 'Changer la photo',
  removePhoto: 'Retirer la photo',
  withPartner: 'Avec qui ?',
  noPartner: 'Sans conjoint',
  emptyTree: "L'arbre est encore vide",
  addFirstPerson: 'Ajouter la première personne',
  makeCenter: "Voir l'arbre depuis cette personne",
  née: 'née',
  bornShort: 'né(e)',
  people: 'personnes',
  needName: 'Veuillez saisir au moins un prénom',
  zoomIn: 'Zoom avant',
  zoomOut: 'Zoom arrière',
  fit: 'Centrer',
  fact_religion: 'Religion',
  fact_nationality: 'Nationalité',
  fact_occupation: 'Profession',
  fact_languages: 'Langues',
  hebrewDate: 'Date hébraïque',
  review: "Découvertes à valider",
  reviewIntro: "Informations et photos trouvées en ligne. Rien n'entre dans l'arbre sans votre accord.",
  pending: "En attente",
  approvedTab: "Acceptées",
  rejectedTab: "Refusées",
  approve: "Accepter",
  reject: "Refuser",
  undo: "Annuler la décision",
  conf_high: "Fiabilité élevée",
  conf_medium: "Fiabilité moyenne",
  conf_low: "Fiabilité faible",
  source: "Source",
  current: "Dans l'arbre",
  proposed: "Trouvé",
  newRelative: "Nouveau proche",
  noFindings: "Aucune découverte ici",
  noResearch: "La recherche est en cours. Les découvertes apparaîtront ici.",
  backToTree: "Retour à l'arbre",
  showInTree: "Voir dans l'arbre",
  applyFailed: "Impossible d'appliquer cette découverte",
  all: "Tout",
  photosOnly: "Photos et documents",
  editRelationship: "Modifier la relation",
  relationshipWith: "Relation avec {name}",
  status: "Statut",
  statusMarried: "Mariés",
  statusPartners: "En couple (non mariés)",
  statusDivorced: "Divorcés",
  divorce: "Divorce",
  deleteRelationship: "Supprimer la relation",
  confirmDeleteRelationship: "Supprimer la relation entre {a} et {b} ? Les deux personnes restent dans l'arbre.",
  relationshipHint: "Remariage : indiquez la relation précédente comme « Divorcés », puis ajoutez un nouveau conjoint",
  map: "Carte",
  tree: "Arbre",
  bornHere: "Nés ici",
  diedHere: "Décédés ici",
  buriedHere: "Inhumés ici",
  marriedHere: "Mariés ici",
  kind_birth: "Naissance",
  kind_death: "Décès",
  kind_burial: "Inhumation",
  kind_marriage: "Mariage",
  lifeRoutes: "Parcours de vie",
  lifeRoutesHint: "Une ligne du lieu de naissance au lieu de décès",
  placesList: "Tous les lieux",
  locating: "Localisation des lieux… ({n})",
  notFound: "Introuvable",
  fixLocation: "Corriger le lieu",
  fixPrompt: "Comment rechercher « {place} » sur la carte ? (ex. ville, pays)",
  fixFailed: "Lieu introuvable",
  mapEmpty: "Aucun lieu à afficher pour l'instant",
  peopleCount: "{n} personnes",
  approveFirst: "Validez d'abord la découverte qui ajoute {name}",
  undoDependentsFirst: "Annulez d'abord les découvertes qui dépendent de celle-ci",
  fromFamily: "Information familiale",
  branchCount: "{n} personnes dans cette branche",
  signInTitle: "Bienvenue dans notre arbre généalogique",
  signInText: "Connectez-vous avec votre compte Google pour voir l'arbre.",
  signInGoogle: "Se connecter avec Google",
  signOut: "Se déconnecter",
  registerTitle: "Enchanté ! Qui êtes-vous ?",
  registerText: "Indiquez votre nom et celui de vos parents (en hébreu ou en français) et le site vous retrouvera dans l'arbre.",
  fatherName: "Prénom du père",
  motherName: "Prénom de la mère",
  continue: "Continuer",
  registerNeedNames: "Indiquez votre prénom, votre nom et les prénoms de vos parents",
  attemptsLeft: "Encore {n} essais",
  pendingBanner: "Votre demande attend la validation d'un administrateur. En attendant, l'arbre n'affiche que les noms.",
  fixDetails: "Corriger mes informations",
  suggestionSent: "Votre suggestion a été envoyée à l'administrateur. Merci !",
  suggestEdit: "Suggérer une modification",
  suggestHint: "Vos modifications sont envoyées comme suggestion et validées par un administrateur.",
  manage: "Administration",
  tabSuggestions: "Suggestions",
  tabResearch: "Recherche",
  tabUsers: "Utilisateurs",
  tabImport: "Outils et sauvegarde",
  noSuggestions: "Aucune suggestion en attente",
  history: "Historique",
  suggestedBy: "Suggéré par {name}",
  changeNew: "Nouveau",
  changeDeleted: "Supprimé",
  changeEdited: "Modifié",
  relationshipOf: "Relation entre {a} et {b}",
  role_pending: "En attente",
  role_member: "Membre de la famille",
  role_admin: "Administrateur",
  role: "Rôle",
  linkedTo: "Lié à",
  notLinked: "Non lié à une personne",
  linkPerson: "Lier à une personne",
  unlink: "Délier",
  approveUser: "Autoriser la consultation",
  typedNames: "Ce qui a été saisi à l'inscription",
  you: "vous",
  importTitle: "Transférer les données de ce navigateur vers le cloud",
  importText: "Envoie vers Supabase l'arbre enregistré dans ce navigateur (avec toutes vos modifications), les résultats de recherche et vos décisions. Les fiches du cloud avec le même identifiant sont remplacées.",
  importButton: "Envoyer vers le cloud",
  importDone: "Terminé. La page va se recharger.",
  importNothing: "Ce navigateur n'a pas de données locales à transférer.",
  importCounts: "{people} personnes, {unions} relations, {findings} résultats de recherche, {decisions} décisions",
  loadFailed: "Le chargement a échoué. Rechargez la page.",
  saveFailed: "L'enregistrement a échoué",
  wrongRole: "Vous n'avez pas le droit de faire cela",
  researchUploadTitle: "Nouveaux résultats de recherche sur cet ordinateur",
  researchUploadText: "Cet ordinateur a {n} résultats qui ne sont pas encore dans le cloud. L'envoi n'ajoute qu'eux, à vérifier dans l'onglet Recherche. L'arbre lui-même ne change pas.",
  researchUploadButton: "Envoyer les nouveaux résultats",
  researchUploaded: "{n} nouveaux résultats envoyés",
  backupTitle: "Sauvegarde",
  backupText: "Télécharger un fichier avec tout l'arbre, les résultats de recherche et les décisions, tels qu'ils sont dans le cloud.",
  backupButton: "Télécharger la sauvegarde",
  documents: "Photos et documents",
  document: "Document",
  openGallery: "Tout afficher",
  addDocument: "Ajouter une photo ou un document",
  chooseFiles: "Choisir des fichiers (images ou PDF)",
  docTitlePlaceholder: "Description, ex. : acte de naissance 1896",
  download: "Télécharger",
  openNewTab: "Ouvrir dans un nouvel onglet",
  backToAll: "Retour à la liste",
  confirmDeleteDoc: "Supprimer ce fichier ?",
  fileTooBig: "Fichier de plus de 20 Mo",
  noDocuments: "Pas encore de photos ni de documents.",
  docsAdded: "Photos et documents ajoutés à {name}",
  docRemoved: "Document de {name} supprimé",
  uploading: "Envoi…",
  fileDeleted: "Le fichier a été supprimé du cloud quand ce résultat a été rejeté",
  fileDeleteFailed: "Impossible de supprimer le fichier du cloud. Une autorisation Supabase manque peut-être (le SQL « admins list photos »).",
  cleanupTitle: "Fichiers des résultats rejetés",
  cleanupText: "{n} fichiers de résultats rejetés sont encore stockés dans le cloud. Rien ne les utilise : ils peuvent être supprimés.",
  cleanupButton: "Supprimer les fichiers",
  cleanupDone: "{n} fichiers supprimés du cloud",
};

const DICTS: Record<Lang, Record<MsgKey, string>> = { he, en, fr };

export function translate(lang: Lang, key: MsgKey, vars?: Record<string, string>): string {
  let s = DICTS[lang][key] ?? he[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

export function factLabel(lang: Lang, label: string): string {
  const key = `fact_${label}` as MsgKey;
  return key in he ? translate(lang, key) : label;
}

/* ---------------- Names ---------------- */

export function nameParts(p: Person, lang: Lang) {
  const pick = (latin?: string, heb?: string) => (lang === 'he' ? heb || latin : latin || heb) || '';
  const first = pick(p.firstName, p.firstNameHe);
  const birthLast = pick(p.lastName, p.lastNameHe);
  const marriedLast = pick(p.marriedName, p.marriedNameHe);
  return { first, last: marriedLast || birthLast, née: marriedLast ? birthLast : '' };
}

export function displayName(p: Person, lang: Lang): string {
  const { first, last } = nameParts(p, lang);
  return `${first} ${last}`.trim() || '?';
}

/** Every spelling of the name, for search. */
export function searchText(p: Person): string {
  return [p.firstName, p.lastName, p.firstNameHe, p.lastNameHe, p.marriedName, p.marriedNameHe]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/* ---------------- Dates ---------------- */

const LOCALE: Record<Lang, string> = { he: 'he-IL', fr: 'fr-FR', en: 'en-GB' };

export function formatDate(ev: LifeEvent | undefined, lang: Lang): string {
  if (!ev?.date) return '';
  const [y, m, d] = ev.date.split('-').map(Number);
  let text: string;
  if (!m) text = String(y);
  else {
    const dt = new Date(Date.UTC(y, m - 1, d || 1));
    text = new Intl.DateTimeFormat(LOCALE[lang], {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      ...(d ? { day: 'numeric' } : {}),
    }).format(dt);
  }
  return ev.qualifier ? `${translate(lang, ev.qualifier)} ${text}` : text;
}

const HEB_UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const HEB_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HEB_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

function gematria(n: number): string {
  let s = HEB_HUNDREDS[Math.floor(n / 100)] ?? '';
  const rest = n % 100;
  if (rest === 15) s += 'טו';
  else if (rest === 16) s += 'טז';
  else s += HEB_TENS[Math.floor(rest / 10)] + HEB_UNITS[rest % 10];
  return s.length > 1 ? `${s.slice(0, -1)}״${s.slice(-1)}` : `${s}׳`;
}

/** Full Hebrew-calendar date, e.g. "כ״ב באלול תרע״ב". Only for exact full dates. */
export function hebrewDate(ev: LifeEvent | undefined): string {
  if (!ev?.date || ev.qualifier) return '';
  const [y, m, d] = ev.date.split('-').map(Number);
  if (!m || !d) return '';
  const parts = new Intl.DateTimeFormat('he-u-ca-hebrew', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = Number(get('day'));
  const year = Number(get('year')) % 1000;
  return `${gematria(day)} ${get('month')} ${gematria(year)}`;
}

export function lifeSpan(p: Person, lang: Lang): string {
  const by = p.birth?.date?.slice(0, 4);
  const dy = p.death?.date?.slice(0, 4);
  if (!p.deceased) return by ? `${translate(lang, 'bornShort')} ${by}` : '';
  if (!by && !dy) return '';
  // LTR isolate so the range reads "1912–1990" inside Hebrew text too
  return `⁦${by ?? '?'}–${dy ?? '?'}⁩`;
}

/* ---------------- Relationship words ---------------- */

type G = (sex: Sex, m: string, f: string, n?: string) => string;
const g: G = (sex, m, f, n) => (sex === 'M' ? m : sex === 'F' ? f : n ?? `${m}/${f}`);

function heBlood(r: BloodRel, t: Sex): string {
  const { a, b } = r;
  const s1 = r.s1 ?? 'U';
  const s2 = r.s2 ?? 'U';
  const anc = (n: number, s: Sex) =>
    n === 1 ? g(s, 'אבא', 'אמא')
      : n === 2 ? g(s, 'סבא', 'סבתא')
      : n === 3 ? g(s, 'סבא רבא', 'סבתא רבתא')
      : n === 4 ? g(s, 'סבא רבא רבא', 'סבתא רבתא רבתא')
      : `${g(s, 'אב קדמון', 'אם קדמונית')} (דור ${n})`;
  const desc = (n: number, s: Sex) =>
    n === 1 ? g(s, 'בן', 'בת') : n === 2 ? g(s, 'נכד', 'נכדה') : n === 3 ? g(s, 'נין', 'נינה') : `${g(s, 'צאצא', 'צאצאית')} (דור ${n})`;
  const sib = (s: Sex, half?: boolean) => g(s, 'אח', 'אחות') + (half ? ' למחצה' : '');
  const cousin = (s: Sex, via: Sex) => `${g(s, 'בן', 'בת')} ${via === 'F' ? 'דודה' : 'דוד'}`;
  if (a === 0) return desc(b, t);
  if (b === 0) return anc(a, t);
  if (a === 1) return b === 1 ? sib(t, r.half) : b === 2 ? g(t, 'אחיין', 'אחיינית') : `${desc(b - 1, t)} של ${sib(s1, r.half)}`;
  if (a === 2) return b === 1 ? g(t, 'דוד', 'דודה') : b === 2 ? cousin(t, s1) : `${desc(b - 2, t)} של ${cousin(s2, s1)}`;
  if (b === 1) return `${g(t, 'אח', 'אחות')} של ${anc(a - 1, s2)}`;
  if (b === 2) return `${g(t, 'בן', 'בת')} של ${g(s1, 'אח', 'אחות')} של ${anc(a - 1, s2)}`;
  const ord = ['', '', 'שני', 'שלישי', 'רביעי'][a - 1];
  if (a === b && ord) return `${g(t, 'בן דוד', 'בת דודה')} ${g(t, ord, ord + 'ת')}`;
  return g(t, 'קרוב משפחה', 'קרובת משפחה');
}

function enBlood(r: BloodRel, t: Sex): string {
  const { a, b } = r;
  const greats = (n: number) => (n <= 0 ? '' : n <= 2 ? 'great-'.repeat(n) : `${n}× great-`);
  if (a === 0) return b === 1 ? g(t, 'son', 'daughter', 'child') : greats(b - 2) + g(t, 'grandson', 'granddaughter', 'grandchild');
  if (b === 0) return a === 1 ? g(t, 'father', 'mother', 'parent') : greats(a - 2) + g(t, 'grandfather', 'grandmother', 'grandparent');
  if (a === 1 && b === 1) return (r.half ? 'half-' : '') + g(t, 'brother', 'sister', 'sibling');
  if (a === 1) return greats(b - 2) + g(t, 'nephew', 'niece', 'nibling');
  if (b === 1) return greats(a - 2) + g(t, 'uncle', 'aunt', 'aunt/uncle');
  const degree = Math.min(a, b) - 1;
  const removed = Math.abs(a - b);
  const ord = ['', '', 'second ', 'third ', 'fourth ', 'fifth '][degree] ?? `${degree}th `;
  const rem = removed === 0 ? '' : removed === 1 ? ' once removed' : removed === 2 ? ' twice removed' : ` ${removed}× removed`;
  return `${ord}cousin${rem}`;
}

function frBlood(r: BloodRel, t: Sex): string {
  const { a, b } = r;
  const arr = (n: number) => 'arrière-'.repeat(Math.max(0, n));
  if (a === 0) return b === 1 ? g(t, 'fils', 'fille', 'enfant') : arr(b - 2) + g(t, 'petit-fils', 'petite-fille', 'petit-enfant');
  if (b === 0) return a === 1 ? g(t, 'père', 'mère', 'parent') : arr(a - 2) + g(t, 'grand-père', 'grand-mère', 'grand-parent');
  if (a === 1 && b === 1) return (r.half ? 'demi-' : '') + g(t, 'frère', 'sœur');
  if (a === 1) return b === 2 ? g(t, 'neveu', 'nièce') : arr(b - 3) + g(t, 'petit-neveu', 'petite-nièce');
  if (b === 1) return a === 2 ? g(t, 'oncle', 'tante') : arr(a - 3) + g(t, 'grand-oncle', 'grand-tante');
  if (a === 2 && b === 2) return g(t, 'cousin germain', 'cousine germaine');
  if (a === 3 && b === 3) return g(t, 'cousin issu de germain', 'cousine issue de germain');
  if (a === 2 && b === 3) return g(t, 'petit-cousin', 'petite-cousine');
  return g(t, 'cousin éloigné', 'cousine éloignée');
}

function partnerWord(lang: Lang, s: Sex, status: PartnerStatus, possessive: boolean): string {
  if (lang === 'he') {
    if (status === 'divorced') return possessive ? g(s, 'גרושי', 'גרושתי') : g(s, 'גרוש', 'גרושה');
    if (status === 'partners') return possessive ? g(s, 'בן זוגי', 'בת זוגי') : g(s, 'בן זוג', 'בת זוג');
    return possessive ? g(s, 'בעלי', 'אשתי') : g(s, 'בעל', 'אשה');
  }
  if (lang === 'fr') {
    const w = status === 'divorced' ? g(s, 'ex-mari', 'ex-femme', 'ex-conjoint') : status === 'partners' ? g(s, 'compagnon', 'compagne') : g(s, 'mari', 'femme', 'conjoint');
    return possessive ? `${s === 'F' && !w.startsWith('ex') ? 'ma' : 'mon'} ${w}` : w;
  }
  const w = status === 'divorced' ? g(s, 'ex-husband', 'ex-wife', 'ex-spouse') : status === 'partners' ? 'partner' : g(s, 'husband', 'wife', 'spouse');
  return w;
}

export function relationLabel(rel: Relation | undefined, lang: Lang): string {
  if (!rel) return '';
  const { kind, sex: t, viewerSex: v } = rel;
  const blood = lang === 'he' ? heBlood : lang === 'fr' ? frBlood : enBlood;
  switch (kind.k) {
    case 'self': return { he: 'אני', fr: 'Moi', en: 'Me' }[lang];
    case 'partner': return partnerWord(lang, t, kind.status, false);
    case 'blood': return blood(kind, t);
    case 'parentInLaw':
      if (lang === 'he') return t === 'M' ? (v === 'F' ? 'חם' : 'חותן') : (v === 'F' ? 'חמות' : 'חותנת');
      return lang === 'fr' ? g(t, 'beau-père', 'belle-mère') : g(t, 'father-in-law', 'mother-in-law', 'parent-in-law');
    case 'childInLaw':
      return lang === 'he' ? g(t, 'חתן', 'כלה') : lang === 'fr' ? g(t, 'gendre', 'belle-fille') : g(t, 'son-in-law', 'daughter-in-law', 'child-in-law');
    case 'siblingInLaw':
      return lang === 'he' ? g(t, 'גיס', 'גיסה') : lang === 'fr' ? g(t, 'beau-frère', 'belle-sœur') : g(t, 'brother-in-law', 'sister-in-law', 'sibling-in-law');
    case 'stepParent':
      return lang === 'he' ? g(t, 'אבא חורג', 'אמא חורגת') : lang === 'fr' ? g(t, 'beau-père', 'belle-mère') : g(t, 'stepfather', 'stepmother', 'step-parent');
    case 'stepChild':
      return lang === 'he' ? g(t, 'בן חורג', 'בת חורגת') : lang === 'fr' ? g(t, 'beau-fils', 'belle-fille') : g(t, 'stepson', 'stepdaughter', 'stepchild');
    case 'stepSibling':
      return lang === 'he' ? g(t, 'אח חורג', 'אחות חורגת') : lang === 'fr' ? g(t, 'quasi-frère', 'quasi-sœur') : g(t, 'stepbrother', 'stepsister', 'stepsibling');
    case 'auntUncleByMarriage':
      return lang === 'he' ? g(t, 'דוד', 'דודה') : lang === 'fr' ? g(t, 'oncle', 'tante') : g(t, 'uncle', 'aunt');
    case 'ofPartner': {
      const inner = blood(kind.inner, t);
      const pw = partnerWord(lang, kind.partnerSex, kind.status, true);
      if (lang === 'he') return `${inner} של ${pw}`;
      if (lang === 'fr') return `${inner} de ${pw}`;
      return `${pw}'s ${inner}`;
    }
    case 'partnerOf': {
      const inner = blood(kind.inner, kind.innerSex);
      if (lang === 'he') return `${g(t, 'בעלה', 'אשתו', 'בן/בת הזוג')} של ${inner}`;
      if (lang === 'fr') {
        const poss = kind.innerSex === 'F' && !/^[aeiouéèêh]/i.test(inner) ? 'ma' : 'mon';
        return `${g(t, 'mari', 'femme', 'conjoint')} de ${poss} ${inner}`;
      }
      return `${inner}'s ${g(t, 'husband', 'wife', 'partner')}`;
    }
    case 'relative':
      return lang === 'he' ? g(t, 'קרוב משפחה', 'קרובת משפחה') : lang === 'fr' ? 'membre de la famille' : 'relative';
  }
}
