import { TUTOR_LANGUAGE_LABELS } from "@/lib/tutor/languages";

export type FeatureStatus = "live" | "soon";

export type LandingFeature = {
  title: string;
  body: string;
  status: FeatureStatus;
};

export const LANDING_FEATURES: LandingFeature[] = [
  {
    title: "Handwriting to digital text",
    body: "Photograph a notebook page. Cloud reading turns handwriting into text you can edit; on-device reading works offline for printed text.",
    status: "live",
  },
  {
    title: "Export PDF and Word",
    body: "Download a subject or topic as a PDF or Word file from your Library when you need a printout or shareable file.",
    status: "live",
  },
  {
    title: "Listen to your notes",
    body: "Play reviewed pages aloud with speed control and a sticky mini-player while you walk or revise.",
    status: "live",
  },
  {
    title: "Note Tutor chat",
    body: "Ask questions in text. Answers come from your notes and show which page they used.",
    status: "live",
  },
  {
    title: "Live Tutor voice",
    body: "A full-screen voice conversation with an animated orb. Speak or type; it answers from your notes.",
    status: "live",
  },
  {
    title: "Practice questions from your notes",
    body: "Generate multiple-choice quizzes from digitised pages, with explanations and weak-topic feedback.",
    status: "live",
  },
  {
    title: "Exam-style practice",
    body: "Upload JAMB, WAEC, NECO, or Junior WAEC past papers to shape new questions in that style — still from your notes.",
    status: "live",
  },
  {
    title: "Google Drive backup",
    body: "Optional backup to a NoteWise folder you control. Scope is drive.file only — files NoteWise created.",
    status: "live",
  },
  {
    title: "Works offline once installed",
    body: "Install as a PWA. The app shell, fonts, and embedding model stay cached; AI calls need internet when you use them.",
    status: "live",
  },
];

export const HOW_STEPS = [
  {
    n: "01",
    title: "Scan a page",
    body: "Take a photo or pick from your gallery. Crop close to the writing, then choose a subject and topic.",
    image: "/landing/scan.webp",
    alt: "NoteWise Scan screen with Take photo and Choose from gallery buttons",
    width: 390,
    height: 844,
  },
  {
    n: "02",
    title: "Check the text",
    body: "You stay in charge. Fix flagged words or edit the full text before anything is used for study.",
    image: "/landing/review.webp",
    alt: "NoteWise Review screen with photo and editable text side by side",
    width: 390,
    height: 844,
  },
  {
    n: "03",
    title: "Study",
    body: "Listen, ask the Tutor, or practise with quizzes built from your own notes.",
    image: "/landing/practice.webp",
    alt: "NoteWise Practice screen for generating questions from notes",
    width: 390,
    height: 844,
  },
  {
    n: "04",
    title: "Back up",
    body: "Optionally back up to your own Google Drive. NoteWise only sees files it created.",
    image: "/landing/library.webp",
    alt: "NoteWise Library screen showing subjects on this device",
    width: 390,
    height: 844,
  },
] as const;

export const PROBLEM_CARDS = [
  {
    title: "Pages get lost",
    body: "Torn notebooks and missing sheets mean the work you already did disappears before the exam.",
  },
  {
    title: "You cannot search ink",
    body: "Finding one definition in a stack of books takes forever when everything is only on paper.",
  },
  {
    title: "Revision stays quiet",
    body: "Handwritten notes rarely become audio, quizzes, or a tutor that answers from what you wrote.",
  },
] as const;

export const AUDIENCE = [
  { title: "JSS students", body: "Digitise class notes early and listen back while you revise.", status: "live" as const },
  { title: "SS students", body: "Keep WAEC and NECO subjects organised by topic on your phone.", status: "live" as const },
  {
    title: "JAMB / WAEC / NECO candidates",
    body: "Practise from your notes in exam-style formats after you upload a past paper.",
    status: "live" as const,
  },
  {
    title: "Competitions and grants",
    body: "Build a clear digital trail of your own notes when you prepare for contests or scholarship work.",
    status: "live" as const,
  },
  {
    title: "Teachers",
    body: "Classroom tools for teachers are not shipping yet. The student app is the focus for now.",
    status: "soon" as const,
  },
];

export const FAQ_ITEMS = [
  {
    q: "Is it free?",
    a: "Yes. NoteWise is free to use. It relies on free and open-source tools, plus free-tier AI services behind a swappable adapter. Those cloud tiers have their own rate limits and terms.",
  },
  {
    q: "Do I need an account?",
    a: "No. Your name stays on this device in local storage. Google sign-in is only optional for Drive backup.",
  },
  {
    q: "Where are my notes stored?",
    a: "In IndexedDB in your browser on this phone or computer. Nothing is uploaded unless you choose cloud reading, Tutor, quiz generation, or Drive backup.",
  },
  {
    q: "Can I use it without internet?",
    a: "After you install the PWA, the shell and many screens work offline. Cloud handwriting reading, Tutor answers, and new quiz generation need a connection. On-device reading and Listen can still help when you are offline.",
  },
  {
    q: "Why does it ask me to check the text?",
    a: "Handwriting is hard for any reader. You review and correct every page before it is used for search, Tutor, or practice so mistakes do not quietly spread.",
  },
  {
    q: "Which exams does it support?",
    a: "Exam-style practice supports JAMB, WAEC, NECO, and Junior WAEC presets. Questions are still generated from your notes, shaped by a past-paper profile you upload.",
  },
  {
    q: "Which languages?",
    a: `The app UI is English. Tutor explanations can be set to ${Object.values(TUTOR_LANGUAGE_LABELS).join(", ")} (Beta). Spoken Tutor replies need a matching voice on the device; technical terms stay in English brackets.`,
  },
  {
    q: "Who built it?",
    a: "NoteWise AI is built by Diamond Global Academy. See the About section for more.",
  },
] as const;

export const HERO_SHOT = {
  src: "/landing/home.webp",
  alt: "NoteWise Home screen greeting a student with My NoteWise",
  width: 390,
  height: 844,
  /** Demo/sample notebook data — replace with your own notes when ready. */
  demoData: true,
} as const;
