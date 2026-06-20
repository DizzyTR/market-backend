// Test setup ve mock database ayarları
const mysql = require('mysql2');

// Mock database bağlantısı
const mockDb = {
  query: jest.fn(),
  connect: jest.fn((callback) => callback(null)),
  end: jest.fn()
};

// Mock Socket.io
jest.mock('socket.io', () => {
  return {
    Server: jest.fn(() => ({
      on: jest.fn(),
      emit: jest.fn()
    }))
  };
});

// Mock mysql2
jest.mock('mysql2', () => ({
  createConnection: jest.fn(() => mockDb)
}));

module.exports = mockDb;
