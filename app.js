require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();

// Database connection pool configured for MAMP
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root', // MAMP default password
  database: process.env.DB_NAME || 'student_management',
  port: process.env.DB_PORT || 8889,         // MAMP default MySQL port
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
db.getConnection((err, conn) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to MySQL Database via MAMP.');
    conn.release();
  }
});

// Middleware & View Engine Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 1. READ: List all students
app.get('/', (req, res) => {
  const sql = 'SELECT * FROM students ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error reading records.');
    }
    res.render('index', { students: results, keyword: '' });
  });
});

// 2. SEARCH: Search students
app.get('/students/search', (req, res) => {
  const keyword = req.query.keyword ? req.query.keyword.trim() : '';
  const sql = `
    SELECT * FROM students 
    WHERE student_id LIKE ? 
       OR first_name LIKE ? 
       OR last_name LIKE ? 
       OR course LIKE ?
    ORDER BY id DESC
  `;
  const pattern = `%${keyword}%`;
  db.query(sql, [pattern, pattern, pattern, pattern], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Search operation failed.');
    }
    res.render('index', { students: results, keyword });
  });
});

// 3. CREATE: Show Add Form
app.get('/students/add', (req, res) => {
  res.render('add', { error: null, formData: {} });
});

// 3. CREATE: Process Add Form with Server-Side Validation
app.post('/students/add', (req, res) => {
  const { student_id, first_name, last_name, course, year_level, email } = req.body;

  // Validation
  if (!student_id || !first_name || !last_name || !course || !year_level || !email) {
    return res.status(400).render('add', {
      error: 'All fields are strictly required.',
      formData: req.body
    });
  }

  const parsedYear = parseInt(year_level, 10);
  if (isNaN(parsedYear) || parsedYear < 1 || parsedYear > 5) {
    return res.status(400).render('add', {
      error: 'Year level must be a numeric value between 1 and 5.',
      formData: req.body
    });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).render('add', {
      error: 'Please provide a valid email format.',
      formData: req.body
    });
  }

  const insertSql = `
    INSERT INTO students (student_id, first_name, last_name, course, year_level, email)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const values = [student_id.trim(), first_name.trim(), last_name.trim(), course.trim(), parsedYear, email.trim()];

  db.query(insertSql, values, (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).render('add', {
          error: `Student ID "${student_id}" is already registered.`,
          formData: req.body
        });
      }
      console.error(err);
      return res.status(500).send('Database error saving record.');
    }
    res.redirect('/');
  });
});

// 4. UPDATE: Show Edit Form
app.get('/students/edit/:id', (req, res) => {
  const studentId = req.params.id;
  const sql = 'SELECT * FROM students WHERE id = ?';
  db.query(sql, [studentId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).send('Student record not found.');
    }
    res.render('edit', { student: results[0], error: null });
  });
});

// 4. UPDATE: Process Edit Form
app.post('/students/edit/:id', (req, res) => {
  const recordId = req.params.id;
  const { student_id, first_name, last_name, course, year_level, email } = req.body;

  if (!student_id || !first_name || !last_name || !course || !year_level || !email) {
    return res.status(400).render('edit', {
      student: { id: recordId, ...req.body },
      error: 'All fields are required.'
    });
  }

  const updateSql = `
    UPDATE students 
    SET student_id = ?, first_name = ?, last_name = ?, course = ?, year_level = ?, email = ?
    WHERE id = ?
  `;
  const values = [student_id.trim(), first_name.trim(), last_name.trim(), course.trim(), parseInt(year_level, 10), email.trim(), recordId];

  db.query(updateSql, values, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error updating student.');
    }
    res.redirect('/');
  });
});

// 5. DELETE: Delete Student
app.post('/students/delete/:id', (req, res) => {
  const recordId = req.params.id;
  const deleteSql = 'DELETE FROM students WHERE id = ?';
  db.query(deleteSql, [recordId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Unable to delete student.');
    }
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});