const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Pasta public
const PUBLIC = path.join(__dirname, 'public');
console.log('📁 Public:', PUBLIC);
console.log('📄 Conteúdo:', fs.readdirSync(PUBLIC));

// Servir arquivos estáticos
app.use(express.static(PUBLIC));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC, 'index.html'));
});

// API Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', version: '2.1.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Servidor rodando na porta ' + PORT);
});