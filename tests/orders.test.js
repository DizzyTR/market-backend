const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Setup test environment
process.env.JWT_SECRET = 'test-secret-key-12345';

describe('API Tests - Orders Endpoints', () => {
  let app;
  let adminToken;
  let mockDb;
  let mockIo;

  beforeAll(() => {
    // Mock database
    mockDb = {
      query: jest.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        callback(null, []);
      })
    };

    // Mock Socket.io
    mockIo = {
      emit: jest.fn(),
      on: jest.fn()
    };

    // Setup app
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
    app.get('/orders', (req, res) => {
      mockDb.query('SELECT * FROM orders ORDER BY createdAt DESC', (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
      });
    });

    app.post('/orders', (req, res) => {
      const { customerName, customerAddress, customerPhone, customerRegion, paymentMethod, note, serviceFee, total, items } = req.body;

      // Validation
      if (!customerName || !customerPhone || !total || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Gerekli alanlar eksik'
        });
      }

      mockDb.query(
        `INSERT INTO orders (customerName, customerAddress, customerPhone, customerRegion, paymentMethod, note, serviceFee, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerName, customerAddress, customerPhone, customerRegion, paymentMethod, note, serviceFee, total],
        (err, result) => {
          if (err) {
            console.log('ORDER INSERT ERROR:', err);
            return res.status(500).json({ success: false, message: err.message });
          }

          const orderId = result?.insertId || 1;

          const values = items.map(item => [
            orderId,
            item.productId,
            item.productName,
            item.quantity,
            item.price,
            item.subtotal
          ]);

          mockDb.query(
            `INSERT INTO order_items (orderId, productId, productName, quantity, price, subtotal) VALUES ?`,
            [values],
            (err2) => {
              if (err2) {
                console.log('ORDER ITEMS ERROR:', err2);
                return res.status(500).json({ success: false, message: err2.message });
              }

              mockIo.emit('new-order', {
                orderId,
                customerName,
                total,
                status: 'Bekliyor'
              });

              res.json({ success: true, orderId });
            }
          );
        }
      );
    });

    app.put('/orders/:id/status', requireAdmin, (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status gerekli'
        });
      }

      mockDb.query('UPDATE orders SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) return res.status(500).json(err);

        mockIo.emit('order-status-updated', { id, status });

        res.json({ success: true });
      });
    });

    app.get('/orders/:id/items', (req, res) => {
      const orderId = req.params.id;

      mockDb.query(
        'SELECT * FROM order_items WHERE orderId = ?',
        [orderId],
        (err, items) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          res.json(items);
        }
      );
    });

    app.post('/track-order', (req, res) => {
      const { orderId, phone } = req.body;

      if (!orderId || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Sipariş ID ve telefon gerekli'
        });
      }

      const cleanedPhone = String(phone).replace(/[^0-9]/g, '');
      const phoneWithoutCountry = cleanedPhone.startsWith('90')
        ? '0' + cleanedPhone.slice(2)
        : cleanedPhone;

      mockDb.query(
        `SELECT id, customerName, customerPhone, customerAddress, customerRegion, paymentMethod, note, serviceFee, total, status, createdAt
         FROM orders
         WHERE id = ?
         AND (
           customerPhone = ?
           OR customerPhone = ?
           OR REPLACE(REPLACE(REPLACE(customerPhone, ' ', ''), '+', ''), '-', '') = ?
         )`,
        [orderId, cleanedPhone, phoneWithoutCountry, cleanedPhone],
        (err, result) => {
          if (err) return res.status(500).json({ success: false, message: err.message });
          if (result?.length === 0) {
            return res.status(404).json({ success: false, message: 'Sipariş bulunamadı' });
          }
          res.json({ success: true, order: result?.[0] });
        }
      );
    });

    app.get('/regions', (req, res) => {
      mockDb.query('SELECT * FROM regions', (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
      });
    });

    app.post('/regions', requireAdmin, (req, res) => {
      const { id, name, fee, active } = req.body;

      if (!id || !name || fee === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Gerekli alanlar eksik'
        });
      }

      mockDb.query(
        'INSERT INTO regions (id, name, fee, active) VALUES (?, ?, ?, ?)',
        [id, name, fee, active ? 1 : 0],
        (err) => {
          if (err) return res.status(500).json(err);
          res.json({ success: true });
        }
      );
    });
  });

  beforeEach(() => {
    adminToken = jwt.sign(
      { adminId: 1, username: 'test_admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    jest.clearAllMocks();
  });

  // --- ORDERS GET TESTS ---
  describe('GET /orders', () => {
    test('tüm siparişleri listele', (done) => {
      mockDb.query.mockImplementation((sql, callback) => {
        callback(null, [
          { id: 1, customerName: 'Ali', total: 500, status: 'Bekliyor' },
          { id: 2, customerName: 'Ayşe', total: 750, status: 'Gönderilen' }
        ]);
      });

      request(app)
        .get('/orders')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveLength(2);
          expect(res.body[0].customerName).toBe('Ali');
          done();
        });
    });

    test('database hatası 500 döndür', (done) => {
      mockDb.query.mockImplementation((sql, callback) => {
        callback(new Error('Database error'));
      });

      request(app)
        .get('/orders')
        .expect(500)
        .end(done);
    });
  });

  // --- ORDERS POST TESTS ---
  describe('POST /orders', () => {
    const validOrder = {
      customerName: 'Test Müşteri',
      customerAddress: 'Test Adresi',
      customerPhone: '5551234567',
      customerRegion: 'İstanbul',
      paymentMethod: 'Nakit',
      note: 'Teslimat notası',
      serviceFee: 10,
      total: 250,
      items: [
        {
          productId: 1,
          productName: 'Ürün 1',
          quantity: 2,
          price: 100,
          subtotal: 200
        }
      ]
    };

    test('siparişi başarıyla oluştur', (done) => {
      mockDb.query
        .mockImplementationOnce((sql, params, callback) => {
          callback(null, { insertId: 1 });
        })
        .mockImplementationOnce((sql, params, callback) => {
          callback(null, {});
        });

      request(app)
        .post('/orders')
        .send(validOrder)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.orderId).toBe(1);
          done();
        });
    });

    test('müşteri adı olmadan 400 döndür', (done) => {
      const incompleteOrder = { ...validOrder, customerName: null };

      request(app)
        .post('/orders')
        .send(incompleteOrder)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toContain('eksik');
          done();
        });
    });

    test('telefon olmadan 400 döndür', (done) => {
      const incompleteOrder = { ...validOrder, customerPhone: null };

      request(app)
        .post('/orders')
        .send(incompleteOrder)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toContain('eksik');
          done();
        });
    });

    test('ürün listesi olmadan 400 döndür', (done) => {
      const incompleteOrder = { ...validOrder, items: [] };

      request(app)
        .post('/orders')
        .send(incompleteOrder)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toContain('eksik');
          done();
        });
    });

    test('socket.io emit çağırılı', (done) => {
      mockDb.query
        .mockImplementationOnce((sql, params, callback) => {
          callback(null, { insertId: 5 });
        })
        .mockImplementationOnce((sql, params, callback) => {
          callback(null, {});
        });

      request(app)
        .post('/orders')
        .send(validOrder)
        .expect(200)
        .end((err) => {
          if (err) return done(err);
          expect(mockIo.emit).toHaveBeenCalledWith(
            'new-order',
            expect.objectContaining({
              orderId: 5,
              customerName: 'Test Müşteri',
              status: 'Bekliyor'
            })
          );
          done();
        });
    });
  });

  // --- ORDERS STATUS UPDATE TESTS ---
  describe('PUT /orders/:id/status', () => {
    test('admin olmadan 401 döndür', (done) => {
      request(app)
        .put('/orders/1/status')
        .send({ status: 'Gönderilen' })
        .expect(401)
        .end(done);
    });

    test('siparış durumunu güncelle', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, {});
      });

      request(app)
        .put('/orders/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Gönderilen' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(mockIo.emit).toHaveBeenCalledWith(
            'order-status-updated',
            { id: '1', status: 'Gönderilen' }
          );
          done();
        });
    });

    test('status olmadan 400 döndür', (done) => {
      request(app)
        .put('/orders/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400)
        .end(done);
    });
  });

  // --- ORDERS ITEMS TESTS ---
  describe('GET /orders/:id/items', () => {
    test('sipariş ürünlerini listele', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, [
          { orderId: 1, productId: 1, productName: 'Ürün 1', quantity: 2, price: 100, subtotal: 200 }
        ]);
      });

      request(app)
        .get('/orders/1/items')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].productName).toBe('Ürün 1');
          done();
        });
    });
  });

  // --- ORDER TRACKING TESTS ---
  describe('POST /track-order', () => {
    test('sipariş ID ve telefon olmadan 400 döndür', (done) => {
      request(app)
        .post('/track-order')
        .send({})
        .expect(400)
        .end(done);
    });

    test('geçerli telefon formatı ile siparişi bul', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, [
          { id: 1, customerName: 'Ali', total: 500, status: 'Bekliyor' }
        ]);
      });

      request(app)
        .post('/track-order')
        .send({ orderId: 1, phone: '5551234567' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.order.customerName).toBe('Ali');
          done();
        });
    });

    test('siparış bulunamazsa 404 döndür', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      request(app)
        .post('/track-order')
        .send({ orderId: 999, phone: '5551234567' })
        .expect(404)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).toContain('bulunamadı');
          done();
        });
    });

    test('+90 formatıyla telefon numarasını temizle', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, [
          { id: 1, customerName: 'Ali', total: 500 }
        ]);
      });

      request(app)
        .post('/track-order')
        .send({ orderId: 1, phone: '+905551234567' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });
  });

  // --- REGIONS TESTS ---
  describe('GET /regions', () => {
    test('bölgeleri listele', (done) => {
      mockDb.query.mockImplementation((sql, callback) => {
        callback(null, [
          { id: 'istanbul', name: 'İstanbul', fee: 10, active: 1 },
          { id: 'ankara', name: 'Ankara', fee: 15, active: 1 }
        ]);
      });

      request(app)
        .get('/regions')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).toHaveLength(2);
          expect(res.body[0].name).toBe('İstanbul');
          done();
        });
    });
  });

  describe('POST /regions', () => {
    test('admin olmadan 401 döndür', (done) => {
      request(app)
        .post('/regions')
        .send({ id: 'bursa', name: 'Bursa', fee: 12, active: true })
        .expect(401)
        .end(done);
    });

    test('bölge ekle başarılı', (done) => {
      mockDb.query.mockImplementation((sql, params, callback) => {
        callback(null, {});
      });

      request(app)
        .post('/regions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: 'bursa', name: 'Bursa', fee: 12, active: true })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });

    test('gerekli alanlar olmadan 400 döndür', (done) => {
      request(app)
        .post('/regions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: 'bursa' })
        .expect(400)
        .end(done);
    });
  });
});
