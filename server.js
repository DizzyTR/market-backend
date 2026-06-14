const express = require("express")
const mysql = require("mysql2")
const cors = require("cors")
const http = require("http")
const { Server } = require("socket.io")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

const app = express()
const server = http.createServer(app)

const allowedOrigins = [
  "https://dizzytr.github.io",
  "https://dizzytr.github.io/ilkermarket.github.io",
  "https://ilkermarket.com.tr",
  "https://www.ilkermarket.com.tr"
]

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
})

app.use(cors({
  origin: [
    "https://ilkermarket.com.tr",
    "https://www.ilkermarket.com.tr",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
  ],
  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS"
  ],
  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ]
}))
app.use(express.json())

function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization || ""

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Admin girişi gerekli"
    })
  }

  const token = authorization.slice(7)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Yetkiniz bulunmuyor"
      })
    }

    req.admin = decoded
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Oturum geçersiz veya süresi dolmuş"
    })
  }
}

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

app.post("/products", requireAdmin, (req, res) => {

  const {
    name,
    price,
    desc,
    cat,
    subCat,
    emoji,
    imageUrl,
    active,
    featured
  } = req.body

  db.query(
    `INSERT INTO products 
    (name, price, \`desc\`, cat, subCat, emoji, imageUrl, active, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      price,
      desc,
      cat,
      subCat,
      emoji,
      imageUrl,
      active,
      featured
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

app.delete("/products/:id", requireAdmin, (req, res) => {

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

app.put("/products/:id", requireAdmin, (req, res) => {

  const id = req.params.id

  const {
    name,
    price,
    desc,
    cat,
    subCat,
    emoji,
    imageUrl,
    active,
    featured
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
      active=?,
      featured=?
     WHERE id=?`,
    [
      name,
      desc,
      price,
      cat,
      subCat,
      emoji,
      imageUrl,
      active ? 1 : 0,
      featured ? 1 : 0,
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

app.post("/categories", requireAdmin, (req, res) => {

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

app.put("/categories/:id", requireAdmin, (req, res) => {

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

app.delete("/categories/:id", requireAdmin, (req, res) => {

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

app.post("/subcategories", requireAdmin, (req, res) => {
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

app.put("/subcategories/:id", requireAdmin, (req, res) => {
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

app.delete("/subcategories/:id", requireAdmin, (req, res) => {
  const id = req.params.id

  db.query("DELETE FROM subcategories WHERE id=?", [id], (err) => {
    if (err) return res.status(500).json(err)
    res.json({ success: true })
  })
})

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Kullanıcı adı ve şifre gerekli"
    })
  }

  db.query(
    "SELECT * FROM admins WHERE username = ?",
    [username],
    async (err, result) => {
      if (err) {
        console.error("Admin sorgu hatası:", err)

        return res.status(500).json({
          success: false,
          message: "Sunucu hatası"
        })
      }

      if (result.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Hatalı giriş"
        })
      }

      try {
        const admin = result[0]

        const isMatch = await bcrypt.compare(
          password,
          admin.password
        )

        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: "Hatalı giriş"
          })
        }

        if (!process.env.JWT_SECRET) {
          console.error("JWT_SECRET tanımlanmamış")

          return res.status(500).json({
            success: false,
            message: "Sunucu yapılandırma hatası"
          })
        }

        const token = jwt.sign(
          {
            adminId: admin.id,
            username: admin.username,
            role: "admin"
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "30d"
          }
        )

        return res.json({
          success: true,
          message: "Giriş başarılı",
          token
        })

      } catch (error) {
        console.error("Admin giriş hatası:", error)

        return res.status(500).json({
          success: false,
          message: "Sunucu hatası"
        })
      }
    }
  )
})

app.get("/admin/verify", requireAdmin, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  })
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

app.put("/orders/:id/status", requireAdmin, (req, res) => {
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

app.post("/regions", requireAdmin, (req, res) => {
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

app.put("/regions/:id", requireAdmin, (req, res) => {
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

app.delete("/regions/:id", requireAdmin, (req, res) => {
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