// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NativeWalletOptions } from './NativeWalletOptions';
afterEach(cleanup);
it('keeps unsupported direct-post profiles explicit without requesting credentials', () => {
 const get=vi.fn(); Object.defineProperty(navigator,'credentials',{configurable:true,value:{get}});
 render(<NativeWalletOptions presentationUrl="https://wallet.example/user/authorize?request=CANARY_INLINE_TOKEN" />);
 fireEvent.click(screen.getByRole('button',{name:'Check Digital Credentials API support'}));
 expect(get).not.toHaveBeenCalled();
 expect(screen.queryByRole('link',{name:'Open wallet on this device'})).toBeNull();
 expect(document.body.textContent).not.toContain('CANARY');
 expect(screen.getByText(/A matching Digital Credentials API verifier adapter/)).toBeTruthy();
});
it('exposes an accepted referenced native action as a user-operated link only', () => {
 render(<NativeWalletOptions presentationUrl="openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest" />);
 expect(screen.getByRole('link',{name:'Open wallet on this device'}).getAttribute('href')).toContain('openid4vp:');
 expect(screen.getByRole('status').textContent).toBe('Browser capability has not been checked.');
});
