const express = require('express');
const morgan = require('morgan');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { title } = require('process');
require('dotenv').config();


// Express application
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware configuration
app.use(morgan('dev'));  
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Set up EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const uri = 'mongodb+srv://Dani:Daniboy@cluster0.w37mibh.mongodb.net/';
const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('sample_mflix'); 
        console.log('Connected to MongoDB successfully');
        
        const moviesCount = await db.collection('movies').countDocuments();
        console.log(`Found ${moviesCount} movies in database`);
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
    }
}
connectDB();

app.get('/', async (req, res) => {
    try {
        
        if (!db) {
            return res.render('index', { 
                movies: [], 
                genres: [],
                query: {},
                title: 'Movie Database',
                error: 'Database not connected. Please try again later.' 
            });
        }

           const movies = await db.collection('movies')
            .find({})                    
            .sort({ year: -1 })         
            .limit(10)                  
            .toArray();                  

        // Render the index page with movie data
        res.render('index', { 
            movies: movies,
            error: null
        });
    } catch (error) {
        console.error('Error loading movies:', error);
        res.render('index', { 
            movies: [], 
            error: 'Error loading movies from database' 
        });
    }
});

app.get('/', async (req, res) => {
    try {
        if (!db) {
            return res.render('index', { 
                movies: [], 
                genres: [],
                query: {},
                error: 'Database not connected' 
            });
        }

        const filter = {};

         if (req.query.genre) {
            filter.genres = { $in: [req.query.genre] };
        }

        if (req.query.type) {
            filter.type = req.query.type;
        }
        
        // Filter by year range
        if (req.query.yearFrom || req.query.yearTo) {
            filter.year = {};
            if (req.query.yearFrom) {
                filter.year.$gte = parseInt(req.query.yearFrom); 
            }
            if (req.query.yearTo) {
                filter.year.$lte = parseInt(req.query.yearTo);
            }
        }
        
        // Search in title
        if (req.query.title) {
            filter.title = { $regex: req.query.title, $options: 'i' };
            
        }
        
        
        // SORTING
        const sortOrder = req.query.sort === 'asc' ? 1 : -1;
        const sort = { year: sortOrder };

        // GET DATA FROM DATABASE
        const movies = await db.collection('movies')
            .find(filter)
            .sort(sort)
            .limit(10)
            .toArray();

        const genres = await db.collection('movies').distinct('genres');

        // RENDER PAGE WITH DATA
        res.render('index', { 
            movies, 
            genres,
            query: req.query, 
            error: null
        });
    } catch (error) {
        console.error('Error:', error);
        res.render('index', { 
            movies: [], 
            genres: [],
            query: {},
            error: 'Error loading movies' 
        });
    }
});




// SHOW ADD MOVIE FORM
app.get('/movies/add-form', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).send('Database not connected');
        }
        const titles = await db.collection('movies').distinct('title');
        const released = await db.collection('movies').distinct('released');
        const images = await db.collection('movies').distinct('poster');
        const genres = await db.collection('movies').distinct('genres');

        res.render('add-movie', {
            titles: titles || [],
            released: released || [],
            images: images || [],
            genres: genres || []

        });
    } catch (error) {
        console.error('Error loading form:', error);
        res.status(500).send('Error loading form');
    }
});

// HANDLE MOVIE SUBMISSION
app.post('/movies/add-form', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).send('Database not connected');
        }
        
        const movieData = {
            title: req.body.title,
            year: parseInt(req.body.year),
            poster: req.body.poster,
            lastupdated: new Date().toISOString()
        };
        
        const result = await db.collection('movies').insertOne(movieData);
        
        if (result.insertedId) {
            
            res.redirect('/?success=Movie added successfully!');
        } else {
            res.status(500).send('Error inserting movie');
        }
    } catch (error) {
        console.error('Error adding movie:', error);
        res.status(500).send('Error adding movie: ' + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});