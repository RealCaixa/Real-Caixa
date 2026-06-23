const { executarComando } = require('./database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');

function setupWebSocket(io) {
    io.on('connection', (socket) => {
        console.log('🔌 PDV conectado:', socket.id);

        socket.on('autenticar_pdv', (data) => {
            const { token, pdv_id } = data;
            
            try {
                const user = jwt.verify(token, JWT_SECRET);
                
                executarComando(
                    `INSERT INTO pdv_conexoes (cliente_id, pdv_id, status) 
                     VALUES (?, ?, 'online')
                     ON CONFLICT(pdv_id) DO UPDATE SET ultima_conexao = CURRENT_TIMESTAMP, status = 'online'`,
                    [user.id, pdv_id]
                );

                socket.clienteId = user.id;
                socket.pdvId = pdv_id;
                
                socket.emit('autenticado', { 
                    mensagem: 'PDV autenticado com sucesso!',
                    cliente_id: user.id 
                });
                
                console.log(`✅ PDV ${pdv_id} autenticado`);
                
            } catch (err) {
                socket.emit('erro_autenticacao', { erro: 'Token inválido.' });
            }
        });

        socket.on('nova_venda', (data) => {
            if (!socket.clienteId) return;
            
            try {
                const { itens, total, desconto, forma_pagamento } = data;
                
                const result = executarComando(
                    'INSERT INTO vendas (cliente_id, pdv_id, total, desconto, forma_pagamento, sincronizada) VALUES (?, ?, ?, ?, ?, 1)',
                    [socket.clienteId, socket.pdvId, total, desconto || 0, forma_pagamento]
                );

                socket.emit('venda_confirmada', {
                    venda_id: result.lastInsertRowid,
                    mensagem: 'Venda sincronizada!'
                });

            } catch (err) {
                socket.emit('erro_venda', { erro: err.message });
            }
        });

        socket.on('disconnect', () => {
            if (socket.pdvId) {
                console.log(`🔌 PDV ${socket.pdvId} desconectado`);
            }
        });
    });
}

module.exports = setupWebSocket;