// Worker script for multi-process concurrency testing
const [url, token] = process.argv.slice(2);

if (!url || !token) {
  process.stderr.write('Missing url or token argument\n');
  process.exit(1);
}

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ boardCount: 2 }),
})
  .then(async (res) => {
    const text = await res.text().catch(() => '');
    process.stdout.write(JSON.stringify({ status: res.status, body: text }));
    process.exit(res.status === 201 ? 0 : 2);
  })
  .catch((err) => {
    process.stderr.write(err.message);
    process.exit(1);
  });
