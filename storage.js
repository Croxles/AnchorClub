const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'state.json');

function ensureFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({
      tickets: {},
      giveaways: {},
      drops: {}
    }, null, 2));
  }
}

function load() {
  ensureFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return {
      tickets: parsed.tickets || {},
      giveaways: parsed.giveaways || {},
      drops: parsed.drops || {}
    };
  } catch (error) {
    console.error('Veri dosyası okunamadı:', error);
    return { tickets: {}, giveaways: {}, drops: {} };
  }
}

let state = load();

function save() {
  ensureFile();
  const tempFile = `${dataFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
  fs.renameSync(tempFile, dataFile);
}

module.exports = {
  get state() { return state; },
  save
};
