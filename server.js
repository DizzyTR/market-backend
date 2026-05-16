const express = require("express")
const mysql = require("mysql2")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json())

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
    emoji,
    imageUrl,
    active
  } = req.body

  db.query(
    `INSERT INTO products 
    (name, price, \`desc\`, cat, emoji, imageUrl, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      price,
      desc,
      cat,
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
      emoji=?,
      imageUrl=?,
      active=?
     WHERE id=?`,
    [
      name,
      desc,
      price,
      cat,
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

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body

  db.query(
    "SELECT * FROM admins WHERE username = ? AND password = ?",
    [username, password],
    (err, result) => {
      if (err) {
        console.log(err)
        return res.status(500).json({ success: false, message: "Sunucu hatası" })
      }

      if (result.length === 0) {
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
      res.json({ success: true })
    }
  )
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server çalışıyor")
})
