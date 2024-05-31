const express = require('express');
const multer = require('multer');
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

app.get('/medicines', async (req, res) => {
  try {
    const submissions = await Submission.find();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching medicines' });
  }
});
// API endpoint to mark a submission as done
app.patch('/medicines/:id/done', (req, res) => {
  Submission.findByIdAndUpdate(req.params.id, { status: 'done' }, { new: true })
    .then(updatedSubmission => res.json(updatedSubmission))
    .catch(err => res.status(400).json('Error: ' + err));
});

// API endpoint to mark a submission as undone
app.patch('/medicines/:id/undone', (req, res) => {
  Submission.findByIdAndUpdate(req.params.id, { status: 'pending' }, { new: true })
    .then(updatedSubmission => res.json(updatedSubmission))
    .catch(err => res.status(400).json('Error: ' + err));
});

// API endpoint to delete a submission
app.delete('/medicines/:id', (req, res) => {
  Submission.findByIdAndDelete(req.params.id)
    .then(() => res.json('Submission deleted'))
    .catch(err => res.status(400).json('Error: ' + err));
});

// API endpoint to register a name along with a phone number
app.post('/register', async (req, res) => {
  const { phoneNumber, name } = req.body;

  try {
    // Check if the user already exists
    const existingSubmission = await Submission.findOne({ phoneNumber });

    if (existingSubmission) {
      // Update the user's name if they already exist
      existingSubmission.name = name;
      await existingSubmission.save();
      res.status(200).json({ message: 'Name updated successfully' });
    } else {
      // Create a new submission if they don't exist
      const newSubmission = new Submission({ phoneNumber, name });
      await newSubmission.save();
      res.status(201).json({ message: 'Name registered successfully' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Error registering name: ' + error });
  }
});


// API endpoint to handle form submissions
app.post('/submit-medicines', upload.array('images', 12), async (req, res) => {
  const { days, phoneNumber } = req.body;
  const imageFiles = req.files;

  try {
    const images = await Promise.all(imageFiles.map(async (file) => {
      const filePath = path.join(__dirname, file.path);
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

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
