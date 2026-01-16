#!/usr/bin/env node

/**
 * Deploy to npm
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

async function deploy() {
  console.log('🚀 Deploying to npm...\n');

  // Check if we're logged in to npm
  try {
    execSync('npm whoami', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Not logged in to npm. Run `npm login` first.');
    process.exit(1);
  }

  // Check git status
  try {
    const status = execSync('git status --porcelain').toString();
    if (status) {
      console.error('❌ Working directory is not clean. Commit your changes first.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking git status:', error);
    process.exit(1);
  }

  // Build first
  console.log('📦 Building bundle...');
  execSync('npm run build', { stdio: 'inherit' });

  // Run tests
  console.log('\n🧪 Running tests...');
  try {
    execSync('npm test', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Tests failed. Fix tests before deploying.');
    process.exit(1);
  }

  // Publish to npm
  console.log('\n📤 Publishing to npm...');
  try {
    execSync('npm publish', { stdio: 'inherit' });
    console.log('\n✅ Successfully published to npm!');
  } catch (error) {
    console.error('❌ Error publishing to npm:', error);
    process.exit(1);
  }

  // Get package version
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const version = packageJson.version;

  // Create git tag
  console.log(`\n🏷️  Creating git tag v${version}...`);
  execSync(`git tag v${version}`);
  execSync('git push --tags');

  console.log('\n🎉 Deploy complete!\n');
}

deploy().catch((error) => {
  console.error('❌ Deploy failed:', error);
  process.exit(1);
});
