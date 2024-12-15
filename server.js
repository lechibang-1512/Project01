const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();

// Use EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Serve static files (like CSS)
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: false }));



// MySQL connection pool (Corrected)
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // Replace with your MySQL username
    password: '1212',  // Replace with your MySQL password
    database: 'master_specs_db',  // Replace with your database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initiate session for express-session
app.use(session({
  secret: '12345', // Change this to any string you want
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to `true` if you are using HTTPS
}));




//PROMISE-BASED CONNECTION HANDLING
// Async middleware to get and release database connections
app.use(async (req, res, next) => {
  try {
    req.db = await pool.promise().getConnection(); // Using promise-based connection
    // Associate the release function to automatically close resources, even for unhandled rejections.
    res.on('finish', () => {
       req.db.release() 
    })
    next();
  } catch (err) {
    console.error('Error getting MySQL connection:', err);
    res.status(500).send('Internal Server Error');
  }
});




// Route for the homepage
app.get('/', (req, res) => {

    res.render('homepage');
});

// Route to display all products (now at /products)

app.get('/products', async (req, res, next) => {

    try{

        const [results] = await req.db.execute('SELECT * FROM phone_specs');
        res.render('products', {products:results});
        
    }catch (error){
        console.log("fetching error",error)
        next(error);
    }finally {
      
    }


});


// Route to display a single product's details (using async/await)
app.get('/product/:id', async (req, res, next) => {
  const productId = req.params.id;
  try {
    const [results] = await req.db.execute('SELECT * FROM phone_specs WHERE id = ?', [productId]);
    if (results.length === 0) {
      return res.status(404).send('Product not found');
    }
    res.render('productDetails', { product: results[0] });
  } catch (err) {
    console.error('Error fetching product details:', err);
    next(err); // Let the general error handler take care of it.

  } finally {
     
  }

});

app.get("/accessories", (req, res) => {

    res.render("accessories");
});

app.get("/contactUs", (req, res) => {

    res.render("contactUs");
});



app.get("/myCart", (req, res) => {

    res.render("myCart");
});





// Error handling middleware 
app.use((err, req, res, next) => { //general error catching middleware
    console.error('General error handler: ',err)
    res.status(500).send("server error. check console") //this sends response to the frontend only. It doesn't halt execution
    //if error occurred at sql level the connections and resources  still need to be freed even though unhandled, using finally inside app.use causes issue here as well
})


const port = process.env.PORT || 3000;

// Start the server


app.listen(port,() =>{


    console.log(`server is running at ${port}`);


})


process.on("SIGINT", ()=>{ //process signal received


    console.log("closing pool...");


    pool.end(err =>{ //attempt at proper closure, but err still pops


        if(err){


            console.error("pool closed incorrectly.",err)


        }else{


            console.log("pool closed. bye");


        }


        process.exit()


    });
   
})

// Middleware to handle add to cart actions
app.post('/add-to-cart', async (req, res) => {
  const productId = req.body.productId;

  try {
    // Fetch the product from the database
    const [product] = await req.db.execute('SELECT * FROM phone_specs WHERE id = ?', [productId]);

    if (product.length === 0) {
      return res.status(404).send('Product not found');
    }

    // Get the cart from the session, or create an empty cart if it doesn't exist
    let cart = req.session.cart || [];

    // Add the product to the cart
    cart.push(product[0]); // Add the product object to the cart array

    // Update the cart in the session
    req.session.cart = cart;

    // Redirect to the cart page or the product details page
    res.redirect('/cart'); // Or res.redirect('back') to go to the previous page
  } catch (err) {
    console.error('Error adding product to cart:', err);
    res.status(500).send('Error adding product to cart');
  }
});

// In server.js
app.get('/cart', (req, res) => {
  const cart = req.session.cart || []; // Get cart from session, or an empty array
  res.render('myCart', { cart: cart });
});

app.post('/remove-from-cart', (req, res) => {
  const productId = req.body.productId;
  let cart = req.session.cart || [];

  // Filter out the product to be removed
  cart = cart.filter(item => item.id.toString() !== productId);

  req.session.cart = cart;
  res.redirect('/cart');
});