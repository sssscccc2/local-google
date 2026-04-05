const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./paths');

const NODES_FILE = path.join(DATA_DIR, 'nodes.json');

class NodeStore {
  constructor() {
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(NODES_FILE)) {
        this.nodes = JSON.parse(fs.readFileSync(NODES_FILE, 'utf-8'));
        if (!Array.isArray(this.nodes)) this.nodes = [];
      } else {
        this.nodes = [];
      }
    } catch {
      this.nodes = [];
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(NODES_FILE), { recursive: true });
    fs.writeFileSync(NODES_FILE, JSON.stringify(this.nodes, null, 2), 'utf-8');
  }

  list() {
    return this.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      server: n.server,
      server_port: n.server_port,
    }));
  }

  getAll() {
    return this.nodes;
  }

  get(id) {
    return this.nodes.find((n) => n.id === id) || null;
  }

  add(node) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const entry = { id, ...node };
    this.nodes.push(entry);
    this._save();
    return entry;
  }

  addMany(nodes) {
    const results = [];
    for (const node of nodes) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const entry = { id, ...node };
      this.nodes.push(entry);
      results.push(entry);
    }
    this._save();
    return results;
  }

  remove(id) {
    const idx = this.nodes.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.nodes.splice(idx, 1);
    this._save();
    return true;
  }

  clear() {
    this.nodes = [];
    this._save();
  }
}

module.exports = { NodeStore };
