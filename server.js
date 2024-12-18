// Required modules
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// Use EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

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

// Purchase History page
app.get('/purchaseHistory', async (req, res, next) => {
  try {
    const [results] = await req.db.execute('SELECT * FROM customer_data.order_details'); // Query all order details
    res.render('purchaseHistory', { orders: results });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    next(error);  // Pass the error to the error handling middleware
  }
});

// Customer Info page
app.get('/customerInfo', async (req, res, next) => {
  try {

    // Check if customer ID is provided
      const customerId = req.query.customerId; 
     let query = 'SELECT * FROM customer_data.customer_info'; // Default: show all customers

        let params= [];
        if (customerId) {
         query = 'SELECT * FROM customer_data.customer_info WHERE customer_id = ?';
         params = [customerId]  
        }


      const [results] = await req.db.execute(query, params);
      res.render('customerInfo', { customers: results });

  } catch (error) {
    console.error('Error fetching customer info:', error);
    next(error); 
  }
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
