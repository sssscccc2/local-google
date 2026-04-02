const { ProfileStore } = require('./profile-store');
const { FingerprintGenerator } = require('../fingerprint/generator');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

class ProfileManager {
  constructor() {
    this.store = new ProfileStore();
  }

  listProfiles() {
    const all = this.store.getAll();
    return Object.entries(all).map(([id, profile]) => ({
      id,
      name: profile.name,
      createdAt: profile.createdAt,
      lastUsed: profile.lastUsed,
      platform: profile.fingerprint?.navigator?.platform || 'Unknown',
      userAgent: profile.fingerprint?.userAgent || '',
    }));
  }

  getProfile(id) {
    return this.store.get(id);
  }

  createProfile(data) {
    const id = generateId();
    const fingerprint = data.fingerprint || FingerprintGenerator.generate();

    const profile = {
      name: data.name || `Profile ${id}`,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      notes: data.notes || '',
      proxy: data.proxy || null,
      fingerprint,
    };

    this.store.set(id, profile);
    return { id, ...profile };
  }

  updateProfile(id, data) {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Profile ${id} not found`);

    const updated = {
      ...existing,
      ...data,
      fingerprint: data.fingerprint || existing.fingerprint,
    };

    this.store.set(id, updated);
    return { id, ...updated };
  }

  deleteProfile(id) {
    if (!this.store.has(id)) throw new Error(`Profile ${id} not found`);
    this.store.remove(id);
    return { success: true };
  }

  markUsed(id) {
    const existing = this.store.get(id);
    if (existing) {
      existing.lastUsed = new Date().toISOString();
      this.store.set(id, existing);
    }
  }
}

module.exports = { ProfileManager };
