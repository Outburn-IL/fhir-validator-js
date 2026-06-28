/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */
const { downloadAndExtractJDK, isJdkInstalled } = require('./utils/jdk-utils');
const { downloadValidatorJar } = require('./utils/file-utils'); // ✅ Import fix
const { log, logError } = require('./utils/logger');
const fs = require('fs-extra');
const path = require('path');

const JDK_PATH = path.join(__dirname, '../jdk');
const BIN_DIR = path.join(__dirname, '../bin');
const JAR_PATH = path.join(BIN_DIR, 'validator.jar');

async function setupIfNeeded() {
    log("🔧 Running setup...");

    if (!isJdkInstalled()) {
        log("📦 Installing JDK...");
        await downloadAndExtractJDK();
    } else {
        log("✅ JDK is already installed.");
    }

    if (!fs.existsSync(JAR_PATH)) {
        log("⬇ Downloading Validator JAR...");
        await downloadValidatorJar(); // ✅ Now correctly referenced
    } else {
        log("✅ Validator JAR is already installed.");
    }
}

(async () => {
    try {
        console.log("🚀 Starting installation...");
        await setupIfNeeded();
        console.log("✅ Installation completed successfully.");
    } catch (error) {
        console.error(`❌ Installation failed: ${error.message}`);
        process.exit(1);
    }
})();
