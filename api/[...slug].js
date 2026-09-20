const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let slug = req.query ? req.query.slug : '';
  if (Array.isArray(slug)) {
    slug = slug.join('/');
  } else if (!slug) {
    // If called via URL pathname fallback
    const url = req.url || '';
    const match = url.match(/^\/api\/?([^\?]*)/i);
    slug = match ? match[1] : '';
  }
  slug = String(slug || '').toLowerCase().replace(/^\/+|\/+$/g, '');

  // 1. /api/news
  if (slug === 'news' || slug === '') {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'latest-news.json');
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(raw);
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
      return res.status(200).json({
        success: true,
        status: 'ok',
        total: news.length,
        page: numPage,
        limit: numLimit,
        news: news.slice(offset, offset + numLimit)
      });
    } catch (e) {
      return res.status(200).json({ success: false, total: 0, news: [] });
    }
  }

  // 2. /api/districts
  if (slug === 'districts') {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'districts.json');
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(raw);
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
      return res.status(200).json({ success: true, status: 'ok', total: districts.length, districts });
    } catch (e) {
      return res.status(200).json({ success: false, total: 0, districts: [] });
    }
  }

  // 3. /api/live-blog
  if (slug === 'live-blog') {
    try {
      const p = path.join(process.cwd(), 'data', 'live-blog.json');
      if (fs.existsSync(p)) {
        return res.status(200).json(JSON.parse(fs.readFileSync(p, 'utf-8')));
      }
      const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'latest-news.json'), 'utf-8');
      const data = JSON.parse(raw);
      const events = (data.news || []).slice(0, 15);
      return res.status(200).json({ success: true, total: events.length, events, timeline: events });
    } catch (e) {
      return res.status(200).json({ success: false, total: 0, events: [] });
    }
  }

  // 4. /api/jobs
  if (slug === 'jobs') {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'jobs-results.json');
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      let jobs = data.items || data.jobs || [];
      const { category } = req.query || {};
      if (category && category !== 'all') {
        jobs = jobs.filter(j => j.category === category);
      }
      return res.status(200).json({ success: true, total: jobs.length, jobs, items: jobs, categories: data.categories || [] });
    } catch (e) {
      return res.status(200).json({ success: false, total: 0, jobs: [], items: [] });
    }
  }

  // 5. /api/emergency
  if (slug === 'emergency') {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'emergency-helplines.json'), 'utf-8'));
      return res.status(200).json(data);
    } catch (e) {
      return res.status(200).json({ success: false, helplines: [] });
    }
  }

  // 6. /api/directory
  if (slug === 'directory') {
    if (req.method === 'POST') {
      return res.status(200).json({ success: true, message: 'पंजीकरण अनुरोध प्राप्त हुआ' });
    }
    try {
      const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'business-directory.json'), 'utf-8'));
      return res.status(200).json({ success: true, total: (data.listings || []).length, listings: data.listings || [], categories: data.categories || [] });
    } catch (e) {
      return res.status(200).json({ success: false, listings: [] });
    }
  }

  // 7. /api/sync
  if (slug === 'sync') {
    return res.status(200).json({ status: 'ok', success: true, synced: true, added_count: 0 });
  }

  // 8. /api/status
  if (slug === 'status') {
    return res.status(200).json({ status: 'online', system: 'Bihar Samachar Hub Serverless API', version: '6.3.0' });
  }

  // 9. /api/events
  if (slug === 'events' || slug === 'stream') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write('event: connected\ndata: "connected"\n\n');
    return res.end();
  }

  // 10. /api/analytics/track
  if (slug === 'analytics/track' || slug.startsWith('analytics')) {
    return res.status(200).json({ success: true, tracked: true });
  }

  // 11. /api/comments
  if (slug.startsWith('comments')) {
    if (req.method === 'POST') {
      return res.status(200).json({ success: true, message: 'टिप्पणी दर्ज की गई' });
    }
    return res.status(200).json({ success: true, comments: [] });
  }

  // 12. /api/push/subscribe
  if (slug.startsWith('push')) {
    return res.status(200).json({ success: true, subscribed: true });
  }

  // 13. /api/auth
  if (slug.startsWith('auth')) {
    return res.status(200).json({ success: true, verified: true, token: 'demo' });
  }

  // Default catch-all
  return res.status(200).json({ success: true, route: slug, status: 'ok' });
};
