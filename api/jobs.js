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
    const dataPath = path.join(process.cwd(), 'data', 'jobs-results.json');
    let raw = fs.readFileSync(dataPath, 'utf-8');
    let data = JSON.parse(raw);
    let jobs = data.items || data.jobs || [];

    const { category } = req.query || {};
    if (category && category !== 'all') {
      jobs = jobs.filter(j => j.category === category);
    }

    return res.status(200).json({
      success: true,
      total: jobs.length,
      jobs: jobs,
      items: jobs,
      categories: data.categories || []
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      total: 0,
      jobs: [],
      error: err.message
    });
  }
};
