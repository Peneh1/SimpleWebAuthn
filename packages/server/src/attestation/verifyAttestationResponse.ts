import decodeAttestationObject from '../helpers/decodeAttestationObject';
import decodeClientDataJSON from '../helpers/decodeClientDataJSON';
import {
  ATTESTATION_FORMATS,
  AttestationCredentialJSON,
  VerifiedAttestation,
} from '@simplewebauthn/typescript-types';

import verifyFIDOU2F from './verifications/verifyFIDOU2F';
import verifyPacked from './verifications/verifyPacked';
import verifyNone from './verifications/verifyNone';
import verifyAndroidSafetynet from './verifications/verifyAndroidSafetyNet';

/**
 * Verify that the user has legitimately completed the registration process
 *
 * @param response Authenticator attestation response with base64-encoded values
 * @param expectedChallenge The random value provided to generateAttestationOptions for the
 * authenticator to sign
 * @param expectedOrigin Expected URL of website attestation should have occurred on
 */
export default function verifyAttestationResponse(
  credential: AttestationCredentialJSON,
  expectedChallenge: string,
  expectedOrigin: string,
): VerifiedAttestation {
  const { response } = credential;
  const attestationObject = decodeAttestationObject(response.attestationObject);
  const clientDataJSON = decodeClientDataJSON(response.clientDataJSON);

  const { type, origin, challenge } = clientDataJSON;

  if (challenge !== expectedChallenge) {
    throw new Error(
      `Unexpected attestation challenge "${challenge}", expected "${expectedChallenge}"`,
    );
  }

  // Check that the origin is our site
  if (origin !== expectedOrigin) {
    throw new Error(`Unexpected attestation origin "${origin}", expected "${expectedOrigin}"`);
  }

  // Make sure we're handling an attestation
  if (type !== 'webauthn.create') {
    throw new Error(`Unexpected attestation type: ${type}`);
  }

  const { fmt } = attestationObject;

  /**
   * Verification can only be performed when attestation = 'direct'
   */
  if (fmt === ATTESTATION_FORMATS.FIDO_U2F) {
    return verifyFIDOU2F(attestationObject, response.clientDataJSON);
  }

  if (fmt === ATTESTATION_FORMATS.PACKED) {
    return verifyPacked(attestationObject, response.clientDataJSON);
  }

  if (fmt === ATTESTATION_FORMATS.ANDROID_SAFETYNET) {
    return verifyAndroidSafetynet(attestationObject, response.clientDataJSON);
  }

  if (fmt === ATTESTATION_FORMATS.NONE) {
    return verifyNone(attestationObject);
  }

  throw new Error(`Unsupported Attestation Format: ${fmt}`);
}
