const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection using environment variables
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

const userSchema = new mongoose.Schema({
  phoneNumber: String,
  name: String
});
const User = mongoose.model('User', userSchema);

app.get('/user/:phoneNumber', async (req, res) => {
  try {
    const user = await User.findOne({ phoneNumber: req.params.phoneNumber });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user data', error });
  }
});

app.post('/register', async (req, res) => {
  const { phoneNumber, name } = req.body;
  try {
    const user = new User({ phoneNumber, name });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error });
  }
});

// Define the route for handling the form submission
app.post('/submit-medicines', async (req, res) => {
  const form = new formidable.IncomingForm();
  form.uploadDir = uploadDir;
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ message: 'Error parsing form data' });
    }

    const { phoneNumber, days, description, userName } = fields;

    if (!phoneNumber || !days || !files.images) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const images = Array.isArray(files.images) ? files.images : [files.images];

    const imagePromises = images.map(file => {
      return new Promise((resolve, reject) => {
        fs.readFile(file.path, (err, data) => {
          if (err) reject(err);
          resolve({ data, contentType: file.type });
        });
      });
    });

    try {
      const imageData = await Promise.all(imagePromises);
      const newSubmission = new Submission({
        phoneNumber,
        days,
        images: imageData,
        description,
        userName
      });
      await newSubmission.save();
      res.status(201).json({ message: 'Submission saved successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error saving submission', error });
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
