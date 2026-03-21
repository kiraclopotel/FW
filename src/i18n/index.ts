import en from './en.json';
import ro from './ro.json';
export type Locale = 'en' | 'ro';
type Translations = typeof en;
const locales: Record<Locale, Translations> = { en, ro };
let currentLocale: Locale = 'en';
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}
export function t(key: keyof Translations): string {
  return locales[currentLocale]?.[key] ?? locales['en'][key] ?? key;
}
export function getLocale(): Locale { return currentLocale; }
