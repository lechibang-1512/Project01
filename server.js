// Required modules
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();

// Use EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: '12345', // Change to a strong secret in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to `true` if using HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  }
}));

// MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '1212',
  database: 'master_specs_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Async middleware to get and release database connections
app.use(async (req, res, next) => {
  try {
    req.db = await pool.promise().getConnection();
    res.on('finish', () => req.db.release());
    next();
  } catch (err) {
    console.error('Error getting MySQL connection:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Routes

// Homepage
app.get('/', (req, res) => {
  res.render('homepage');
});

// Display all products
app.get('/products', async (req, res, next) => {
  try {
    const [results] = await req.db.execute('SELECT * FROM phone_specs');
    res.render('products', { products: results });
  } catch (error) {
    console.error('Error fetching products:', error);
    next(error);
  }
});

// Display single product details
app.get('/product/:id', async (req, res, next) => {
  const productId = req.params.id;
  try {
    const [results] = await req.db.execute('SELECT * FROM phone_specs WHERE id = ?', [productId]);
    if (results.length === 0) return res.status(404).send('Product not found');
    res.render('productDetails', { product: results[0] });
  } catch (err) {
    console.error('Error fetching product details:', err);
    next(err);
  }
});

// Accessories page
app.get('/accessories', (req, res) => {
  res.render('accessories');
});

// Contact Us page
app.get('/contactUs', (req, res) => {
  res.render('contactUs');
});

// Cart functionality
app.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  res.render('myCart', { cart });
});

app.post('/add-to-cart', async (req, res) => {
  const productId = req.body.productId;
  try {
    const [product] = await req.db.execute('SELECT * FROM phone_specs WHERE id = ?', [productId]);
    if (product.length === 0) return res.status(404).send('Product not found');

    const cart = req.session.cart || [];
    const existingProductIndex = cart.findIndex(item => item.id === productId);

    if (existingProductIndex !== -1) {
      cart[existingProductIndex].quantity++;
    } else {
      const productWithQuantity = { ...product[0], quantity: 1 };
      cart.push(productWithQuantity);
    }

    req.session.cart = cart;
    res.redirect('/cart');
  } catch (err) {
    console.error('Error adding product to cart:', err);
    res.status(500).send('Error adding product to cart');
  }
});

app.post('/remove-from-cart', (req, res) => {
  const productId = req.body.productId;
  let cart = req.session.cart || [];
  cart = cart.filter(item => item.id.toString() !== productId);
  req.session.cart = cart;
  res.redirect('/cart');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('General error handler:', err);
  res.status(500).send('Server error. Check console.');
});

// Graceful shutdown for MySQL pool
process.on('SIGINT', () => {
  console.log('Closing MySQL pool...');
  pool.end(err => {
    if (err) console.error('Error closing MySQL pool:', err);
    else console.log('MySQL pool closed. Goodbye!');
    process.exit();
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
