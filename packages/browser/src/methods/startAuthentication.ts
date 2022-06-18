import {
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticationCredential,
  AuthenticationCredentialJSON,
} from '@simplewebauthn/typescript-types';

import bufferToBase64URLString from '../helpers/bufferToBase64URLString';
import base64URLStringToBuffer from '../helpers/base64URLStringToBuffer';
import bufferToUTF8String from '../helpers/bufferToUTF8String';
import { browserSupportsWebauthn } from '../helpers/browserSupportsWebauthn';
import { browserSupportsWebAuthnAutofill } from '../helpers/browserSupportsConditionalMediation';
import toPublicKeyCredentialDescriptor from '../helpers/toPublicKeyCredentialDescriptor';
import { identifyAuthenticationError } from '../helpers/identifyAuthenticationError';
import { webauthnAbortService } from '../helpers/webAuthnAbortService';

/**
 * Begin authenticator "login" via WebAuthn assertion
 *
 * @param requestOptionsJSON Output from **@simplewebauthn/server**'s generateAssertionOptions(...)
 * @param supportBrowserAutofill Initialize conditional UI to enable logging in via browser
 * autofill prompts
 */
export async function startAuthentication(
  requestOptionsJSON: PublicKeyCredentialRequestOptionsJSON,
  supportBrowserAutofill = false,
): Promise<AuthenticationCredentialJSON> {
  if (!browserSupportsWebauthn()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // We need to avoid passing empty array to avoid blocking retrieval
  // of public key
  let allowCredentials;
  if (requestOptionsJSON.allowCredentials?.length !== 0) {
    allowCredentials = requestOptionsJSON.allowCredentials?.map(toPublicKeyCredentialDescriptor);
  }

  // We need to convert some values to Uint8Arrays before passing the credentials to the navigator
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...requestOptionsJSON,
    challenge: base64URLStringToBuffer(requestOptionsJSON.challenge),
    allowCredentials,
  };

  const options: CredentialRequestOptions = { publicKey };

  /**
   * Set up the page to prompt the user to select a credential for authentication via the browser's
   * input autofill mechanism.
   */
  if (supportBrowserAutofill) {
    if (!(await browserSupportsWebAuthnAutofill())) {
      throw Error('Browser does not support WebAuthn autofill');
    }

    // Check for an <input> with "webauthn" in its `autocomplete` attribute
    const eligibleInputs = document.querySelectorAll("input[autocomplete*='webauthn']");

    // WebAuthn autofill requires at least one valid input
    if (eligibleInputs.length < 1) {
      throw Error('No <input> with `"webauthn"` in its `autocomplete` attribute was detected');
    }

    // `CredentialMediationRequirement` doesn't know about "conditional" yet as of
    // typescript@4.6.3
    options.mediation = 'conditional' as CredentialMediationRequirement;
    // Massage options into a suitable structure
    delete options.publicKey?.allowCredentials;
  }

  // Wait for the user to complete assertion
  let credential;
  try {
    // Set up the ability to cancel this request if the user attempts another
    options.signal = webauthnAbortService.createNewAbortSignal();
    credential = (await navigator.credentials.get(options)) as AuthenticationCredential;
  } catch (err) {
    throw identifyAuthenticationError({ error: err as Error, options });
  }

  if (!credential) {
    throw new Error('Authentication was not completed');
  }

  const { id, rawId, response, type } = credential;

  let userHandle = undefined;
  if (response.userHandle) {
    userHandle = bufferToUTF8String(response.userHandle);
  }

  // Convert values to base64 to make it easier to send back to the server
  return {
    id,
    rawId: bufferToBase64URLString(rawId),
    response: {
      authenticatorData: bufferToBase64URLString(response.authenticatorData),
      clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
      signature: bufferToBase64URLString(response.signature),
      userHandle,
    },
    type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}
