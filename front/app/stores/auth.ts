import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRead } from "~/api/types.gen";

interface AuthState {
  token: string | null;
  user: UserRead | null;
  setAuth: (token: string, user: UserRead) => void;
  setUser: (user: UserRead) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "medseg-auth" }
  )
);
