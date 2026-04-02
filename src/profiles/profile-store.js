const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../main/paths');

const STORE_PATH = path.join(DATA_DIR, 'profiles.json');

class ProfileStore {
  constructor() {
    this.storePath = STORE_PATH;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.profiles = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (_) {}
    return {};
  }

  _save() {
    fs.writeFileSync(this.storePath, JSON.stringify(this.profiles, null, 2), 'utf-8');
  }

  getAll() {
    return { ...this.profiles };
  }

  get(id) {
    return this.profiles[id] || null;
  }

  set(id, data) {
    this.profiles[id] = data;
    this._save();
  }

  remove(id) {
    delete this.profiles[id];
    this._save();
  }

  has(id) {
    return id in this.profiles;
  }
}

module.exports = { ProfileStore };
