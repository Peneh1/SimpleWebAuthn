import { COSEPublicKey } from './convertCOSEtoPKCS';
import { isoCBOR } from './iso';

export function decodeCredentialPublicKey(publicKey: Uint8Array): COSEPublicKey {
  return isoCBOR.decodeFirst<COSEPublicKey>(publicKey);
}
