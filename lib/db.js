const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);

function file(name) { return path.join(DATA, name + '.json'); }

function read(name) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); }
  catch { return []; }
}

function write(name, data) {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2));
}

function findOne(name, fn) { return read(name).find(fn) || null; }

function insert(name, record) {
  const data = read(name);
  const doc = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), createdAt: new Date().toISOString(), ...record };
  data.push(doc);
  write(name, data);
  return doc;
}

function update(name, id, changes) {
  const data = read(name);
  const i = data.findIndex(d => d.id === id);
  if (i === -1) return null;
  data[i] = { ...data[i], ...changes, updatedAt: new Date().toISOString() };
  write(name, data);
  return data[i];
}

function remove(name, id) {
  const data = read(name).filter(d => d.id !== id);
  write(name, data);
}

module.exports = { read, write, findOne, insert, update, remove };
