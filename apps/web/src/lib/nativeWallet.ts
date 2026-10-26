import { actionUrl } from './assistedActions';
export const dcProtocols = ['openid4vp-v1-signed', 'openid4vp-v1-unsigned'] as const;
interface BrowserSupport { secure: boolean; credentialsGet: boolean; credential?: { userAgentAllowsProtocol?: (protocol: string) => boolean } }
export function digitalCredentialSupport(browser: BrowserSupport) {
  if (!browser.secure) return { state: 'insecure_context', protocols: [] };
  if (!browser.credentialsGet || !browser.credential) return { state: 'api_unavailable', protocols: [] };
  if (typeof browser.credential.userAgentAllowsProtocol !== 'function') return { state: 'protocol_check_unavailable', protocols: [] };
  try {
    const protocols = dcProtocols.filter(protocol => browser.credential!.userAgentAllowsProtocol!(protocol));
    return { state: protocols.length ? 'browser_protocol_available' : 'protocol_unavailable', protocols };
  } catch { return { state: 'protocol_check_unavailable', protocols: [] }; }
}
export function sameDeviceAction(value: string | undefined) {
  const allowed = actionUrl(value);
  return allowed?.startsWith('openid4vp:') ? allowed : null;
}
