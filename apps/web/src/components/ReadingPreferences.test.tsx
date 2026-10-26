// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ReadingPreferences, ReadingPreferencesProvider, useReadingPreferences } from './ReadingPreferences';
afterEach(()=>{cleanup();localStorage.clear();delete document.documentElement.dataset.theme;});
function Sample(){const {t}=useReadingPreferences();return <><ReadingPreferences/><button>{t('run')}</button><p>Independent Verify: valid</p></>;}
it('persists only bounded reading preferences and leaves evidence/protocol wording unchanged',()=>{
 const tree=()=>render(<ReadingPreferencesProvider><Sample/></ReadingPreferencesProvider>);
 const first=tree();fireEvent.change(screen.getByLabelText('Appearance'),{target:{value:'dark'}});expect(document.documentElement.dataset.theme).toBe('dark');
 fireEvent.change(screen.getByLabelText('Navigation language'),{target:{value:'hi'}});expect(screen.getByRole('button',{name:'प्रक्रिया चलाएँ'})).toBeTruthy();expect(screen.getByText('Independent Verify: valid')).toBeTruthy();
 expect(localStorage.getItem('playground.appearance')).toBe('dark');expect(localStorage.getItem('playground.navigationLanguage')).toBe('hi');first.unmount();tree();expect(screen.getByRole('button',{name:'प्रक्रिया चलाएँ'})).toBeTruthy();
});
it('ignores malformed saved preferences rather than rendering them',()=>{
 localStorage.setItem('playground.navigationLanguage','CANARY');localStorage.setItem('playground.appearance','CANARY');render(<ReadingPreferencesProvider><Sample/></ReadingPreferencesProvider>);expect(screen.getByRole('button',{name:'Run flow'})).toBeTruthy();expect(document.body.textContent).not.toContain('CANARY');expect(document.documentElement.dataset.theme).toBe('light');
});
