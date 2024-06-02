const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

const shops = [
  { name: 'Pharmacy One', password: bcrypt.hashSync('password1', 10) },
  { name: 'Health Plus', password: bcrypt.hashSync('password2', 10) },
  { name: 'Wellness Store', password: bcrypt.hashSync('password3', 10) },
  { name: 'Medic Corner', password: bcrypt.hashSync('password4', 10) },
  { name: 'PharmaCare', password: bcrypt.hashSync('password5', 10) },
];

const secretKey = 'your_secret_key'; 


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
    contentType: String,
  }],
  name: String,
  description: String,
  address: String,
  shop: String,
});
const Submission = mongoose.model('Submission', submissionSchema);

// API endpoint to get orders by phone number
app.get('/orders', async (req, res) => {
  const { phoneNumber } = req.query;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const submissions = await Submission.find({ phoneNumber });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching medicines' });
  }
});

app.post('/login', (req, res) => {
  const { shopName, password } = req.body;
  const shop = shops.find((s) => s.name === shopName);
  if (shop && bcrypt.compareSync(password, shop.password)) {
    const token = jwt.sign({ shopName: shop.name }, secretKey, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid token' });
      } else {
        req.shopName = decoded.shopName;
        next();
      }
    });
  } else {
    res.status(401).json({ message: 'No token provided' });
  }
};

app.get('/medicines', authenticate, async (req, res) => {
  try {
    const medicines = await Medicine.find({ shop: req.shopName });
    res.json(medicines);
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

// API endpoint to handle form submissions
app.post('/submit-medicines', upload.array('images', 12), async (req, res) => {
  const { days, phoneNumber, name, description, address, shop } = req.body;
  const imageFiles = req.files;

  try {
    const images = await Promise.all(imageFiles.map(async (file) => {
      const filePath = path.join(__dirname, file.path);
      const fileData = await fs.promises.readFile(filePath);
      return {
        data: fileData,
        contentType: file.mimetype,
      };
    }));

    const newSubmission = new Submission({
      phoneNumber,
      days,
      images,
      name,
      description,
      address,
      shop,
    });

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
