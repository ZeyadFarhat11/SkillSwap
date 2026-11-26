const env = require('./config/env');
const app = require('./app');

const server = app.listen(env.PORT, () => {
  console.log(`SkillSwap listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

module.exports = server;
