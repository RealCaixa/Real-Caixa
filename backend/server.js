const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Encontrar a raiz do projeto automaticamente
let RAIZ = path.join(__dirname, '..');
if (!fs.existsSync(path.join(RAIZ, 'index.html'))) {
    RAIZ = '/app';
}
if (!fs.existsSync(path.join(RAIZ, 'index.html'))) {
    RAIZ = __dirname;
}

console.log('📁 Raiz:', RAIZ);
console.log('📄 Arquivos:', fs.readdirSync(RAIZ));

// Servir arquivos estáticos
app.use(express.static(RAIZ));

// Rota principal
app.get('/', (req, res) => {
    const indexPath = path.join(RAIZ, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('<h1>Real Caixa</h1><p>Index não encontrado em: ' + RAIZ + '</p><p>Arquivos: ' + fs.readdirSync(RAIZ).join(', ') + '</p>');
    }
});

// API Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', raiz: RAIZ });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Servidor rodando na porta ' + PORT);
});