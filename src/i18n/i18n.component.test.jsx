import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider, translate, useLanguage } from './LanguageContext';
import hi from './hi';
import ta from './ta';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';

function Switcher() {
  const { setLang } = useLanguage();
  return <button type="button" onClick={() => setLang('ta')}>switch</button>;
}

describe('translate', () => {
  it('looks up exact English text and falls back to English', () => {
    expect(translate('hi', 'Save')).toBe('सहेजें');
    expect(translate('ta', 'My Pay')).toBe('என் சம்பளம்');
    expect(translate('ta', 'Something not in the dictionary')).toBe('Something not in the dictionary');
    expect(translate('en', 'Save')).toBe('Save');
    expect(translate('hi', null)).toBeNull();
  });

  it('keeps Hindi and Tamil dictionaries covering the same strings', () => {
    const missingInTamil = Object.keys(hi).filter((k) => !(k in ta));
    const missingInHindi = Object.keys(ta).filter((k) => !(k in hi));
    expect(missingInTamil).toEqual([]);
    expect(missingInHindi).toEqual([]);
  });
});

describe('LanguageProvider', () => {
  beforeEach(() => { try { window.localStorage.removeItem('vettri.lang'); } catch { /* ignore */ } });
  afterEach(() => cleanup());

  it('translates shared UI primitives and remembers the choice', async () => {
    render(
      <LanguageProvider>
        <PageHeader title="My Pay" />
        <Button>Save</Button>
        <Switcher />
      </LanguageProvider>,
    );
    expect(screen.getByRole('heading', { name: 'My Pay' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'switch' }));
    expect(screen.getByRole('heading', { name: 'என் சம்பளம்' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'சேமி' })).toBeTruthy();
    expect(window.localStorage.getItem('vettri.lang')).toBe('ta');
    expect(document.documentElement.lang).toBe('ta-IN');
  });
});
