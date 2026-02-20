/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { notarize } = require('@electron/notarize');

async function getNotarizeOptions(appPath) {
  const {
    APPLE_API_KEY,
    APPLE_API_KEY_BASE64,
    APPLE_API_KEY_ID,
    APPLE_API_ISSUER,
    APPLE_ID,
    APPLE_APP_SPECIFIC_PASSWORD,
    APPLE_TEAM_ID,
  } = process.env;

  const hasApiKeyCredentials =
    Boolean(APPLE_API_KEY_ID) &&
    Boolean(APPLE_API_ISSUER) &&
    (Boolean(APPLE_API_KEY) || Boolean(APPLE_API_KEY_BASE64));

  if (hasApiKeyCredentials) {
    let apiKeyPath = APPLE_API_KEY;
    let tempKeyPath = null;

    if (!apiKeyPath && APPLE_API_KEY_BASE64) {
      tempKeyPath = path.join(os.tmpdir(), `apple-api-key-${APPLE_API_KEY_ID}.p8`);
      fs.writeFileSync(tempKeyPath, Buffer.from(APPLE_API_KEY_BASE64, 'base64'));
      apiKeyPath = tempKeyPath;
    }

    return {
      options: {
        appPath,
        appleApiKey: apiKeyPath,
        appleApiKeyId: APPLE_API_KEY_ID,
        appleApiIssuer: APPLE_API_ISSUER,
      },
      cleanup: () => {
        if (tempKeyPath) {
          fs.rmSync(tempKeyPath, { force: true });
        }
      },
    };
  }

  const hasAppleIdCredentials =
    Boolean(APPLE_ID) &&
    Boolean(APPLE_APP_SPECIFIC_PASSWORD) &&
    Boolean(APPLE_TEAM_ID);

  if (hasAppleIdCredentials) {
    return {
      options: {
        appPath,
        appleId: APPLE_ID,
        appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
        teamId: APPLE_TEAM_ID,
      },
      cleanup: () => {},
    };
  }

  return null;
}

module.exports = async (context) => {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('[notarize] SKIP_NOTARIZE=1, skipping notarization.');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`[notarize] App not found at ${appPath}`);
  }

  const credentialBundle = await getNotarizeOptions(appPath);
  if (!credentialBundle) {
    console.log(
      '[notarize] No Apple credentials found. Build is signed, but notarization is skipped.'
    );
    return;
  }

  try {
    console.log('[notarize] Submitting app for notarization:', appPath);
    await notarize(credentialBundle.options);
    console.log('[notarize] Notarization completed.');
  } finally {
    credentialBundle.cleanup();
  }
};
