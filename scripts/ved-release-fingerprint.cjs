// Run only through the release orchestrator with mongosh --nodb.
// Read-only: return collection/index/options and document hashes, never documents.
(() => {
  const crypto = require('node:crypto');
  const stable = value => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    return value;
  };
  const encode = value => JSON.stringify(stable(JSON.parse(EJSON.stringify(value, { relaxed: false }))));
  const connection = new Mongo(process.env.VED_FINGERPRINT_URI || 'mongodb://127.0.0.1:27017');
  const database = connection.getDB(process.env.VED_FINGERPRINT_DB);
  const collections = database.getCollectionInfos().sort((a, b) => a.name.localeCompare(b.name));
  const result = [];
  for (const info of collections) {
    if (info.type !== 'collection' || info.name.startsWith('system.')) throw new Error('Unsupported collection type.');
    const hash = crypto.createHash('sha256');
    let count = 0;
    database.getCollection(info.name).find({}).sort({ _id: 1 }).forEach(row => {
      hash.update(EJSON.stringify(row, { relaxed: false })); hash.update('\n'); count++;
    });
    const indexes = database.getCollection(info.name).getIndexes().map(index => {
      const copy = { ...index }; delete copy.ns; return copy;
    }).sort((a, b) => a.name.localeCompare(b.name));
    result.push({ name: info.name, count, documentsSha256: hash.digest('hex'), options: encode(info.options || {}), indexes: encode(indexes) });
  }
  print(JSON.stringify(result));
})();
