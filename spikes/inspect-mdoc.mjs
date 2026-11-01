// Wrap the unchanged IssuerSigned CBOR item in an issuer-only DeviceResponse for
// the independent parser. The wrapper contains no holder authentication.
import { Verifier, parse } from '@auth0/mdl';
import { cborDecode, cborEncode } from '@auth0/mdl/lib/cbor/index.js';
export async function inspectMdoc(credential) {
  const summary={library:'@auth0/mdl 3.0.1',credentialReturned:typeof credential==='string',issuerSignatureValid:false,digestsValid:false,digestCount:0,chainTrustChecked:false,deviceAuthenticationChecked:false};
  if (!summary.credentialReturned) return summary;
  const encodeText=s=>Buffer.from(cborEncode(s));
  const digests=[];
  const document=Buffer.from(credential,'base64url');
  const root=cborDecode(document);
  if (!(root instanceof Map) || root.get('docType')!=='org.iso.18013.5.1.mDL' || !root.has('issuerSigned')) return summary;
  const framed=Buffer.concat([Buffer.from([0xa3]),encodeText('version'),encodeText('1.0'),encodeText('status'),Buffer.from([0]),encodeText('documents'),Buffer.from([0x81]),document]);
  try {
    const [doc]=parse(framed).documents;
    for (const ns of doc.issuerSignedNameSpaces) {
      for (const item of doc.issuerSigned.nameSpaces[ns]) digests.push(await item.isValid(ns,doc.issuerSigned.issuerAuth));
    }
    summary.digestCount=digests.length;
    summary.digestsValid=digests.length>0 && digests.every(Boolean);
    await new Verifier([]).verify(framed,{disableCertificateChainValidation:true,onCheck:({id,status})=>{
      if(id==='ISSUER_SIGNATURE_VALIDITY')summary.issuerSignatureValid=status==='PASSED';

    }});

  } catch { summary.fullDeviceResponseCheckCompleted=false; }
  return summary;
}
