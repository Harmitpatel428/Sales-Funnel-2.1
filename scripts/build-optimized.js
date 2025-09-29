#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting optimized build process...');

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  if (process.platform === 'win32') {
    execSync('npm run clean:win', { stdio: 'inherit' });
  } else {
    execSync('npm run clean', { stdio: 'inherit' });
  }
} catch (error) {
  console.log('⚠️ Clean command failed, continuing...');
}

// Type check
console.log('🔍 Running type check...');
try {
  execSync('npm run type-check', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Type check failed!');
  process.exit(1);
}

// Lint check
console.log('🔍 Running lint check...');
try {
  execSync('npm run lint:check', { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️ Lint issues found, but continuing...');
}

// Build Next.js app
console.log('🏗️ Building Next.js application...');
try {
  execSync('npm run build:prod', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Next.js build failed!');
  process.exit(1);
}

// Check if out directory exists
if (!fs.existsSync('out')) {
  console.error('❌ Build output directory not found!');
  process.exit(1);
}

// Build Electron app
console.log('⚡ Building Electron application...');
try {
  if (process.platform === 'win32') {
    execSync('npm run build-electron:win', { stdio: 'inherit' });
  } else {
    execSync('npm run build-electron', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Electron build failed!');
  process.exit(1);
}

// Check if dist directory exists
if (!fs.existsSync('dist')) {
  console.error('❌ Electron build output directory not found!');
  process.exit(1);
}

console.log('✅ Build completed successfully!');
console.log('📦 Output files are in the "dist" directory');

// List output files
try {
  const distFiles = fs.readdirSync('dist');
  console.log('📋 Generated files:');
  distFiles.forEach(file => {
    const filePath = path.join('dist', file);
    const stats = fs.statSync(filePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   - ${file} (${sizeInMB} MB)`);
  });
} catch (error) {
  console.log('⚠️ Could not list output files');
}

console.log('🎉 Optimized build process completed!');
