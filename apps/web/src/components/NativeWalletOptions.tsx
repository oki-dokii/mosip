import { useState } from 'react';
import { digitalCredentialSupport, sameDeviceAction } from '../lib/nativeWallet';
export function NativeWalletOptions({ presentationUrl }: { presentationUrl?: string | undefined }) {
  const [support, setSupport] = useState<ReturnType<typeof digitalCredentialSupport> | null>(null);
  const launch = sameDeviceAction(presentationUrl);
  function inspect() {
    const credential = (window as unknown as { DigitalCredential?: { userAgentAllowsProtocol?: (protocol: string) => boolean } }).DigitalCredential;
    setSupport(digitalCredentialSupport({ secure: window.isSecureContext, credentialsGet: typeof navigator.credentials?.get === 'function', ...(credential ? { credential } : {}) }));
  }
  return <section aria-label="Native wallet launch options" className="space-y-2 border-t border-slate-200 pt-3 text-sm">
    <h3 className="font-semibold">Native wallet options</h3>
    {launch ? <a href={launch} className="underline">Open wallet on this device</a> : <p>Same-device launch unavailable: this profile supplies no supported native request reference. Use its Web wallet action above.</p>}
    <button type="button" className="rounded border border-slate-400 px-3 py-2" onClick={inspect}>Check Digital Credentials API support</button>
    <p role="status">{support ? support.state === 'browser_protocol_available' ? `Browser accepts ${support.protocols.join(', ')}. This does not establish an installed wallet or credential.` : support.state === 'insecure_context' ? 'A secure browser context is required.' : support.state === 'protocol_unavailable' ? 'This browser does not allow the checked OpenID4VP 1.0 protocols.' : 'Digital Credentials API protocol support is unavailable in this browser.' : 'Browser capability has not been checked.'}</p>
    <p>The current Inji adapters use direct-post profiles. A matching Digital Credentials API verifier adapter and wallet test are required before requesting a credential here. No credential is requested by this check.</p>
  </section>;
}
