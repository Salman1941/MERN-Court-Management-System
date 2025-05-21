require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const http = require('http');
const { Server } = require('socket.io');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/court_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }
};
connectDB();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your_secure_secret_key_should_be_longer_and_complex';

// Auth Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('Authentication required');

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ userId: decoded.userId });
    if (!user) throw new Error('User not found');

    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// User Model
const userSchema = new mongoose.Schema({
  userId: { type: String, default: uuidv4, unique: true, index: true },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  role: { type: String, enum: ['judge', 'lawyer', 'staff'], required: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Case Model
const caseSchema = new mongoose.Schema({
  caseId: { type: String, default: uuidv4, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'dismissed'], 
    default: 'pending',
    required: true
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  parties: [{
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    contact: { type: String, trim: true }
  }],
  documents: [{
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Case = mongoose.model('Case', caseSchema);

// Hearing Model
const hearingSchema = new mongoose.Schema({
  hearingId: { type: String, default: uuidv4, unique: true, index: true },
  caseId: { type: String, required: true, index: true },
  caseTitle: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
  judgeId: { type: String, required: true, index: true },
  judgeName: { type: String, required: true, trim: true },
  lawyerIds: [{ type: String, index: true }],
  lawyerNames: [{ type: String, trim: true }],
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'postponed'], default: 'scheduled' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Hearing = mongoose.model('Hearing', hearingSchema);

// Notification Model
const notificationSchema = new mongoose.Schema({
  notificationId: { 
    type: String, 
    default: uuidv4, 
    unique: true, 
    index: true,
    required: true
  },
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  type: { type: String, enum: ['hearing', 'case', 'general'] },
  relatedId: { type: String, index: true },
  createdAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  versionKey: false
});

notificationSchema.pre('save', function(next) {
  if (!this.notificationId) {
    this.notificationId = uuidv4();
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

// Availability Model
const availabilitySchema = new mongoose.Schema({
  availabilityId: { type: String, default: uuidv4, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  userRole: { type: String, required: true },
  date: { type: Date, required: true },
  timeSlots: [{
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    status: { type: String, enum: ['available', 'unavailable', 'booked'], default: 'available' }
  }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Availability = mongoose.model('Availability', availabilitySchema);

// Report Model
const reportSchema = new mongoose.Schema({
  reportId: { type: String, default: uuidv4, unique: true, index: true },
  type: { type: String, enum: ['case_progress', 'judge_performance', 'resource_utilization'], required: true },
  period: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'], required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  data: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Report = mongoose.model('Report', reportSchema);

// Public Routes (accessible without authentication)
app.get('/api/public/cases', async (req, res) => {
  try {
    const cases = await Case.find({})
      .select('caseId title status priority createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: cases });
  } catch (err) {
    console.error('Public cases fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch public cases' });
  }
});

app.get('/api/public/cases/:caseId', async (req, res) => {
  try {
    const caseData = await Case.findOne({ caseId: req.params.caseId });
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const hearings = await Hearing.find({ caseId: req.params.caseId })
      .sort({ date: 1 })
      .select('caseTitle date startTime endTime judgeName lawyerNames status');

    res.json({ 
      success: true, 
      data: {
        ...caseData.toObject(),
        hearings
      }
    });
  } catch (err) {
    console.error('Public case fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch public case details' });
  }
});

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role, name, email, phone } = req.body;

    if (!username || !password || !role || !name || !email) {
      return res.status(400).json({ success: false, message: 'All required fields are missing' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    if (await User.findOne({ $or: [{ username }, { email }] })) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      username,
      password: hashedPassword,
      role,
      name,
      email,
      phone
    });

    await user.save();

    const token = jwt.sign(
      { userId: user.userId, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        userId: user.userId,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.userId, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      user: {
        userId: user.userId,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// Protected Profile Route
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        createdAt: req.user.createdAt
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Cases Routes
app.get('/api/cases', authenticate, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'judge' || req.user.role === 'lawyer') {
      query = { status: { $ne: 'completed' } };
    }

    const cases = await Case.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: cases });
  } catch (err) {
    console.error('Cases fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch cases' });
  }
});

app.get('/api/cases/:caseId', authenticate, async (req, res) => {
  try {
    const caseData = await Case.findOne({ caseId: req.params.caseId });
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const hearings = await Hearing.find({ caseId: req.params.caseId }).sort({ date: 1 });
    
    res.json({ 
      success: true, 
      data: {
        ...caseData.toObject(),
        hearings
      }
    });
  } catch (err) {
    console.error('Case fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch case details' });
  }
});

app.post('/api/cases', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Only staff can create cases' });
    }

    const { title, description, parties, priority } = req.body;

    if (!title || !description || !parties || !priority) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!Array.isArray(parties)) {
      return res.status(400).json({ success: false, message: 'Parties must be an array' });
    }

    const newCase = new Case({
      title,
      description,
      parties,
      priority
    });

    await newCase.save();

    res.status(201).json({ success: true, data: newCase });
  } catch (err) {
    console.error('Case creation error:', err);
    res.status(500).json({ success: false, message: 'Failed to create case' });
  }
});

app.post('/api/cases/:caseId/documents', authenticate, async (req, res) => {
  try {
    const { name, url } = req.body;

    if (!name || !url) {
      return res.status(400).json({ success: false, message: 'Document name and URL are required' });
    }

    const updatedCase = await Case.findOneAndUpdate(
      { caseId: req.params.caseId },
      { $push: { documents: { name, url } } },
      { new: true }
    );

    if (!updatedCase) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    res.json({ success: true, data: updatedCase });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
});

// Update case status
// Update case status - make sure this matches exactly
app.put('/api/cases/:caseId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Only staff can update cases' });
    }

    const { status } = req.body;

    // Validate status value
    const validStatuses = ['pending', 'in_progress', 'completed', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const updatedCase = await Case.findOneAndUpdate(
      { caseId: req.params.caseId },
      { 
        status,
        updatedAt: new Date() // Ensure updatedAt is always refreshed
      },
      { new: true }
    );

    if (!updatedCase) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    res.json({ 
      success: true, 
      data: updatedCase,
      message: `Case status updated to ${status}`
    });
  } catch (err) {
    console.error('Case update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update case status' });
  }
});
// Get all lawyers
app.get('/api/lawyers', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'judge') {
      return res.status(403).json({ success: false, message: 'Only judges can access lawyers list' });
    }

    const lawyers = await User.find({ role: 'lawyer' }).select('userId name email phone');
    res.json({ 
      success: true, 
      data: lawyers 
    });
  } catch (err) {
    console.error('Lawyers fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch lawyers' });
  }
});

