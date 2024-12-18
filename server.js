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
    try {
        // Validate that action exists
        if (!req.body.action) {
            return res.status(400).json({ error: 'Action is required' });
        }

        const { action, id } = req.body;

        // For delete operation, we only need the id
        if (action === 'delete') {
            if (!id) {
                return res.status(400).json({ error: 'Product ID is required for deletion' });
            }

            const [result] = await req.db.execute(
                'DELETE FROM phone_specs WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }

            return res.redirect('/products');
        }

        // For add and update operations, validate required fields
        if (!req.body.sm_name || !req.body.sm_maker) {
            return res.status(400).json({ error: 'Product name and maker are required' });
        }

        // Convert numeric fields to appropriate types
        const productData = {
            sm_name: req.body.sm_name,
            sm_maker: req.body.sm_maker,
            sm_price: req.body.sm_price ? parseInt(req.body.sm_price, 10) : null,
            sm_inventory: req.body.sm_inventory ? parseInt(req.body.sm_inventory, 10) : null,
            subbrand: req.body.subbrand || null,
            color: req.body.color || null,
            water_and_dust_rating: req.body.water_and_dust_rating || null,
            processor: req.body.processor || null,
            process_node: req.body.process_node || null,
            cpu_cores: req.body.cpu_cores || null,
            cpu_frequency: req.body.cpu_frequency || null,
            gpu: req.body.gpu || null,
            memory_type: req.body.memory_type || null,
            ram: req.body.ram || null,
            rom: req.body.rom || null,
            expandable_memory: req.body.expandable_memory || null,
            length_mm: req.body.length_mm ? parseFloat(req.body.length_mm) : null,
            width_mm: req.body.width_mm ? parseFloat(req.body.width_mm) : null,
            thickness_mm: req.body.thickness_mm ? parseFloat(req.body.thickness_mm) : null,
            weight_g: req.body.weight_g ? parseInt(req.body.weight_g, 10) : null,
            display_size: req.body.display_size ? parseFloat(req.body.display_size) : null,
            resolution: req.body.resolution || null,
            pixel_density: req.body.pixel_density ? parseInt(req.body.pixel_density, 10) : null,
            refresh_rate: req.body.refresh_rate || null,
            brightness: req.body.brightness || null,
            display_features: req.body.display_features || null,
            rear_camera_main: req.body.rear_camera_main || null,
            rear_camera_macro: req.body.rear_camera_macro || null,
            rear_camera_features: req.body.rear_camera_features || null,
            rear_video_resolution: req.body.rear_video_resolution || null,
            front_camera: req.body.front_camera || null,
            front_camera_features: req.body.front_camera_features || null,
            front_video_resolution: req.body.front_video_resolution || null,
            battery_capacity: req.body.battery_capacity ? parseInt(req.body.battery_capacity, 10) : null,
            fast_charging: req.body.fast_charging || null,
            connector: req.body.connector || null,
            security_features: req.body.security_features || null,
            sim_card: req.body.sim_card || null,
            nfc: req.body.nfc || null,
            network_bands: req.body.network_bands || null,
            wireless_connectivity: req.body.wireless_connectivity || null,
            navigation: req.body.navigation || null,
            audio_jack: req.body.audio_jack || null,
            audio_playback: req.body.audio_playback || null,
            video_playback: req.body.video_playback || null,
            sensors: req.body.sensors || null,
            operating_system: req.body.operating_system || null,
            package_contents: req.body.package_contents || null
        };

        // Remove any undefined values
        Object.keys(productData).forEach(key => 
            productData[key] === undefined && delete productData[key]
        );

        if (action === 'add') {
            // Create the INSERT query dynamically
            const fields = Object.keys(productData);
            const placeholders = fields.map(() => '?').join(', ');
            const values = fields.map(field => productData[field]);
            
            const query = `INSERT INTO phone_specs (${fields.join(', ')}) VALUES (${placeholders})`;
            
            const [result] = await req.db.execute(query, values);
            
            if (result.affectedRows !== 1) {
                throw new Error('Failed to add product');
            }

        } else if (action === 'update') {
            if (!id) {
                return res.status(400).json({ error: 'Product ID is required for update' });
            }

            // Create the UPDATE query dynamically
            const setClause = Object.keys(productData)
                .map(field => `${field} = ?`)
                .join(', ');
            const values = [...Object.values(productData), id];
            
            const query = `UPDATE phone_specs SET ${setClause} WHERE id = ?`;
            
            const [result] = await req.db.execute(query, values);

            if (result.affectedRows !== 1) {
                return res.status(404).json({ error: 'Product not found' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid action specified' });
        }

        res.redirect('/products');

    } catch (error) {
        console.error('Error during product management:', error);
        // Send a more specific error message
        res.status(500).json({ 
            error: 'Database operation failed', 
            details: error.message 
        });
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