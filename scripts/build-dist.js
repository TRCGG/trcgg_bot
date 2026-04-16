const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const copyTargets = [
  'bot.js',
  'app',
  'package.json',
  'package-lock.json',
  'scripts/deploy-release.sh',
];

fs.rmSync(distDir, {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 200,
});
fs.mkdirSync(distDir, { recursive: true });

for (const target of copyTargets) {
  const sourcePath = path.join(rootDir, target);
  const destinationPath = path.join(distDir, target);

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(sourcePath, destinationPath, { recursive: true });
}

console.log(`Created deployment package at ${distDir}`);
