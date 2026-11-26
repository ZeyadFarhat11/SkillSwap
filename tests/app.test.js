const request = require('supertest');
const app = require('../src/app');

describe('Phase 1 Express app & base layout', () => {
  test('GET /health returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('GET / renders base Pug layout with SkillSwap branding and Tailwind stylesheet', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Skill');
    expect(res.text).toContain('Swap');
    expect(res.text).toContain('/css/app.css');
  });

  test('GET /unknown-route renders friendly 404 error page without stack trace', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.text).toContain('404');
    expect(res.text).toContain('Page Not Found');
    expect(res.text).not.toContain('Error:');
  });
});
