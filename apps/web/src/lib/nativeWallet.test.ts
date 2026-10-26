import { expect, it } from 'vitest';
import { digitalCredentialSupport, sameDeviceAction } from './nativeWallet';
it('never mistakes API presence for protocol, provider or credential availability', () => {
 expect(digitalCredentialSupport({ secure:false, credentialsGet:true }).state).toBe('insecure_context');
 expect(digitalCredentialSupport({ secure:true, credentialsGet:true }).state).toBe('api_unavailable');
 expect(digitalCredentialSupport({ secure:true, credentialsGet:true, credential:{} }).state).toBe('protocol_check_unavailable');
 expect(digitalCredentialSupport({ secure:true, credentialsGet:true, credential:{ userAgentAllowsProtocol:()=>false } }).state).toBe('protocol_unavailable');
 expect(digitalCredentialSupport({ secure:true, credentialsGet:true, credential:{ userAgentAllowsProtocol:p=>p==='openid4vp-v1-signed' } })).toEqual({state:'browser_protocol_available',protocols:['openid4vp-v1-signed']});
 expect(digitalCredentialSupport({ secure:true, credentialsGet:true, credential:{ userAgentAllowsProtocol:()=>{throw Error('CANARY');} } }).state).toBe('protocol_check_unavailable');
});
it('launches only the accepted backend native reference and never rewrites a direct-post request', () => {
 expect(sameDeviceAction('openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest')).toContain('openid4vp:');
 for(const value of [undefined,'javascript:alert(1)','https://wallet.example/user/authorize?request=CANARY','openid4vp://?request=CANARY','openid4vp://?request_uri=http%3A%2F%2F127.0.0.1%2Frequest'])expect(sameDeviceAction(value)).toBeNull();
});
