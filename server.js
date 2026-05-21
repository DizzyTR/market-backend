const express = require("express")
const mysql = require("mysql2")
const cors = require("cors")
const http = require("http")
const { Server } = require("socket.io")
const bcrypt = require("bcrypt")

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
})

app.use(cors())
app.use(express.json())

io.on("connection", (socket) => {
  console.log("Admin socket bağlandı:", socket.id)

  socket.on("disconnect", () => {
    console.log("Socket ayrıldı:", socket.id)
  })
})

/*const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: Number(process.env.MYSQLPORT)
})*/

/*const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root17",
  database: "marketdb",
  port: 3306
})*/

const db = mysql.createConnection({
  host: process.env.MYSQLHOST || "localhost",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "LOCAL_MYSQL_SIFREN",
  database: process.env.MYSQLDATABASE || "marketdb",
  port: Number(process.env.MYSQLPORT || 3306)
})

db.connect((err) => {
  if (err) {
    console.log("MySQL bağlantı hatası:", err)
  } else {
    console.log("MySQL bağlandı!")
  }
})

app.get("/", (req, res) => {
  res.send("API çalışıyor")
})

app.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, result) => {
    if (err) {
      res.json(err)
    } else {
      res.json(result)
    }
  })
})

app.post("/products", (req, res) => {

  const {
    name,
    price,
    desc,
    cat,
    subCat,
    emoji,
    imageUrl,
    active
  } = req.body

  db.query(
    `INSERT INTO products 
    (name, price, \`desc\`, cat, subCat, emoji, imageUrl, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      price,
      desc,
      cat,
      subCat,
      emoji,
      imageUrl,
      active
    ],
    (err, result) => {

      if (err) {
        console.log(err)
        return res.status(500).json(err)
      }

      res.json({
        success: true,
        id: result.insertId
      })
    }
  )
})

app.delete("/products/:id", (req, res) => {

  const id = req.params.id

  db.query(
    "DELETE FROM products WHERE id = ?",
    [id],
    (err, result) => {

      if (err) {
        console.log(err)
        return res.status(500).json(err)
      }

      res.json({
        success: true
      })

    }
  )

})

app.put("/products/:id", (req, res) => {

  const id = req.params.id

  const {
    name,
    desc,
    price,
    cat,
    subCat,
    emoji,
    imageUrl,
    active
  } = req.body

  db.query(
    `UPDATE products
     SET
      name=?,
      \`desc\`=?,
      price=?,
      cat=?,
      subCat=?,
      emoji=?,
      imageUrl=?,
      active=?
     WHERE id=?`,
    [
      name,
      desc,
      price,
      cat,
      subCat,
      emoji,
      imageUrl,
      active,
      id
    ],
    (err, result) => {

      if (err) {
        console.log(err)
        return res.status(500).json(err)
      }

      res.json({
        success: true
      })

    }
  )

})

app.get("/categories", (req, res) => {

  db.query(
    "SELECT * FROM categories",
    (err, result) => {

      if (err) {
        return res.status(500).json(err)
      }

      res.json(result)

    }
  )

})

