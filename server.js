const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `bg_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8000000 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

const SCORES_FILE = path.join(__dirname, 'scores.json');

function readScores() {
  try { return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); }
  catch { return []; }
}
function writeScores(scores) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/scores', (req, res) => {
  res.json(readScores().slice(0, 10));
});

app.post('/scores', (req, res) => {
  const { name, score } = req.body || {};
  if (typeof score !== 'number' || !name) return res.status(400).json({ error: 'Invalid' });
  const scores = readScores();
  scores.push({
    name: String(name).slice(0, 12).toUpperCase().replaceAll(/[^A-Z0-9 _-]/g, ''),
    score: Math.floor(score),
    date: new Date().toISOString().slice(0, 10),
  });
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, 20);
  writeScores(top);
  res.json(top.slice(0, 10));
});

app.post('/upload-bg', upload.single('background'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: `/uploads/${req.file.filename}` });
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n  BREAKOUT running → http://localhost:${PORT}\n`);
});
