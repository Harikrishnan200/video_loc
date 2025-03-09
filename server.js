    const express = require('express');
    const path = require('path');
    const app = express();
    const http = require('http').Server(app);
    const { Server } = require('socket.io');

    const session = require('express-session');
    const bcrypt = require('bcrypt');
    const axios = require('axios');

    
    const io = new Server(http);
    const port = 3000;
    
   
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
        secret: 'super_secret_key',
        resave: false,
        saveUninitialized: false,
    }));
    app.use(express.static('public'));
    app.use(express.raw({ type: 'image/jpeg', limit: '10mb' }));
    
    // View Engine Setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
    




    

  
    app.get('/logout', (req, res) => {
        res.render('home');
    });
    // Protected Routes
    app.get('/', async (req, res) => {
        try {
            
            res.render('streamer', {
              
        token: req.session.token,  // Pass token to EJS
        djangoServerURL: req.session.djangoServerURL  // Pass Django server URL to EJS
            });
        } catch (error) {
            console.error('Error loading user dashboard:', error);
            res.status(500).send('Internal server error');
        }
    });
    
    // HTTP Streaming Routes
    const streams = new Map();
    const latestFrames = new Map();
    
    app.get('/stream/:id', (req, res) => {
        const streamId = req.params.id;
        console.log(`Client connected to stream: ${streamId}`);
    
        res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control': 'no-cache',
            'Connection': 'close'
        });
    
        streams.set(streamId, res);
    
        const latestFrame = latestFrames.get(streamId);
        if (latestFrame) {
            res.write('--frame\r\n');
            res.write('Content-Type: image/jpeg\r\n');
            res.write(`Content-Length: ${latestFrame.length}\r\n\r\n`);
            res.write(latestFrame);
            res.write('\r\n');
        }
    
        req.on('close', () => {
            console.log(`Stream ${streamId} closed`);
            streams.delete(streamId);
        });
    });
    
    app.post('/stream/:id', (req, res) => {
        const streamId = req.params.id;
        const client = streams.get(streamId);
        if (req.body) {
           
            latestFrames.set(streamId, req.body);
            if (client) {
                client.write('--frame\r\n');
                client.write('Content-Type: image/jpeg\r\n');
                client.write(`Content-Length: ${req.body.length}\r\n\r\n`);
                client.write(req.body);
                client.write('\r\n');
            }
        }
        res.sendStatus(200);
    });
    
    // Location sharing socket.io handling
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
    
    // Register Device
        socket.on('register_device', ({ email }) => {
            console.log(`Device registered: ${email}`);
        });
    
            // Handle Location Sharing
        socket.on("send_location", async (coords) => {
            const { email, lat, long, token, djangoServerURL } = coords;
            console.log(JSON.stringify({ email, lat, long, token }));
            console.log(`Django server URL: ${djangoServerURL}`);
    
                // Send data to the Django server
            try {
                const response = await axios.post(djangoServerURL, {
                    email,
                    latitude: lat,
                    longitude: long,
                    token
                });
                console.log(`Data sent to Django server : ${response.status}`);
            } catch (error) {
                console.error("Error sending data to Django server:", error.message);
            }
                // Emit location to other connected clients
            io.emit('receive-location', { id: socket.id, email, lat, long });
        });
    
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
    
    http.listen(process.env.PORT || 3000, () => {
        console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
    });