// Create new hearing with notifications
app.post('/api/hearings', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'judge') {
      return res.status(403).json({ success: false, message: 'Only judges can create hearings' });
    }

    const { caseId, date, startTime, endTime, lawyerIds } = req.body;

    if (!caseId || !date || !startTime || !endTime || !lawyerIds || !Array.isArray(lawyerIds)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ success: false, message: 'Invalid time format. Use HH:MM' });
    }

    const caseData = await Case.findOne({ caseId });
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const lawyers = await User.find({ userId: { $in: lawyerIds }, role: 'lawyer' });
    if (lawyers.length !== lawyerIds.length) {
      return res.status(400).json({ success: false, message: 'One or more lawyers not found' });
    }

    const hearing = new Hearing({
      caseId,
      caseTitle: caseData.title,
      date: new Date(date),
      startTime,
      endTime,
      judgeId: req.user.userId,
      judgeName: req.user.name,
      lawyerIds,
      lawyerNames: lawyers.map(l => l.name),
      status: 'scheduled'
    });

    await hearing.save();

    const notificationPromises = lawyerIds.map(lawyerId => 
      sendNotification(
        lawyerId,
        'New Hearing Assignment',
        `You've been assigned to hearing for case: ${caseData.title} on ${moment(date).format('MMM D, YYYY')} from ${startTime} to ${endTime}`,
        'hearing',
        hearing.hearingId
      )
    );

    await Promise.all(notificationPromises);

    res.status(201).json({ 
      success: true, 
      data: hearing 
    });

  } catch (err) {
    console.error('Hearing creation error:', err);
    res.status(500).json({ success: false, message: 'Failed to create hearing' });
  }
});

// Get hearings for current user
app.get('/api/hearings', authenticate, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'judge') {
      query = { judgeId: req.user.userId };
    } else if (req.user.role === 'lawyer') {
      query = { lawyerIds: req.user.userId };
    } else {
      query = {};
    }

    const hearings = await Hearing.find(query)
      .sort({ date: 1, startTime: 1 })
      .limit(50);

    res.json({ success: true, data: hearings });
  } catch (err) {
    console.error('Hearings fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch hearings' });
  }
});

