const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Create a new express app
const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000', // Allow local development
  'https://quickshop-one.vercel.app' // Allow production frontend
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: 'OPTIONS,GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  allowedHeaders: 'Content-Type,Authorization',
}));
app.use(express.json());

// MongoDB connection using environment variables
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Define a schema and model for submissions
const submissionSchema = new mongoose.Schema({
  phoneNumber: String,
  days: Number,
  images: [{
    data: Buffer,
    contentType: String
  }],
});
const Submission = mongoose.model('Submission', submissionSchema);

// API endpoint to handle form submissions

app.post('/api/submit-medicines', upload.array('images', 12), async (req, res) => {
  const { days, phoneNumber } = req.body;
  const imageFiles = req.files;

  try {
    const images = await Promise.all(imageFiles.map(async (file) => {
      const filePath = path.join(__dirname, '../', file.path);
      const fileData = await fs.promises.readFile(filePath);
      return {
        data: fileData,
        contentType: file.mimetype
      };
    }));

    const newSubmission = new Submission({ phoneNumber, days, images });

    await newSubmission.save();
    res.status(200).json('Submission successful');
  } catch (error) {
    res.status(400).json('Error: ' + error);
  }
});

module.exports = app;
