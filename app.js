// Import required modules
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();


// Create Express application
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware configuration
app.use(morgan('dev'));  
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Set up EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, images, JS)
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const uri = 'mongodb+srv://Dani:Daniboy@cluster0.w37mibh.mongodb.net/';
const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('sample_mflix'); // Connect to sample_mflix database
        console.log('✅ Connected to MongoDB successfully');
        
        // Test the connection
        const moviesCount = await db.collection('movies').countDocuments();
        console.log(`📊 Found ${moviesCount} movies in database`);
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }
}
connectDB();

app.get('/', async (req, res) => {
    try {
        // Check if database is connected
        if (!db) {
            return res.render('index', { 
                movies: [], 
                error: 'Database not connected. Please try again later.' 
            });
        }

        // Get 10 most recent movies from database
        const movies = await db.collection('movies')
            .find({})                    // Find all documents
            .sort({ year: -1 })          // Sort by year descending (newest first)
            .limit(10)                   // Only get 10 movies
            .toArray();                  // Convert to JavaScript array

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

        // BUILD SEARCH FILTER
        const filter = {};
        
        // Filter by genre
        if (req.query.genre) {
            filter.genres = { $in: [req.query.genre] };
            // MongoDB: find movies where genres array contains the selected genre
        }
        
        // Filter by type (movie/series)
        if (req.query.type) {
            filter.type = req.query.type;
        }
        
        // Filter by year range
        if (req.query.yearFrom || req.query.yearTo) {
            filter.year = {};
            if (req.query.yearFrom) {
                filter.year.$gte = parseInt(req.query.yearFrom); // Greater than or equal
            }
            if (req.query.yearTo) {
                filter.year.$lte = parseInt(req.query.yearTo); // Less than or equal
            }
        }
        
        // Search in title
        if (req.query.title) {
            filter.title = { $regex: req.query.title, $options: 'i' };
            
        }
        
        // Search in plot
        if (req.query.plot) {
            filter.plot = { $regex: req.query.plot, $options: 'i' };
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

        // Get unique genres for dropdown
        const genres = await db.collection('movies').distinct('genres');

        // RENDER PAGE WITH DATA
        res.render('index', { 
            movies, 
            genres,
            query: req.query, // Pass search query back to form
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

        // Get data for dropdowns
        const titles = await db.collection('movies').distinct('title');
        const released = await db.collection('movies').distinct('released');
        const images = await db.collection('movies').distinct('poster');

        res.render('add-movie', {
            titles: titles || [],
            released: released || [],
            images: images || []
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

        // PREPARE MOVIE DATA FROM FORM
        const movieData = {
            title: req.body.title,
            year: parseInt(req.body.year),
            runtime: parseInt(req.body.runtime) || 0,
            genres: Array.isArray(req.body.genres) ? req.body.genres : [req.body.genres],
            cast: req.body.cast ? req.body.cast.split(',').map(s => s.trim()) : [],
            plot: req.body.plot,
            type: req.body.type,
            directors: req.body.directors ? req.body.directors.split(',').map(s => s.trim()) : [],
            languages: req.body.languages ? [req.body.languages] : ['English'],
            countries: req.body.countries ? req.body.countries.split(',').map(s => s.trim()) : ['USA'],
            rated: req.body.rated || 'NOT RATED',
            poster: req.body.poster,
            lastupdated: new Date().toISOString()
        };

        // INSERT INTO DATABASE
        const result = await db.collection('movies').insertOne(movieData);
        
        if (result.insertedId) {
            // Success - redirect to homepage with success message
            res.redirect('/?success=Movie added successfully!');
        } else {
            res.status(500).send('Error inserting movie');
        }
    } catch (error) {
        console.error('Error adding movie:', error);
        res.status(500).send('Error adding movie: ' + error.message);
    }
});

// Basic route to test server
app.get('/', (req, res) => {
    res.send('MongoDB Server is working!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});