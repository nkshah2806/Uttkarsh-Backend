const http = require('http');

const payload = JSON.stringify({
  email: process.env.ADMIN_EMAIL || '',
  password: process.env.ADMIN_PASSWORD || '',
});

const req = http.request(
  {
    hostname: 'localhost',
    port: process.env.PORT || 1990,
    path: '/api/user/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      console.log(`status=${res.statusCode}`);
      console.log(body);
    });
  }
);

req.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

req.write(payload);
req.end();
