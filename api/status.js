module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'online',
    system: 'Bihar Samachar Hub Serverless API',
    version: '6.2.0',
    platform: 'Vercel Edge Cloud',
    districts: 38,
    uptime: '99.99%',
    timestamp: new Date().toISOString()
  });
};
