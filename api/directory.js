const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      success: true,
      message: 'संस्थान पंजीकरण अनुरोध सफलतापूर्वक प्राप्त हुआ (Verification Pending)'
    });
  }

  try {
    const dataPath = path.join(process.cwd(), 'data', 'business-directory.json');
    let raw = fs.readFileSync(dataPath, 'utf-8');
    let data = JSON.parse(raw);

    const { district, category } = req.query || {};
    let listings = data.listings || data.businesses || [];

    if (district && district !== 'all') {
      listings = listings.filter(l => l.district === district);
    }
    if (category && category !== 'all') {
      listings = listings.filter(l => l.category === category);
    }

    return res.status(200).json({
      success: true,
      total: listings.length,
      listings: listings,
      categories: data.categories || []
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      listings: [],
      error: err.message
    });
  }
};
