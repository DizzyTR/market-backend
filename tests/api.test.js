const request = require('supertest');
const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Mock database
const mockDb = {
  query: jest.fn((sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
    }
    callback(null, []);
  })
};

// Mock mysql2
jest.mock('mysql2', () => ({
  createConnection: jest.fn(() => mockDb)
}));

// Setup test environment
process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.MYSQLHOST = 'localhost';
process.env.MYSQLUSER = 'test_user';
process.env.MYSQLPASSWORD = 'test_pass';
process.env.MYSQLDATABASE = 'test_db';

describe('API Tests - Products Endpoints', () => {
  let app;
  let adminToken;

  beforeAll(() => {
    // Basit Express app oluştur test için
    app = express();
    app.use(express.json());
    app.use(cors());

    // Middleware
    const requireAdmin = (req, res, next) => {
      const authorization = req.headers.authorization || '';
      if (!authorization.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Admin girişi gerekli'
        });
      }
      const token = authorization.slice(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Yetkiniz bulunmuyor'
          });
        }
        req.admin = decoded;
        next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Oturum geçersiz veya süresi dolmuş'
        });
      }
    };

    // Routes
    app.get('/', (req, res) => {
      res.send('API çalışıyor');
    });

    // Ürünleri listele
    app.get('/products', (req, res) => {
      mockDb.query('SELECT * FROM products', (err, result) => {
        if (err) res.status(500).json(err);
        else res.json(result);
      });
    });

    // Yeni ürün ekle
    app.post('/products', requireAdmin, (req, res) => {
      const { name, price, desc, cat, subCat, emoji, imageUrl, active, featured } = req.body;
      mockDb.query(
        `INSERT INTO products (name, price, \`desc\`, cat, subCat, emoji, imageUrl, active, featured) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, price, desc, cat, subCat, emoji, imageUrl, active, featured],
        (err, result) => {
          if (err) return res.status(500).json(err);
          res.json({ success: true, id: result?.insertId || 1 });
        }
      );
    });

    // Ürün sil
    app.delete('/products/:id', requireAdmin, (req, res) => {
      const id = req.params.id;
      mockDb.query('DELETE FROM products WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
      });
    });

    // Ürün güncelle
    app.put('/products/:id', requireAdmin, (req, res) => {
      const id = req.params.id;
      const { name, price, desc, cat, subCat, emoji, imageUrl, active, featured } = req.body;
      mockDb.query(
        `UPDATE products SET name=?, price=?, \`desc\`=?, cat=?, subCat=?, emoji=?, imageUrl=?, active=?, featured=? WHERE id=?`,
        [name, price, desc, cat, subCat, emoji, imageUrl, active ? 1 : 0, featured ? 1 : 0, id],
        (err) => {
          if (err) return res.status(500).json(err);
          res.json({ success: true });
        }
      );
    });

    // Kategorileri listele
    app.get('/categories', (req, res) => {
      mockDb.query('SELECT * FROM categories', (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
      });
    });

    // Kategori ekle
    app.post('/categories', requireAdmin, (req, res) => {
      const { id, name, emoji, color, textColor, active } = req.body;
      mockDb.query(
        `INSERT INTO categories (id, name, emoji, color, textColor, active) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, emoji, color, textColor, active],
        (err) => {
          if (err) return res.status(500).json(err);
          res.json({ success: true });
        }
      );
    });

    // Admin login
    app.post('/admin/login', (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Kullanıcı adı ve şifre gerekli'
        });
      }
      // Test için token döndür
      const token = jwt.sign(
        { adminId: 1, username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.json({ success: true, token });
    });

    // Admin verify
    app.get('/admin/verify', requireAdmin, (req, res) => {
      res.json({ success: true, admin: req.admin });
    });
  });

  beforeEach(() => {
    // Her test öncesi token oluştur
    adminToken = jwt.sign(
      { adminId: 1, username: 'test_admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    jest.clearAllMocks();
  });

  // --- PRODUCTS TESTS ---
  describe('GET /products', () => {
    test('ürünleri başarıyla getir', (done) => {
      mockDb.query.mockImplementation((sql, callback) => {
        callback(null, [
          { id: 1, name: 'Ürün 1', price: 100 },
          { id: 2, name: 'Ürün 2', price: 200 }
        ]);
      });

      request(app)
        .get('/products')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveLength(2);
          expect(res.body[0].name).toBe('Ürün 1');
          done();
        });
    });

    test('database hatası 500 döndür', (done) => {
      mockDb.query.mockImplementation((sql, callback) => {
        callback(new Error('Database error'));
      });

      request(app)
        .get('/products')
        .expect(500)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveProperty('message');
          done();
        });
    });
  });

  describe('POST /products', () => {
    test('admin token olmadan 401 döndür', (done) => {
      request(app)
        .post('/products')
        .send({ name: 'Yeni Ürün', price: 150 })
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toContain('Admin girişi gerekli');
          done();
        });
    });

    test('geçerli token ile ürün ekle', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, { insertId: 99 });
      });

      request(app)
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Yeni Ürün',
          price: 150,
          desc: 'Açıklama',
          cat: 'elektronik',
          subCat: 'telefon',
          emoji: '📱',
          imageUrl: 'https://example.com/image.png',
          active: true,
          featured: false
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.id).toBe(99);
          done();
        });
    });

    test('geçersiz token ile 401 döndür', (done) => {
      request(app)
        .post('/products')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Test' })
        .expect(401)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toContain('geçersiz');
          done();
        });
    });
  });

  describe('DELETE /products/:id', () => {
    test('admin olmadan ürün sil 401', (done) => {
      request(app)
        .delete('/products/1')
        .expect(401)
        .end(done);
    });

    test('admin ile ürün sil', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, { affectedRows: 1 });
      });

      request(app)
        .delete('/products/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });
  });

  describe('PUT /products/:id', () => {
    test('ürün güncelle başarılı', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, { affectedRows: 1 });
      });

      request(app)
        .put('/products/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Güncellenmiş Ürün',
          price: 200,
          desc: 'Yeni açıklama',
          cat: 'elektronik',
          subCat: 'telefon',
          emoji: '📱',
          imageUrl: 'https://example.com/new.png',
          active: true,
          featured: true
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });
  });

  // --- CATEGORIES TESTS ---
  describe('GET /categories', () => {
    test('kategorileri listele', (done) => {
      mockDb.query.mockImplementation((sql, callback) => {
        callback(null, [
          { id: 'elektronik', name: 'Elektronik', emoji: '📱' },
          { id: 'gida', name: 'Gıda', emoji: '🍎' }
        ]);
      });

      request(app)
        .get('/categories')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveLength(2);
          expect(res.body[0].name).toBe('Elektronik');
          done();
        });
    });
  });

  describe('POST /categories', () => {
    test('kategori ekle başarılı', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, {});
      });

      request(app)
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: 'yeni',
          name: 'Yeni Kategori',
          emoji: '✨',
          color: '#FF0000',
          textColor: '#FFFFFF',
          active: true
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });
  });

  // --- AUTH TESTS ---
  describe('POST /admin/login', () => {
    test('username ve password olmadan 400 döndür', (done) => {
      request(app)
        .post('/admin/login')
        .send({})
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toContain('gerekli');
          done();
        });
    });

    test('başarılı login token döndür', (done) => {
      request(app)
        .post('/admin/login')
        .send({
          username: 'admin',
          password: 'password123'
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.token).toBeDefined();
          expect(typeof res.body.token).toBe('string');
          done();
        });
    });
  });

  describe('GET /admin/verify', () => {
    test('geçerli token ile verify başarılı', (done) => {
      request(app)
        .get('/admin/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.admin).toBeDefined();
          done();
        });
    });

    test('token olmadan 401 döndür', (done) => {
      request(app)
        .get('/admin/verify')
        .expect(401)
        .end(done);
    });
  });

  describe('GET /', () => {
    test('health check başarılı', (done) => {
      request(app)
        .get('/')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.text).toBe('API çalışıyor');
          done();
        });
    });
  });
});
