// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const profileRow = {
  uid: "user-1",
  email: "retro@example.com",
  display_name: "Retro Player",
  retroachievements_ulid: "00003EMFWR7XB8SDPEHB3K56ZQ",
  retroachievements_username: "MaxMilyin",
};

vi.mock("../src/services/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        void Promise.resolve().then(() => callback("SIGNED_IN", {
          user: {
            id: "user-1",
            email: "retro@example.com",
            user_metadata: {},
          },
        }));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: profileRow, error: null }),
            }),
          }),
        };
      }

      if (table === "friendships") {
        return {
          select: () => ({
            or: async () => ({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`Tabela inesperada no teste: ${table}`);
    },
  },
}));

import { AuthProvider, useAuth } from "../src/auth/AuthProvider";

function ProfileProbe() {
  const { userProfile } = useAuth();
  return <output>{JSON.stringify(userProfile)}</output>;
}

describe("AuthProvider profile mapping", () => {
  it("maps the RetroAchievements ULID and display username from Supabase", async () => {
    render(
      <AuthProvider>
        <ProfileProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        '"retroAchievementsUlid":"00003EMFWR7XB8SDPEHB3K56ZQ"',
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      '"retroAchievementsUsername":"MaxMilyin"',
    );
  });
});
