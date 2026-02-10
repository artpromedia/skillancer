const Redis = require('/app/services/auth-svc/node_modules/ioredis');
const client = new Redis(process.env.REDIS_URL);
client.on('error', () => {});

async function main() {
  // Search for all possible rate limit key patterns
  const patterns = ['ratelimit:*', 'rate_limit:*', 'rl:*', 'rate-limit:*', 'register:*', 'auth:*'];
  for (const pattern of patterns) {
    const keys = await client.keys(pattern);
    console.log(`Pattern "${pattern}": ${keys.length} keys`, keys.slice(0, 10));
    if (keys.length > 0) {
      const deleted = await client.del(...keys);
      console.log(`  Deleted: ${deleted}`);
    }
  }

  // Also check all keys to find rate-limit related ones
  const allKeys = await client.keys('*');
  console.log('\nAll Redis keys:', allKeys);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
