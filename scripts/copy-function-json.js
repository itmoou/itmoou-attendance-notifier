/**
 * Copy all function.json files from apps to dist
 * Cross-platform script (works on Windows, Linux, macOS)
 */

const fs = require('fs');
const path = require('path');

function copyFunctionJsonFiles(srcDir, destDir) {
  let copiedCount = 0;

  function walkDir(dir, baseDir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const srcPath = path.join(dir, file);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        walkDir(srcPath, baseDir);
      } else if (file === 'function.json') {
        // Calculate relative path
        const relativePath = path.relative(baseDir, srcPath);
        const destPath = path.join(destDir, relativePath);

        // Create destination directory
        const destDirPath = path.dirname(destPath);
        if (!fs.existsSync(destDirPath)) {
          fs.mkdirSync(destDirPath, { recursive: true });
        }

        // Copy file
        fs.copyFileSync(srcPath, destPath);
        console.log(`✓ Copied: ${relativePath}`);
        copiedCount++;
      }
    }
  }

  const srcAppsDir = path.join(srcDir, 'apps');
  const destAppsDir = path.join(destDir, 'apps');

  if (!fs.existsSync(srcAppsDir)) {
    console.error('❌ Error: apps directory not found');
    process.exit(1);
  }

  console.log('📁 Copying function.json files...');
  walkDir(srcAppsDir, srcDir);
  console.log(`✅ Total copied: ${copiedCount} files`);
}

// Run
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

copyFunctionJsonFiles(projectRoot, distDir);
