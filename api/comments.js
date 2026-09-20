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
      message: 'टिप्पणी सफलतापूर्वक दर्ज की गई'
    });
  }

  return res.status(200).json({
    success: true,
    comments: [
      {
        id: 'c-demo-1',
        author: 'रवि कुमार',
        content: 'बिहार के विकास और नई योजनाओं की बहुत अच्छी जानकारी दी गई है।',
        time: '1 घंटा पहले',
        likes: 12
      }
    ]
  });
};
