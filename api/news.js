const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'latest-news.json');
    let raw = fs.readFileSync(dataPath, 'utf-8');
    let data = JSON.parse(raw);
    let news = data.news || [];

    const { category, district, search, limit = 50, page = 1 } = req.query || {};

    if (category && category !== 'all') {
      news = news.filter(n => n.category === category);
    }
    if (district && district !== 'all') {
      const d = String(district).toLowerCase();
      news = news.filter(n => (n.district && n.district.toLowerCase() === d) || (n.district_slug && n.district_slug.toLowerCase() === d));
    }
    if (search) {
      const q = String(search).toLowerCase();
      news = news.filter(n => 
        (n.title && n.title.toLowerCase().includes(q)) || 
        (n.description && n.description.toLowerCase().includes(q)) ||
        (n.district_name_hi && n.district_name_hi.includes(q))
      );
    }

    const numLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const numPage = Math.max(parseInt(page) || 1, 1);
    const offset = (numPage - 1) * numLimit;
    const paginated = news.slice(offset, offset + numLimit);

    return res.status(200).json({
      success: true,
      status: 'ok',
      total: news.length,
      page: numPage,
      limit: numLimit,
      news: paginated
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      status: 'fallback',
      total: 0,
      news: [],
      error: err.message
    });
  }
};
