const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// Middleware setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


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

// Database connection middleware
app.use(async (req, res, next) => {
    try {
        req.db = await pool.promise().getConnection();
        res.on('finish', () => req.db.release());
        next();
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).send('Database connection error');
    }
});

// Homepage route
app.get('/', (req, res) => {
    res.render('homepage');
});

// Products route with filtering
app.get('/products', async (req, res, next) => {
    const { brand, subbrand, model } = req.query;

    try {
        // Fetch filter options
        const [brands] = await req.db.execute(
            'SELECT DISTINCT sm_maker FROM phone_specs ORDER BY sm_maker'
        );

        const [subbrands] = await req.db.execute(
            'SELECT DISTINCT subbrand FROM phone_specs WHERE subbrand IS NOT NULL ORDER BY subbrand'
        );

        const [models] = await req.db.execute(
            'SELECT DISTINCT sm_name FROM phone_specs ORDER BY sm_name'
        );

        // Build the product query
        let query = `
            SELECT id, sm_name, sm_maker, sm_price, sm_inventory, subbrand, 
                   color, water_and_dust_rating, processor, process_node, 
                   cpu_cores, cpu_frequency, gpu, memory_type, ram, rom, 
                   expandable_memory, length_mm, width_mm, thickness_mm, 
                   weight_g, display_size, resolution, pixel_density, 
                   refresh_rate, brightness, display_features, 
                   rear_camera_main, rear_camera_macro, rear_camera_features, 
                   rear_video_resolution, front_camera, front_camera_features, 
                   front_video_resolution, battery_capacity, fast_charging, 
                   connector, security_features, sim_card, nfc, network_bands, 
                   wireless_connectivity, navigation, audio_jack, 
                   audio_playback, video_playback, sensors, operating_system, 
                   package_contents
            FROM phone_specs 
            WHERE 1=1
        `;

        const params = [];

        if (brand) {
            query += ' AND sm_maker = ?';
            params.push(brand);
        }
        if (subbrand) {
            query += ' AND subbrand = ?';
            params.push(subbrand);
        }
        if (model) {
            query += ' AND sm_name = ?';
            params.push(model);
        }

        query += ' ORDER BY sm_maker, sm_name';

        // Execute the query
        const [products] = await req.db.execute(query, params);

        // Render the page with results
        res.render('products', {
            products,
            brands,
            subbrands,
            models,
            selectedBrand: brand || '',
            selectedSubbrand: subbrand || '',
            selectedModel: model || ''
        });

    } catch (error) {
        console.error('Error in /products route:', error);
        next(error);
    }
});

// Single product details route
app.get('/product/:id', async (req, res, next) => {
    try {
        const [product] = await req.db.execute(
            'SELECT * FROM phone_specs WHERE id = ?',
            [req.params.id]
        );

        if (!product || product.length === 0) {
            return res.status(404).render('error', {
                message: 'Product not found'
            });
        }

        res.render('productDetails', { product: product[0] });
    } catch (error) {
        console.error('Error fetching product details:', error);
        next(error);
    }
});

// Purchase History route
app.get('/purchaseHistory', async (req, res, next) => {
    try {
        const [orders] = await req.db.execute(`
            SELECT 
                c.first_name,
                c.last_name,
                c.email,
                c.phone_number,
                c.street_address,
                ps.sm_name,
                ps.sm_maker,
                ps.subbrand,
                ps.sm_price,
                ps.color,
                ps.ram,
                ps.rom,
                od.order_date
            FROM customer_data.order_details od
            JOIN master_specs_db.phone_specs ps ON od.phone_id = ps.id
            JOIN customer_data.customer_info c ON od.customer_id = c.customer_id
            ORDER BY od.order_date DESC
        `);
        res.render('purchaseHistory', { orders });
    } catch (error) {
        console.error('Error fetching purchase history:', error);
        next(error);
    }
});

// Customer Info route
app.get('/customerInfo', async (req, res, next) => {
    try {
        const { customerId } = req.query;
        let query = 'SELECT * FROM customer_data.customer_info';
        let params = [];

        if (customerId) {
            query += ' WHERE customer_id = ?';
            params.push(customerId);
        }

        query += ' ORDER BY customer_id';

        const [customers] = await req.db.execute(query, params);
        res.render('customerInfo', { customers });
    } catch (error) {
        console.error('Error fetching customer info:', error);
        next(error);
    }
});


// Product Management Route (CRUD)
app.post('/products/manage', async (req, res, next) => {
    const { action, id, sm_name, sm_maker, subbrand, sm_price, sm_inventory, color, ram, rom, water_and_dust_rating,
             processor, process_node, cpu_cores, cpu_frequency, gpu, memory_type, expandable_memory, length_mm,
             width_mm, thickness_mm, weight_g, display_size, resolution, pixel_density, refresh_rate, brightness,
             display_features, rear_camera_main, rear_camera_macro, rear_camera_features, rear_video_resolution,
             front_camera, front_camera_features, front_video_resolution, battery_capacity, fast_charging,
             connector, security_features, sim_card, nfc, network_bands, wireless_connectivity, navigation,
             audio_jack, audio_playback, video_playback, sensors, operating_system, package_contents
           } = req.body;

    const productData = {
        sm_name, sm_maker, subbrand, sm_price, sm_inventory, color, ram, rom,
        water_and_dust_rating, processor, process_node, cpu_cores, cpu_frequency, gpu,
        memory_type, expandable_memory, length_mm, width_mm, thickness_mm, weight_g,
        display_size, resolution, pixel_density, refresh_rate, brightness, display_features,
        rear_camera_main, rear_camera_macro, rear_camera_features, rear_video_resolution,
        front_camera, front_camera_features, front_video_resolution, battery_capacity,
        fast_charging, connector, security_features, sim_card, nfc, network_bands,
        wireless_connectivity, navigation, audio_jack, audio_playback, video_playback,
        sensors, operating_system, package_contents
    };
    try {
        if (action === 'add') {
            const [result] = await req.db.execute(
                'INSERT INTO phone_specs SET ?',
                [productData]
            );
           if (result.affectedRows === 1){
                console.log('Added product:', sm_name);
            }

        } else if (action === 'update') {
             const [result] = await req.db.execute(
                'UPDATE phone_specs SET ? WHERE id = ?',
                [productData, id]
            );
             if (result.affectedRows === 1){
                console.log('Updated product:', sm_name);
            }


        } else if (action === 'delete') {
            const [result] = await req.db.execute(
                'DELETE FROM phone_specs WHERE id = ?',
                [id]
            );
             if (result.affectedRows === 1){
                console.log('Deleted product with id:', id);
            }
        }
        res.redirect('/products'); // Redirect back to products page
    } catch (error) {
        console.error('Error during product management:', error);
        next(error);
    }
});


// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', {
        message: 'An error occurred. Please try again later.'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    pool.end(err => {
        if (err) console.error('Error closing MySQL pool:', err);
        process.exit(err ? 1 : 0);
    });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});