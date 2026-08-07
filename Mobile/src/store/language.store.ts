import { create } from 'zustand';

export type AppLanguage = 'VN' | 'EN';

type LanguageState = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'VN',
  setLanguage: (language) => set({ language }),
  toggleLanguage: () => set((state) => ({ language: state.language === 'VN' ? 'EN' : 'VN' })),
}));

