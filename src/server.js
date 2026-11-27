const http = require('http');
const env = require('./config/env');
const app = require('./app');
const { attachChatSocket } = require('./sockets/chatSocket');

const server = http.createServer(app);
const io = attachChatSocket(server, app.sessionMiddleware);
app.set('io', io);

server.listen(env.PORT, () => {
  console.log(`SkillSwap listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

module.exports = server;
