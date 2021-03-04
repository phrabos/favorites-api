const express = require('express');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const morgan = require('morgan');
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');
const request = require('superagent');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // http logging

const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/photos', async(req, res) => {
  try {
    const photos = await request.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_KEY}&start_date=2021-02-01&end_date=2021-03-02`);
    const filteredPhotos = photos.body.filter(photo => photo.media_type === 'image');
    
    res.json(filteredPhotos);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/favorites', async(req, res) => {
  try {
    const data = await client.query('SELECT * from favorites WHERE owner_id=$1', [req.userId]);
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/favorites/:id', async(req, res) => {
  try {
    const data = await client.query('DELETE from favorites WHERE owner_id=$1 and id=$2', [req.userId, req.params.id]);
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/favorites/', async(req, res) => {
  try {
    const data = await client.query(`
    INSERT INTO favorites (date, explanation, media_type, title, url, owner_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
`,
    [req.body.date, req.body.explanation, req.body.media_type, req.body.title, req.body.url, req.userId]);
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.use(require('./middleware/error'));

module.exports = app;
