const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let liveBlogPath = path.join(process.cwd(), 'data', 'live-blog.json');
    if (fs.existsSync(liveBlogPath)) {
      const raw = fs.readFileSync(liveBlogPath, 'utf-8');
      const data = JSON.parse(raw);
      return res.status(200).json(data);
    }

    // Fallback to latest-news.json
    const newsPath = path.join(process.cwd(), 'data', 'latest-news.json');
    const raw = fs.readFileSync(newsPath, 'utf-8');
    const data = JSON.parse(raw);
    const events = (data.news || []).slice(0, 15).map(n => ({
      id: n.id,
      title: n.title,
      description: n.description,
      pubDate: n.pubDate,
      time: n.pubDate,
      district: n.district || 'patna',
      district_name_hi: n.district_name_hi || 'बिहार',
      category: n.category || 'general',
      category_label: n.category_label_hi || 'ताज़ा खबर',
      reporter: n.reporter_name || 'विशेष संवाददाता'
    }));

    return res.status(200).json({
      success: true,
      total: events.length,
      events: events,
      timeline: events,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      total: 0,
      events: [],
      error: err.message
    });
  }
};
