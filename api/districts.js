const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'districts.json');
    let raw = fs.readFileSync(dataPath, 'utf-8');
    let data = JSON.parse(raw);
    let districts = data.districts || [];

    const { division, search } = req.query || {};

    if (division && division !== 'all') {
      const div = String(division).toLowerCase();
      districts = districts.filter(d => 
        (d.division_en && d.division_en.toLowerCase().includes(div)) ||
        (d.division_hi && d.division_hi.includes(div))
      );
    }
    if (search) {
      const q = String(search).toLowerCase();
      districts = districts.filter(d => 
        (d.name_en && d.name_en.toLowerCase().includes(q)) || 
        (d.name_hi && d.name_hi.includes(q)) ||
        (d.id && d.id.toLowerCase().includes(q))
      );
    }

    return res.status(200).json({
      success: true,
      status: 'ok',
      total: districts.length,
      districts: districts
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      status: 'fallback',
      total: 0,
      districts: [],
      error: err.message
    });
  }
};
