/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */

const fs = require('fs-extra');
const axios = require('axios');
const path = require('path');
const { log, logError } = require('./logger');

const BIN_DIR = path.join(__dirname, '../../bin');
const JAR_PATH = path.join(BIN_DIR, 'validator.jar');
const GITHUB_BASE_URL = 'https://github.com';
const VALIDATOR_REPOSITORIES = [
    'Outburn-IL/org.hl7.fhir.validator-wrapper',
    'hapifhir/org.hl7.fhir.validator-wrapper'
];

/**
 * Resolves the latest validator JAR URLs without calling the GitHub API.
 */
async function getLatestValidatorJarUrls() {
    log("🔎 Resolving latest FHIR Validator release...");

    let lastError;

    for (const repository of VALIDATOR_REPOSITORIES) {
        try {
            const releaseTag = await getLatestReleaseTag(repository);
            return await getReleaseJarUrls(repository, releaseTag);
        } catch (error) {
            lastError = error;
            if (repository === VALIDATOR_REPOSITORIES[0]) {
                logError("❌ Failed to resolve Outburn's latest validator release. Falling back to the original HAPI FHIR Validator Wrapper.");
            }
        }
    }

    throw lastError;
}

async function getLatestReleaseTag(repository) {
    const latestReleaseUrl = `${GITHUB_BASE_URL}/${repository}/releases/latest`;
    const response = await axios.head(latestReleaseUrl, {
        maxRedirects: 0,
        validateStatus: status => status >= 300 && status < 400
    });

    const location = response.headers.location;
    if (!location) {
        throw new Error(`Missing redirect location for ${repository} latest release.`);
    }

    const releasePath = new URL(location, GITHUB_BASE_URL).pathname;
    const match = releasePath.match(/\/releases\/tag\/(.+)$/);

    if (!match) {
        throw new Error(`Could not determine the latest release tag for ${repository}.`);
    }

    return decodeURIComponent(match[1]);
}

async function getReleaseJarUrls(repository, releaseTag) {
    const expandedAssetsUrl = `${GITHUB_BASE_URL}/${repository}/releases/expanded_assets/${encodeURIComponent(releaseTag)}`;
    const response = await axios.get(expandedAssetsUrl);
    const jarUrls = [...new Set(
        [...response.data.matchAll(/href="([^"]+\/releases\/download\/[^"]+\.jar)"/gi)]
            .map(match => new URL(match[1], GITHUB_BASE_URL).toString())
    )];

    if (jarUrls.length === 0) {
        throw new Error(`No validator JAR assets found for ${repository} release ${releaseTag}.`);
    }

    return jarUrls;
}

async function downloadFile(url, destinationPath) {
    const writer = fs.createWriteStream(destinationPath);
    const response = await axios({ url, responseType: 'stream' });

    return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

/**
 * Downloads the latest FHIR Validator JAR.
 */
async function downloadValidatorJar() {
    fs.ensureDirSync(BIN_DIR);

    if (fs.existsSync(JAR_PATH)) {
        log("✅ FHIR Validator JAR already installed.");
        return;
    }

    const jarUrls = await getLatestValidatorJarUrls();
    let lastError;

    for (const [index, jarUrl] of jarUrls.entries()) {
        try {
            log(`⬇ Downloading Validator JAR from: ${jarUrl}`);
            await downloadFile(jarUrl, JAR_PATH);
            log("✅ FHIR Validator JAR downloaded.");
            return;
        } catch (error) {
            lastError = error;
            fs.removeSync(JAR_PATH);
            if (index < jarUrls.length - 1) {
                logError("❌ Failed to download the resolved validator asset. Trying the next available release asset.");
            }
        }
    }

    logError(`❌ JAR download failed: ${lastError.message}`);
    throw lastError;
}

module.exports = {
    downloadValidatorJar
};
