module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    success: true,
    synced: true,
    added_count: 0,
    message: 'लाइव न्यूज़ कैशे अद्यतन है (Edge CDN Synced)',
    timestamp: new Date().toISOString()
  });
};