// Get single hearing
app.get('/api/hearings/:hearingId', authenticate, async (req, res) => {
  try {
    const hearing = await Hearing.findOne({ hearingId: req.params.hearingId });
    if (!hearing) {
      return res.status(404).json({ success: false, message: 'Hearing not found' });
    }

    // Check if user is authorized to view this hearing
    if (req.user.role === 'lawyer' && !hearing.lawyerIds.includes(req.user.userId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this hearing' });
    }

    if (req.user.role === 'judge' && hearing.judgeId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this hearing' });
    }

    res.json({ success: true, data: hearing });
  } catch (err) {
    console.error('Hearing fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch hearing' });
  }
});

// Update hearing status
app.put('/api/hearings/:hearingId', authenticate, async (req, res) => {
  try {
    const { status, lawyerIds } = req.body;
    const { hearingId } = req.params;

    if (req.user.role !== 'judge') {
      return res.status(403).json({ success: false, message: 'Only judges can update hearings' });
    }

    const updateFields = {};
    
    if (status && ['scheduled', 'completed', 'cancelled', 'postponed'].includes(status)) {
      updateFields.status = status;
    }

    if (lawyerIds && Array.isArray(lawyerIds)) {
      const lawyers = await User.find({ userId: { $in: lawyerIds }, role: 'lawyer' });
      if (lawyers.length !== lawyerIds.length) {
        return res.status(400).json({ success: false, message: 'One or more lawyers not found' });
      }
      updateFields.lawyerIds = lawyerIds;
      updateFields.lawyerNames = lawyers.map(l => l.name);
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const hearing = await Hearing.findOneAndUpdate(
      { hearingId, judgeId: req.user.userId },
      updateFields,
      { new: true }
    );

    if (!hearing) {
      return res.status(404).json({ success: false, message: 'Hearing not found or unauthorized' });
    }

    const notificationMessage = `Hearing for case ${hearing.caseTitle} has been updated`;
    
    const notifyParticipants = [
      sendNotification(
        hearing.judgeId,
        'Hearing Updated',
        notificationMessage,
        'hearing',
        hearing.hearingId
      ),
      ...hearing.lawyerIds.map(lawyerId => 
        sendNotification(
          lawyerId,
          'Hearing Updated',
          notificationMessage,
          'hearing',
          hearing.hearingId
        )
      )
    ];

    await Promise.all(notifyParticipants);

    res.json({ success: true, data: hearing });
  } catch (err) {
    console.error('Hearing update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update hearing' });
  }
});

// Delete hearing - Fixed to properly check judge permissions
app.delete('/api/hearings/:hearingId', authenticate, async (req, res) => {
  try {
    const hearing = await Hearing.findOne({ hearingId: req.params.hearingId });
    
    if (!hearing) {
      return res.status(404).json({ success: false, message: 'Hearing not found' });
    }

    // Check permissions: Judge can only delete their own hearings, staff can delete any
    if (req.user.role !== 'staff' && hearing.judgeId !== req.user.userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Only the assigned judge or staff can delete hearings' 
      });
    }

    await Hearing.deleteOne({ hearingId: req.params.hearingId });

    // Notify participants
    const notificationMessage = `Hearing for case ${hearing.caseTitle} on ${moment(hearing.date).format('MMM D, YYYY')} was deleted`;
    await sendNotification(
      hearing.judgeId,
      'Hearing Deleted',
      notificationMessage,
      'hearing',
      hearing.hearingId
    );

    res.json({ success: true, message: 'Hearing deleted successfully' });
  } catch (err) {
    console.error('Delete hearing error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete hearing' });
  }
});// Notifications Routes
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ 
      success: true, 
      data: notifications
    });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notifications' 
    });
  }
});

app.put('/api/notifications/:notificationId/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        notificationId: req.params.notificationId,
        userId: req.user.userId 
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found' 
      });
    }

    res.json({ 
      success: true, 
      data: notification
    });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update notification' 
    });
  }
});

// Availability Routes
app.get('/api/availability', authenticate, async (req, res) => {
  try {
    const availabilities = await Availability.find({ userId: req.user.userId })
      .sort({ date: 1 })
      .limit(30);

    res.json({ success: true, data: availabilities });
  } catch (err) {
    console.error('Availability fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch availability' });
  }
});

