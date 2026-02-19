#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const os = require('os');

const replacements = {
  'gemini-3-pro': 'gemini-3-pro-preview',
  'gemini-3.1-pro-preview': 'gemini-3-pro-preview',
  'gemini-3-flash': 'gemini-3-flash-preview',
};

const candidates = [
  path.join(process.cwd(), '.gemini', 'settings.json'),
  path.join(process.cwd(), 'gemini-home', '.gemini', 'settings.json'),
  path.join(process.cwd(), 'gemini-home', 'settings.json'),
  path.join(os.homedir(), '.gemini', 'settings.json'),
].filter((v, i, arr) => arr.indexOf(v) === i);

function migrateValue(value) {
  if (typeof value === 'string') {
    return replacements[value] || value;
  }
  if (Array.isArray(value)) {
    return value.map(migrateValue);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = migrateValue(v);
    }
    return out;
  }
  return value;
}

let touched = 0;
for (const filePath of candidates) {
  if (!fs.existsSync(filePath)) continue;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const migrated = migrateValue(parsed);
    const before = JSON.stringify(parsed);
    const after = JSON.stringify(migrated);
    if (before !== after) {
      fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2) + '\n', 'utf8');
      console.log(`migrated: ${filePath}`);
      touched += 1;
    } else {
      console.log(`unchanged: ${filePath}`);
    }
  } catch (error) {
    console.error(`failed: ${filePath}`, error.message || error);
  }
}

console.log(`done, files updated: ${touched}`);
