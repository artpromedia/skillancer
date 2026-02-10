const Redis = require('/app/node_modules/.pnpm/ioredis@5.9.1/node_modules/ioredis');
const url = process.env.REDIS_URL;
console.log('REDIS_URL:', url);
const r = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });
r.on('error', (e) => console.log('ERR:', e.message));
r.connect()
  .then(() => {
    console.log('Connected!');
    return r.ping();
  })
  .then((res) => {
    console.log('PING:', res);
    r.quit();
  })
  .catch((e) => {
    console.log('CONNECT FAILED:', e.message);
    process.exit(1);
  });
setTimeout(() => {
  console.log('TIMEOUT - exiting');
  process.exit(1);
}, 5000);