app.post('/api/availability', authenticate, async (req, res) => {
  try {
    const { date, timeSlots } = req.body;

    if (!date || !timeSlots) {
      return res.status(400).json({ success: false, message: 'Date and time slots are required' });
    }

    if (!Array.isArray(timeSlots)) {
      return res.status(400).json({ success: false, message: 'Time slots must be an array' });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    for (const slot of timeSlots) {
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return res.status(400).json({ success: false, message: 'Invalid time format. Use HH:MM' });
      }
    }

    const existingAvailability = await Availability.findOne({ 
      userId: req.user.userId,
      date: new Date(date)
    });

    let availability;
    if (existingAvailability) {
      availability = await Availability.findOneAndUpdate(
        { availabilityId: existingAvailability.availabilityId },
        { timeSlots },
        { new: true }
      );
    } else {
      availability = new Availability({
        userId: req.user.userId,
        userRole: req.user.role,
        date,
        timeSlots
      });
      await availability.save();
    }

    res.json({ success: true, data: availability });
  } catch (err) {
    console.error('Availability update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
});

// Reports Routes
app.get('/api/reports', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Only staff can access reports' });
    }

    const reports = await Report.find().sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error('Reports fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
});

app.post('/api/reports', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Only staff can generate reports' });
    }

    const { type, period, startDate, endDate } = req.body;

    if (!type || !period) {
      return res.status(400).json({ success: false, message: 'Type and period are required' });
    }

    let reportData;
    switch (type) {
      case 'case_progress':
        reportData = await generateCaseProgressReport(period, startDate, endDate);
        break;
      case 'judge_performance':
        reportData = await generateJudgePerformanceReport(period, startDate, endDate);
        break;
      case 'resource_utilization':
        reportData = await generateResourceUtilizationReport(period, startDate, endDate);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    const report = new Report({
      type,
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      data: reportData
    });

    await report.save();

    res.json({ success: true, data: report });
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// Helper functions for report generation
async function generateCaseProgressReport(period, startDate, endDate) {
  const dateFilter = getDateFilter(period, startDate, endDate);
  
  const cases = await Case.aggregate([
    { $match: dateFilter },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  const result = {};
  cases.forEach(item => {
    result[item._id] = item.count;
  });

  return result;
}

async function generateJudgePerformanceReport(period, startDate, endDate) {
  const dateFilter = getDateFilter(period, startDate, endDate);
  
  return await Hearing.aggregate([
    { 
      $match: { 
        ...dateFilter,
        status: 'completed' 
      } 
    },
    { 
      $group: { 
        _id: "$judgeId", 
        judgeName: { $first: "$judgeName" },
        count: { $sum: 1 } 
      } 
    },
    { $sort: { count: -1 } }
  ]);
}

async function generateResourceUtilizationReport(period, startDate, endDate) {
  const dateFilter = getDateFilter(period, startDate, endDate);
  
  const hearings = await Hearing.aggregate([
    { $match: dateFilter },
    { 
      $group: { 
        _id: { 
          $dateToString: { 
            format: "%H:%M", 
            date: { 
              $dateFromString: { 
                dateString: { 
                  $concat: [
                    { $substr: ["$date", 0, 10] },
                    "T",
                    "$startTime",
                    ":00Z"
                  ]
                } 
              } 
            } 
          } 
        }, 
        count: { $sum: 1 } 
      } 
    }
  ]);

  const result = {};
  hearings.forEach(item => {
    result[item._id] = item.count;
  });

  return result;
}

function getDateFilter(period, startDate, endDate) {
  const now = new Date();
  let filter = {};

  if (period === 'custom' && startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    switch (period) {
      case 'daily':
        filter.createdAt = {
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999))
        };
        break;
      case 'weekly':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        filter.createdAt = {
          $gte: weekStart,
          $lte: weekEnd
        };
        break;
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        filter.createdAt = {
          $gte: monthStart,
          $lte: monthEnd
        };
        break;
      case 'yearly':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        filter.createdAt = {
          $gte: yearStart,
          $lte: yearEnd
        };
        break;
    }
  }

  return filter;
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Create HTTP server for WebSockets
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket'] // Force WebSocket transport
});

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join', (userId) => {
    if (!userId) {
      console.error('No userId provided for join');
      return;
    }
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined notifications`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

// Notification Helper Function
const sendNotification = async (userId, title, message, type, relatedId) => {
  try {
    if (!userId || !title || !message) {
      throw new Error('Missing required notification fields');
    }

    const notification = new Notification({
      notificationId: uuidv4(),
      userId,
      title,
      message,
      type,
      relatedId,
      isRead: false
    });
    
    await notification.save();
    
    // Emit to specific user room
    io.to(`user:${userId}`).emit('notification', notification);
    return notification;
  } catch (err) {
    console.error('Notification error:', err);
    throw err;
  }
};

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});