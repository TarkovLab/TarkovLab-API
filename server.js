const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend app
app.use(cors());

// Path to the TarkovData folder
const dataDir = path.join(__dirname, '..', 'TarkovData');

// Utility to read JSON
const readJsonFile = (filename) => {
    try {
        const filePath = path.join(dataDir, filename);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error(`Error reading ${filename}:`, err);
    }
    return null;
};

// --- Endpoints ---

// Check API health
app.get('/', (req, res) => {
    res.json({ message: 'TarkovLab API is running' });
});

// Get items
app.get('/api/items', (req, res) => {
    const data = readJsonFile('items.en.json');
    if (data) return res.json(data);
    res.status(404).json({ error: 'Items not found' });
});

// Get quests
app.get('/api/quests', (req, res) => {
    const data = readJsonFile('quests.json');
    if (data) return res.json(data);
    res.status(404).json({ error: 'Quests not found' });
});

// Get hideout
app.get('/api/hideout', (req, res) => {
    const data = readJsonFile('hideout.json');
    if (data) return res.json(data);
    res.status(404).json({ error: 'Hideout not found' });
});

// Get maps
app.get('/api/maps', (req, res) => {
    const data = readJsonFile('maps.json');
    if (data) return res.json(data);
    res.status(404).json({ error: 'Maps not found' });
});

// Get traders
app.get('/api/traders', (req, res) => {
    const data = readJsonFile('traders.json');
    if (data) return res.json(data);
    res.status(404).json({ error: 'Traders not found' });
});

// Get ammunition
app.get('/api/ammunition', (req, res) => {
    const data = readJsonFile('ammunition.json');
    if (data) return res.json(data);
    res.status(404).json({ error: 'Ammunition not found' });
});

// Get generic endpoint for any other JSON in TarkovData
app.get('/api/data/:filename', (req, res) => {
    const { filename } = req.params;
    // ensure no directory traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const data = readJsonFile(filename.endsWith('.json') ? filename : `${filename}.json`);
    if (data) return res.json(data);
    res.status(404).json({ error: 'Data not found' });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
