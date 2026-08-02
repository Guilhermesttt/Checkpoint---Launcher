import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/pages/Home.tsx", "utf8");
const modalMarker = source.indexOf("isOpen={Boolean(friendProfileModal)}");
const modalStart = source.lastIndexOf("<ModalShell", modalMarker);
const modalEnd = source.indexOf("<ConfirmationModal", modalMarker);
const friendModal = source.slice(modalStart, modalEnd);

describe("friend profile modal layout", () => {
  it("uses the large viewport frame and keeps its outer overflow visible", () => {
    expect(friendModal).toContain('maxWidthClassName="max-w-[min(1440px,calc(100vw-48px))]"');
    expect(friendModal).toContain('containerClassName="p-6"');
    expect(friendModal).toContain('className="relative h-[calc(100dvh-48px)] max-h-none overflow-visible p-0"');
  });

  it("clips the inner profile surface and offsets the close control outside it", () => {
    expect(friendModal).toContain("data-friend-profile-surface");
    expect(friendModal).toContain('className="flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#050507] shadow-2xl"');
    expect(friendModal).toContain('aria-label="Fechar perfil do amigo"');
    expect(friendModal).toContain("-right-3 -top-3");
  });
});
