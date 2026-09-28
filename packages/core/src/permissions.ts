/** Pre-permission sheet copy (mockup 7a), shared by web and mobile so the explanation is the same everywhere. */
export type Capability = "location" | "microphone" | "camera";

export interface PermissionCopy {
  title: string;
  lead: (context?: string) => string;
  points: string[];
  allow: string;
  decline: string;
  /** What comes next: the OS/browser prompt. `os` is "iOS", "Android" or "your browser". */
  after: (os: string) => string;
}

export const PERMISSION_COPY: Record<Capability, PermissionCopy> = {
  location: {
    title: "Use your location for directions?",
    lead: (ctx) => `Voya needs it to route you from where you are${ctx ? ` to ${ctx}` : ""} and to show "Take me to my hotel".`,
    points: ["Used only while Voya is open. Nothing runs in the background.", "Shared with travelers only when you tap \"Send my location\".", "Never sold or used for ads. Change any time in Settings."],
    allow: "Continue",
    decline: "Not now · I'll type a starting point",
    after: (os) => `Next, ${os} will ask you to confirm.`,
  },
  microphone: {
    title: "Allow the microphone for voice translation?",
    lead: (ctx) => `Speak in English, Voya says it in ${ctx ?? "the trip's language"}. Conversation mode needs it for both people.`,
    points: ["Listens only while you hold or tap the mic button.", "Audio is sent to the translation service to be transcribed, then discarded. We don't keep recordings.", "Text translation keeps working if you decline."],
    allow: "Allow microphone",
    decline: "Keep typing instead",
    after: (os) => `Next, ${os} will ask you to confirm.`,
  },
  camera: {
    title: "Use the camera for receipts and menus?",
    lead: () => "Snap a receipt to split it, or a menu to translate it in place.",
    points: ["Photos are read once and never stored.", "You can choose a photo from your library instead."],
    allow: "Continue",
    decline: "Choose a photo instead",
    after: (os) => `Next, ${os} will ask you to confirm.`,
  },
};

/** The Permissions screen rows (mockup 7a): what each capability is for and the fallback when it's off. */
export const PERMISSION_ROWS: { key: "location" | "microphone" | "camera" | "photos" | "contacts" | "notifications"; title: string; detail: string; fallback: string }[] = [
  { key: "location", title: "Location", detail: "Navigate, \"Meet here\", local time", fallback: "Directions start from your hotel; you can type a starting point." },
  { key: "microphone", title: "Microphone", detail: "Voice & Conversation translation", fallback: "Text translation keeps working." },
  { key: "camera", title: "Camera", detail: "Receipt scan and camera translation", fallback: "Choose a photo instead, or enter items by hand." },
  { key: "photos", title: "Photos", detail: "Choose a receipt, menu or trip cover", fallback: "The picker asks each time; nothing is kept." },
  { key: "contacts", title: "Contacts", detail: "Add travelers faster · names and numbers only", fallback: "Type names by hand; invites are links." },
  { key: "notifications", title: "Notifications", detail: "Check-in reminders, claims submitted, pass ending", fallback: "Everything also shows up in the app." },
];
