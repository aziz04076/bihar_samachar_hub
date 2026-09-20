const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'emergency-helplines.json');
    let raw = fs.readFileSync(dataPath, 'utf-8');
    let data = JSON.parse(raw);

    return res.status(200).json(data);
  } catch (err) {
    return res.status(200).json({
      success: false,
      helplines: [],
      error: err.message
    });
  }
};
