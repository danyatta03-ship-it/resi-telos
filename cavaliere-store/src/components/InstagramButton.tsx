import { contact } from "@/content/site";

export default function InstagramButton() {
  return (
    <a
      href={contact.instagramDm}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Scrivici in DM su Instagram"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-lg shadow-black/40 transition-transform hover:scale-110"
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    </a>
  );
}
