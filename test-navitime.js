const https = require('https');
require('dotenv').config({ path: '.env.local' });

const options = {
  hostname: process.env.RAPIDAPI_HOST,
  path: '/transport_node?word=%E6%9D%B1%E4%BA%AC&coord_unit=degree&datum=wgs84&limit=1',
  method: 'GET',
  headers: {
    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
    'x-rapidapi-host': process.env.RAPIDAPI_HOST,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Node search response:', data));
});
req.end();
