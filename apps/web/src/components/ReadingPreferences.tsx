import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type Locale = 'en' | 'hi';
type Theme = 'system' | 'light' | 'dark';
const translations = {
  issuer: ['1 · Issuer', '1 · जारीकर्ता'], wallet: ['2 · Wallet', '2 · वॉलेट'], verifier: ['3 · Verifier', '3 · सत्यापनकर्ता'],
  scenario: ['Scenario', 'परिदृश्य'], custom: ['Custom configuration', 'अपना कॉन्फ़िगरेशन'], fault: ['Fault', 'त्रुटि'],
  run: ['Run flow', 'प्रक्रिया चलाएँ'], starting: ['Starting…', 'शुरू हो रहा है…'], fixture: ['Start assisted fixture run', 'सहायक परीक्षण शुरू करें'],
  history: ['Run history', 'रन का इतिहास'], matrix: ['Latest matrix', 'नवीनतम मैट्रिक्स'],
  appearance: ['Appearance', 'दृश्य शैली'], navigation: ['Navigation language', 'नेविगेशन की भाषा'],
  system: ['System', 'सिस्टम'], light: ['Light', 'हल्का'], dark: ['Dark', 'गहरा'],
} as const;
type Key = keyof typeof translations;
const noop = () => {};
const Preferences = createContext({ theme: 'system' as Theme, locale: 'en' as Locale, setTheme: noop as (v:Theme)=>void, setLocale: noop as (v:Locale)=>void, t: (key:Key) => translations[key][0] as string });
function stored(key:string, allowed: readonly string[], fallback:string) { try { const value=localStorage.getItem(key); return value && allowed.includes(value) ? value : fallback; } catch { return fallback; } }
export function ReadingPreferencesProvider({children}:{children:ReactNode}) {
  const [theme,setTheme]=useState<Theme>(()=>stored('playground.appearance',['system','light','dark'],'system') as Theme);
  const [locale,setLocale]=useState<Locale>(()=>stored('playground.navigationLanguage',['en','hi'],'en') as Locale);
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media?.matches?'dark':'light'):theme;};
    apply(); media?.addEventListener?.('change',apply);
    try {localStorage.setItem('playground.appearance',theme);} catch { /* Preference storage may be disabled. */ }
    return ()=>media?.removeEventListener?.('change',apply);
  },[theme]);
  useEffect(()=>{try {localStorage.setItem('playground.navigationLanguage',locale);} catch { /* Preference storage may be disabled. */ }},[locale]);
  return <Preferences.Provider value={{theme,locale,setTheme,setLocale,t:key=>translations[key][locale==='hi'?1:0]}}>{children}</Preferences.Provider>;
}
export const useReadingPreferences=()=>useContext(Preferences);
export function ReadingPreferences() {
  const {theme,locale,setTheme,setLocale,t}=useReadingPreferences();
  return <div role="group" aria-label="Reading preferences" title="Protocol names and evidence text stay in English." className="flex items-center gap-2 text-xs">
    <label lang={locale} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      <span>{t('appearance')}</span>
      <select value={theme} onChange={e=>setTheme(e.target.value as Theme)} className="rounded border border-slate-300 bg-white p-2 text-slate-700">
        <option value="system">{t('system')}</option>
        <option value="light">{t('light')}</option>
        <option value="dark">{t('dark')}</option>
      </select>
    </label>
    <label lang={locale} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      <span>{t('navigation')}</span>
      <select value={locale} onChange={e=>setLocale(e.target.value as Locale)} className="rounded border border-slate-300 bg-white p-2 text-slate-700">
        <option lang="en" value="en">English</option>
        <option lang="hi" value="hi">हिन्दी</option>
      </select>
    </label>
  </div>;
}