app.post("/categories", (req, res) => {

  const {
    id,
    name,
    emoji,
    color,
    textColor,
    active
  } = req.body

  db.query(
    `INSERT INTO categories
    (id, name, emoji, color, textColor, active)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      emoji,
      color,
      textColor,
      active
    ],
    (err, result) => {

      if (err) {
        return res.status(500).json(err)
      }

      res.json({
        success: true
      })

    }
  )

})

app.put("/categories/:id", (req, res) => {

  const oldId = req.params.id

  const {
    id,
    name,
    emoji,
    color,
    textColor,
    active
  } = req.body

  db.query(
    `UPDATE categories
     SET
      id=?,
      name=?,
      emoji=?,
      color=?,
      textColor=?,
      active=?
     WHERE id=?`,
    [
      id,
      name,
      emoji,
      color,
      textColor,
      active,
      oldId
    ],
    (err, result) => {

      if (err) {
        return res.status(500).json(err)
      }

      res.json({
        success: true
      })

    }
  )

})

app.delete("/categories/:id", (req, res) => {

  const id = req.params.id

  db.query(
    "DELETE FROM categories WHERE id=?",
    [id],
    (err, result) => {

      if (err) {
        return res.status(500).json(err)
      }

      res.json({
        success: true
      })

    }
  )

})

app.get("/subcategories", (req, res) => {
  db.query("SELECT * FROM subcategories", (err, result) => {
    if (err) return res.status(500).json(err)
    res.json(result)
  })
})

app.post("/subcategories", (req, res) => {
  const { id, catId, name, active } = req.body

  db.query(
    "INSERT INTO subcategories (id, catId, name, active) VALUES (?, ?, ?, ?)",
    [id, catId, name, active ? 1 : 0],
    (err) => {
      if (err) return res.status(500).json(err)
      res.json({ success: true })
    }
  )
})

app.put("/subcategories/:id", (req, res) => {
  const oldId = req.params.id
  const { id, catId, name, active } = req.body

  db.query(
    "UPDATE subcategories SET id=?, catId=?, name=?, active=? WHERE id=?",
    [id, catId, name, active ? 1 : 0, oldId],
    (err) => {
      if (err) return res.status(500).json(err)
      res.json({ success: true })
    }
  )
})

app.delete("/subcategories/:id", (req, res) => {
  const id = req.params.id

  db.query("DELETE FROM subcategories WHERE id=?", [id], (err) => {
    if (err) return res.status(500).json(err)
    res.json({ success: true })
  })
})

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body

  db.query(
    "SELECT * FROM admins WHERE username = ?",
    [username],
    async (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Sunucu hatası" })
      }

      if (result.length === 0) {
        return res.status(401).json({ success: false, message: "Hatalı giriş" })
      }

      const admin = result[0]
      const isMatch = await bcrypt.compare(password, admin.password)

      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Hatalı giriş" })
      }

      res.json({ success: true, message: "Giriş başarılı" })
    }
  )
})

app.get("/orders", (req, res) => {
  db.query(
    "SELECT * FROM orders ORDER BY createdAt DESC",
    (err, result) => {
      if (err) return res.status(500).json(err)
      res.json(result)
    }
  )
})

app.put("/orders/:id/status", (req, res) => {
  const id = req.params.id
  const { status } = req.body

  db.query(
    "UPDATE orders SET status = ? WHERE id = ?",
    [status, id],
    (err) => {
      if (err) return res.status(500).json(err)

      io.emit("order-status-updated", {
        id,
        status
      })

      res.json({ success: true })
    }
  )
})

app.post("/orders", (req, res) => {
  const {
    customerName,
    customerAddress,
    customerPhone,
    customerRegion,
    paymentMethod,
    note,
    serviceFee,
    total,
    items
  } = req.body

  db.query(
    `INSERT INTO orders
    (customerName, customerAddress, customerPhone, customerRegion, paymentMethod, note, serviceFee, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerName,
      customerAddress,
      customerPhone,
      customerRegion,
      paymentMethod,
      note,
      serviceFee,
      total
    ],
    (err, result) => {
      if (err) {
        console.log("ORDER INSERT ERROR:", err)
        return res.status(500).json({ success: false, message: err.message })
      }

      const orderId = result.insertId

      const values = items.map(item => [
        orderId,
        item.productId,
        item.productName,
        item.quantity,
        item.price,
        item.subtotal
      ])

      db.query(
        `INSERT INTO order_items
        (orderId, productId, productName, quantity, price, subtotal)
        VALUES ?`,
        [values],
        (err2) => {
          if (err2) {
            console.log("ORDER ITEMS ERROR:", err2)
            return res.status(500).json({ success: false, message: err2.message })
          }
          io.emit("new-order", {
            orderId,
            customerName,
            total,
            status: "Bekliyor"
          })

          res.json({ success: true, orderId })
        }
      )
    }
  )
})

app.get("/orders/:id/items", (req, res) => {
  const orderId = req.params.id

  db.query(
    "SELECT * FROM order_items WHERE orderId = ?",
    [orderId],
    (err, items) => {
      if (err) return res.status(500).json({ success: false, message: err.message })

      res.json(items)
    }
  )
})

app.post("/track-order", (req, res) => {
  const { orderId, phone } = req.body

  const cleanedPhone = String(phone).replace(/[^0-9]/g, "")
  const phoneWithoutCountry = cleanedPhone.startsWith("90")
    ? "0" + cleanedPhone.slice(2)
    : cleanedPhone

  db.query(
    `SELECT id, customerName, customerPhone, customerRegion, total, status, createdAt
     FROM orders
     WHERE id = ?
     AND (
      customerPhone = ?
      OR customerPhone = ?
      OR REPLACE(REPLACE(REPLACE(customerPhone, ' ', ''), '+', ''), '-', '') = ?
     )`,
    [orderId, cleanedPhone, phoneWithoutCountry, cleanedPhone],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.message })

      if (result.length === 0) {
        return res.status(404).json({ success: false, message: "Sipariş bulunamadı" })
      }

      res.json({ success: true, order: result[0] })
    }
  )
})

app.get("/regions", (req, res) => {
  db.query("SELECT * FROM regions", (err, result) => {
    if (err) return res.status(500).json(err)
    res.json(result)
  })
})

app.post("/regions", (req, res) => {
  const { id, name, fee, active } = req.body

  db.query(
    "INSERT INTO regions (id, name, fee, active) VALUES (?, ?, ?, ?)",
    [id, name, fee, active ? 1 : 0],
    (err) => {
      if (err) return res.status(500).json(err)
      res.json({ success: true })
    }
  )
})

app.put("/regions/:id", (req, res) => {
  const oldId = req.params.id
  const { id, name, fee, active } = req.body

  db.query(
    "UPDATE regions SET id=?, name=?, fee=?, active=? WHERE id=?",
    [id, name, fee, active ? 1 : 0, oldId],
    (err) => {
      if (err) return res.status(500).json(err)
      res.json({ success: true })
    }
  )
})

app.delete("/regions/:id", (req, res) => {
  const id = req.params.id

  db.query(
    "DELETE FROM regions WHERE id=?",
    [id],
    (err) => {
      if (err) return res.status(500).json(err)
      res.json({ success: true })
    }
  )
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log(`Server çalışıyor: ${PORT}`)
})