import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import axios from 'axios';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { 
  CssBaseline, AppBar, Toolbar, Typography, Button, Box, Drawer, List, ListItem, 
  ListItemIcon, ListItemText, Divider, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, TextField, MenuItem, Select, FormControl, 
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  IconButton, Badge, Avatar, Card, CardContent, CardActions, Grid, Switch, FormControlLabel,
  Checkbox, Chip
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, CalendarToday, Gavel, People, 
  Notifications, Report, ExitToApp, Menu, Add, Edit, Delete, 
  Visibility, Check, Close, AccessTime, Schedule, Upload,
  AddCircle, PersonAdd, ScheduleSend
} from '@mui/icons-material';
import { io } from 'socket.io-client';

// Configure moment for calendar
moment.locale('en');
const localizer = momentLocalizer(moment);

// Create theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

// High contrast theme
const highContrastTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#000000',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ffffff',
      contrastText: '#000000',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#000000',
    },
    contrastThreshold: 4.5,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          border: '2px solid',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '2px solid #000000',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderBottom: '2px solid #000000',
        },
      },
    },
  },
});

// Auth context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (token) {
        try {
          const response = await axios.get('http://localhost:5000/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          setUser(response.data.user);
        } catch (err) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    validateToken();
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', userData);
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  return useContext(AuthContext);
};

// Protected route component
const ProtectedRoute = ({ children, roles }) => {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.loading) {
    return <div>Loading...</div>;
  }

  if (!auth.user) {
    return <Navigate to="/login" />;
  }

  if (roles && !roles.includes(auth.user.role)) {
    return <Navigate to="/" />;
  }

  return children;
};

// Guest Layout
const GuestLayout = ({ children }) => {
  const [highContrast, setHighContrast] = useState(false);
  const currentTheme = highContrast ? highContrastTheme : theme;

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Court Management System - Public Portal
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  color="secondary"
                />
              }
              label="High Contrast"
              sx={{ color: 'white', mr: 2 }}
            />
            <Button 
              color="inherit" 
              component={Link} 
              to="/login"
              startIcon={<ExitToApp />}
            >
              Login
            </Button>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

// Guest Cases Page
const GuestCasesPage = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/public/cases');
        setCases(response.data.data);
      } catch (err) {
        console.error('Failed to fetch cases', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const filteredCases = cases.filter(caseItem =>
    caseItem.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseItem.caseId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <Typography>Loading cases...</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          Public Case Records
        </Typography>
        <TextField
          label="Search cases"
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 3 }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Case ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCases.map((caseItem) => (
              <TableRow key={caseItem.caseId}>
                <TableCell>{caseItem.caseId.substring(0, 8)}...</TableCell>
                <TableCell>{caseItem.title}</TableCell>
                <TableCell>
                  <Chip 
                    label={caseItem.status.replace('_', ' ')} 
                    color={
                      caseItem.status === 'pending' ? 'warning' :
                      caseItem.status === 'in_progress' ? 'info' :
                      caseItem.status === 'completed' ? 'success' : 'error'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>{caseItem.priority}</TableCell>
                <TableCell>{moment(caseItem.createdAt).format('MMM D, YYYY')}</TableCell>
                <TableCell>
                  <Button 
                    component={Link} 
                    to={`/public/cases/${caseItem.caseId}`}
                    startIcon={<Visibility />}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// Guest Case Detail Page
const GuestCaseDetailPage = () => {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCaseData = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/public/cases/${caseId}`);
        setCaseData(response.data.data);
      } catch (err) {
        console.error('Failed to fetch case data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseData();
  }, [caseId]);

  if (loading) {
    return <Typography>Loading case details...</Typography>;
  }

  if (!caseData) {
    return <Typography>Case not found</Typography>;
  }

   // Add this simple status update function
   const updateStatus = async (newStatus) => {
    try {
      await axios.put(`/api/cases/${caseId}`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      setCaseData(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };
  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          {caseData.title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip 
            label={caseData.status.replace('_', ' ').toUpperCase()} 
            color={
              caseData.status === 'pending' ? 'warning' :
              caseData.status === 'in_progress' ? 'info' :
              caseData.status === 'completed' ? 'success' : 'error'
            }
          />
          <Chip 
            label={caseData.priority.toUpperCase()} 
            variant="outlined"
          />
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>Case Description</Typography>
        <Typography paragraph>{caseData.description}</Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>Parties Involved</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Contact</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {caseData.parties.map((party, index) => (
                <TableRow key={index}>
                  <TableCell>{party.name}</TableCell>
                  <TableCell>{party.role}</TableCell>
                  <TableCell>{party.contact}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>Scheduled Hearings</Typography>
        {caseData.hearings.length === 0 ? (
          <Typography>No hearings scheduled</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Judge</TableCell>
                  <TableCell>Lawyers</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {caseData.hearings.map((hearing) => (
                  <TableRow key={hearing._id}>
                    <TableCell>{moment(hearing.date).format('MMMM D, YYYY')}</TableCell>
                    <TableCell>{hearing.startTime} - {hearing.endTime}</TableCell>
                    <TableCell>{hearing.judgeName}</TableCell>
                    <TableCell>{hearing.lawyerNames?.join(', ') || 'None'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={hearing.status.toUpperCase()} 
                        color={
                          hearing.status === 'scheduled' ? 'primary' :
                          hearing.status === 'completed' ? 'success' :
                          hearing.status === 'cancelled' ? 'error' : 'warning'
                        }
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>Case Documents</Typography>
        {caseData.documents?.length === 0 ? (
          <Typography>No documents available</Typography>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Uploaded</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {caseData.documents?.map((doc, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Button 
                        href={doc.url} 
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {doc.name}
                      </Button>
                    </TableCell>
                    <TableCell>{moment(doc.uploadedAt).format('MMM D, YYYY')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

// Login page
const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const auth = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await auth.login(username, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          width: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <Gavel />
        </Avatar>
        <Typography component="h1" variant="h5">
          Court Management System
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/register')}
          >
            Don't have an account? Sign Up
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={() => navigate('/')}
            sx={{ mt: 2 }}
          >
            View Public Case Records
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

// Register page
const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role: 'lawyer'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await auth.register(formData);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } else {
      setError(result.message);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            width: 400,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6" color="primary">
            Registration successful! Redirecting...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          width: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <Gavel />
        </Avatar>
        <Typography component="h1" variant="h5">
          Register
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            fullWidth
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={handleChange}
              label="Role"
            >
              <MenuItem value="judge">Judge</MenuItem>
              <MenuItem value="lawyer">Lawyer</MenuItem>
              <MenuItem value="staff">Court Staff</MenuItem>
            </Select>
          </FormControl>
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Register
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/login')}
          >
            Already have an account? Sign In
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={() => navigate('/')}
            sx={{ mt: 2 }}
          >
            View Public Case Records
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

// Main layout with sidebar
const MainLayout = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [highContrast, setHighContrast] = useState(false);
  const auth = useAuth();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/notifications', {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        setNotifications(response.data.data);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
        setSnackbar({
          open: true,
          message: 'Failed to load notifications',
          severity: 'error'
        });
      }
    };

    // Initialize WebSocket connection
    const newSocket = io('http://localhost:5000', {
      transports: ['websocket'],
      withCredentials: true
    });
    setSocket(newSocket);
    
    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setSnackbar({
        open: true,
        message: 'New notification received',
        severity: 'info'
      });
    });
    
    newSocket.on('connect', () => {
      console.log('Socket connected');
    });
    
    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
    if (auth.user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => {
        clearInterval(interval);
        newSocket.close();
      };
    }
  }, [auth.user, auth.token]);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleNotificationsToggle = () => {
    setNotificationsOpen(!notificationsOpen);
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await axios.put(`http://localhost:5000/api/notifications/${notificationId}/read`, {}, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      setNotifications(notifications.map(n => 
        n.notificationId === notificationId ? { ...n, isRead: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
      setSnackbar({
        open: true,
        message: 'Failed to mark notification as read',
        severity: 'error'
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Calendar', icon: <CalendarToday />, path: '/calendar' },
    ...(auth.user?.role === 'staff' ? [
      { text: 'Cases', icon: <Gavel />, path: '/cases' },
      { text: 'Reports', icon: <Report />, path: '/reports' }
    ] : []),
    ...(auth.user?.role === 'judge' || auth.user?.role === 'lawyer' ? [
      { text: 'My Cases', icon: <Gavel />, path: '/cases' },
      { text: 'Availability', icon: <AccessTime />, path: '/availability' }
    ] : []),
    { text: 'Notifications', icon: <Notifications />, onClick: handleNotificationsToggle }
  ];

  const currentTheme = highContrast ? highContrastTheme : theme;

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <Menu />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Court Management System
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  color="secondary"
                />
              }
              label="High Contrast"
              sx={{ color: 'white', mr: 2 }}
            />
            <IconButton color="inherit" onClick={handleNotificationsToggle}>
              <Badge badgeContent={unreadCount} color="secondary">
                <Notifications />
              </Badge>
            </IconButton>
            <Button color="inherit" onClick={auth.logout}>
              <ExitToApp sx={{ mr: 1 }} /> Logout
            </Button>
          </Toolbar>
        </AppBar>
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto' }}>
            <List>
              {menuItems.map((item) => (
                <ListItem 
                  button 
                  key={item.text} 
                  component={Link} 
                  to={item.path} 
                  onClick={item.onClick || handleDrawerToggle}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItem>
              ))}
            </List>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {auth.user?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {auth.user?.role.toUpperCase()}
              </Typography>
            </Box>
          </Box>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Toolbar />
          {children}
        </Box>
        <Drawer
          anchor="right"
          open={notificationsOpen}
          onClose={handleNotificationsToggle}
        >
          <Box sx={{ width: 350, p: 2 }}>
            <Typography variant="h6" sx={{ p: 2 }}>
              Notifications
            </Typography>
            <Divider />
            <List>
              {notifications.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No notifications" />
                </ListItem>
              ) : (
                notifications.map((notification) => (
                  <ListItem 
                    key={notification.notificationId} 
                    button
                    sx={{ bgcolor: notification.isRead ? 'background.paper' : 'action.selected' }}
                    onClick={() => markNotificationAsRead(notification.notificationId)}
                  >
                    <ListItemText
                      primary={notification.title}
                      secondary={notification.message}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Box>
        </Drawer>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

// Dashboard page
const DashboardPage = () => {
  const auth = useAuth();
  const [upcomingHearings, setUpcomingHearings] = useState([]);
  const [caseStats, setCaseStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

 
  const handleDeleteHearing = async (hearingId) => {
  try {
    const response = await axios.delete(
      `http://localhost:5000/api/hearings/${hearingId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );

    if (response.data.success) {
      setUpcomingHearings(prev => prev.filter(h => h.hearingId !== hearingId));
      setSnackbar({
        open: true,
        message: 'Hearing deleted successfully',
        severity: 'success'
      });
    }
  } catch (err) {
    console.error('Delete error details:', {
      status: err.response?.status,
      data: err.response?.data,
      headers: err.response?.headers
    });
    
    setSnackbar({
      open: true,
      message: err.response?.data?.message || 'Failed to delete hearing',
      severity: 'error'
    });
  }
};
  useEffect(() => {
    const fetchData = async () => {
      try {
        const hearingsResponse = await axios.get('http://localhost:5000/api/hearings', {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        setUpcomingHearings(hearingsResponse.data.data.slice(0, 5));

        if (auth.user.role === 'staff') {
          const casesResponse = await axios.get('http://localhost:5000/api/cases', {
            headers: {
              Authorization: `Bearer ${auth.token}`
            }
          });
          const stats = {
            total: casesResponse.data.data.length,
            pending: casesResponse.data.data.filter(c => c.status === 'pending').length,
            inProgress: casesResponse.data.data.filter(c => c.status === 'in_progress').length,
            completed: casesResponse.data.data.filter(c => c.status === 'completed').length
          };
          setCaseStats(stats);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
        setSnackbar({
          open: true,
          message: 'Failed to load dashboard data',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [auth.token, auth.user]);

  if (loading) {
    return <Typography>Loading dashboard...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome, {auth.user.name}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        {auth.user.role === 'judge' ? 'Judge Dashboard' : 
         auth.user.role === 'lawyer' ? 'Lawyer Dashboard' : 'Court Staff Dashboard'}
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {auth.user.role === 'staff' && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Case Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h4">{caseStats.total}</Typography>
                      <Typography variant="body2">Total Cases</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        <Grid item xs={12} md={auth.user.role === 'staff' ? 6 : 12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upcoming Hearings
              </Typography>
              {upcomingHearings.length === 0 ? (
                <Typography>No upcoming hearings</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Case</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Judge</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {upcomingHearings.map((hearing) => (
                        <TableRow key={hearing.hearingId}>
                          <TableCell>{hearing.caseTitle}</TableCell>
                          <TableCell>{moment(hearing.date).format('MMM D, YYYY')}</TableCell>
                          <TableCell>{hearing.startTime} - {hearing.endTime}</TableCell>
                          <TableCell>{hearing.judgeName}</TableCell>
                          <TableCell>
                            <Button 
                              size="small" 
                              component={Link} 
                              to={`/hearings/${hearing.hearingId}`}
                              startIcon={<Visibility />}
                              sx={{ mr: 1 }}
                            >
                              View
                            </Button>
                            {(auth.user?.role === 'judge' || auth.user?.role === 'staff') && (
                              <Button 
                                size="small" 
                                color="error"
                                startIcon={<Delete />}
                                onClick={() => handleDeleteHearing(hearing.hearingId)}
                              >
                                Delete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
            <CardActions>
              <Button size="small" component={Link} to="/calendar">View Full Calendar</Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({...snackbar, open: false})}
      >
        <Alert 
          onClose={() => setSnackbar({...snackbar, open: false})} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Calendar page
const CalendarPage = () => {
  const auth = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newHearing, setNewHearing] = useState({
    caseId: '',
    date: new Date(),
    startTime: '09:00',
    endTime: '10:00',
    lawyerIds: []
  });
  const [cases, setCases] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const caseId = queryParams.get('caseId');
    
    if (caseId) {
      setNewHearing(prev => ({ ...prev, caseId }));
    }

    const fetchData = async () => {
      try {
        const hearingsResponse = await axios.get('http://localhost:5000/api/hearings', {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        
        const formattedEvents = hearingsResponse.data.data.map(hearing => ({
          id: hearing.hearingId,
          title: `${hearing.caseTitle} (${hearing.judgeName})`,
          start: new Date(`${hearing.date}T${hearing.startTime}`),
          end: new Date(`${hearing.date}T${hearing.endTime}`),
          allDay: false,
          hearing
        }));
        
        setEvents(formattedEvents);

        if (auth.user.role === 'judge') {
          const casesResponse = await axios.get('http://localhost:5000/api/cases', {
            headers: {
              Authorization: `Bearer ${auth.token}`
            }
          });
          setCases(casesResponse.data.data);

          const lawyersResponse = await axios.get('http://localhost:5000/api/lawyers', {
            headers: {
              Authorization: `Bearer ${auth.token}`
            }
          });
          setLawyers(lawyersResponse.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [auth.token, auth.user, location.search]);

  const handleSelectSlot = (slotInfo) => {
    if (auth.user.role !== 'judge') return;
    
    setNewHearing({
      ...newHearing,
      date: slotInfo.start,
      startTime: moment(slotInfo.start).format('HH:mm'),
      endTime: moment(slotInfo.end).format('HH:mm')
    });
    setOpenDialog(true);
  };

  const handleSelectEvent = (event) => {
    window.location.href = `/hearings/${event.id}`;
  };

  const handleCreateHearing = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/hearings', {
        caseId: newHearing.caseId,
        date: newHearing.date.toISOString().split('T')[0],
        startTime: newHearing.startTime,
        endTime: newHearing.endTime,
        lawyerIds: newHearing.lawyerIds
      }, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });

      const newEvent = {
        id: response.data.data.hearingId,
        title: `${response.data.data.caseTitle} (${auth.user.name})`,
        start: new Date(`${response.data.data.date}T${response.data.data.startTime}`),
        end: new Date(`${response.data.data.date}T${response.data.data.endTime}`),
        allDay: false,
        hearing: response.data.data
      };

      setEvents([...events, newEvent]);
      setOpenDialog(false);
    } catch (err) {
      console.error('Failed to create hearing', err);
    }
  };

  const handleDeleteHearing = async (hearingId) => {
    try {
      await axios.delete(`http://localhost:5000/api/hearings/${hearingId}`, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      setEvents(events.filter(event => event.id !== hearingId));
    } catch (err) {
      console.error('Failed to delete hearing', err);
    }
  };

  if (loading) {
    return <Typography>Loading calendar...</Typography>;
  }

  return (
    <Box sx={{ height: 'calc(100vh - 64px - 32px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Court Calendar</Typography>
        {auth.user.role === 'judge' && (
          <Button 
            variant="contained" 
            startIcon={<AddCircle />}
            onClick={() => setOpenDialog(true)}
          >
            Schedule Hearing
          </Button>
        )}
      </Box>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '80%' }}
        selectable={auth.user.role === 'judge'}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        defaultView="week"
        views={['month', 'week', 'day', 'agenda']}
        min={new Date(0, 0, 0, 9, 0, 0)}
        max={new Date(0, 0, 0, 17, 0, 0)}
        eventPropGetter={(event) => ({
          style: {
            backgroundColor: event.hearing.status === 'completed' ? '#4caf50' :
                           event.hearing.status === 'cancelled' ? '#f44336' :
                           event.hearing.status === 'postponed' ? '#ff9800' : '#2196f3',
            borderRadius: '4px',
            opacity: 0.8,
            color: 'white',
            border: '0px',
            display: 'block'
          }
        })}
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Schedule New Hearing</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Case</InputLabel>
              <Select
                value={newHearing.caseId}
                onChange={(e) => setNewHearing({ ...newHearing, caseId: e.target.value })}
                label="Case"
              >
                {cases.map((caseItem) => (
                  <MenuItem key={caseItem.caseId} value={caseItem.caseId}>
                    {caseItem.title} ({caseItem.caseId.substring(0, 8)}...)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={moment(newHearing.date).format('YYYY-MM-DD')}
                onChange={(e) => setNewHearing({ 
                  ...newHearing, 
                  date: new Date(e.target.value) 
                })}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                label="Start Time"
                type="time"
                fullWidth
                value={newHearing.startTime}
                onChange={(e) => setNewHearing({ ...newHearing, startTime: e.target.value })}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                label="End Time"
                type="time"
                fullWidth
                value={newHearing.endTime}
                onChange={(e) => setNewHearing({ ...newHearing, endTime: e.target.value })}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Assign Lawyers</InputLabel>
              <Select
                multiple
                value={newHearing.lawyerIds}
                onChange={(e) => setNewHearing({ ...newHearing, lawyerIds: e.target.value })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((lawyerId) => {
                      const lawyer = lawyers.find(l => l.userId === lawyerId);
                      return lawyer ? (
                        <Chip key={lawyerId} label={lawyer.name} />
                      ) : null;
                    })}
                  </Box>
                )}
              >
                {lawyers.map((lawyer) => (
                  <MenuItem key={lawyer.userId} value={lawyer.userId}>
                    <Checkbox checked={newHearing.lawyerIds.indexOf(lawyer.userId) > -1} />
                    <ListItemText primary={lawyer.name} secondary={lawyer.email} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateHearing} 
            variant="contained"
            disabled={!newHearing.caseId}
          >
            Schedule Hearing
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Cases page
const CasesPage = () => {
  const auth = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newCase, setNewCase] = useState({
    title: '',
    description: '',
    parties: [{ name: '', role: '', contact: '' }],
    priority: 'medium'
  });

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/cases', {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        setCases(response.data.data);
      } catch (err) {
        console.error('Failed to fetch cases', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [auth.token]);

  const handleAddParty = () => {
    setNewCase({
      ...newCase,
      parties: [...newCase.parties, { name: '', role: '', contact: '' }]
    });
  };

  const handlePartyChange = (index, field, value) => {
    const updatedParties = [...newCase.parties];
    updatedParties[index][field] = value;
    setNewCase({ ...newCase, parties: updatedParties });
  };

  const handleRemoveParty = (index) => {
    const updatedParties = [...newCase.parties];
    updatedParties.splice(index, 1);
    setNewCase({ ...newCase, parties: updatedParties });
  };

  const handleSubmit = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/cases', newCase, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      setCases([...cases, response.data.data]);
      setOpenDialog(false);
      setNewCase({
        title: '',
        description: '',
        parties: [{ name: '', role: '', contact: '' }],
        priority: 'medium'
      });
    } catch (err) {
      console.error('Failed to create case', err);
    }
  };

  if (loading) {
    return <Typography>Loading cases...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Cases</Typography>
        {auth.user.role === 'staff' && (
          <Button 
            variant="contained" 
            startIcon={<Add />}
            onClick={() => setOpenDialog(true)}
          >
            Add Case
          </Button>
        )}
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Case ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((caseItem) => (
              <TableRow key={caseItem.caseId}>
                <TableCell>{caseItem.caseId.substring(0, 8)}...</TableCell>
                <TableCell>{caseItem.title}</TableCell>
                <TableCell>
                  <Box 
                    sx={{
                      display: 'inline-block',
                      p: 0.5,
                      borderRadius: 1,
                      bgcolor: 
                        caseItem.status === 'pending' ? 'warning.light' :
                        caseItem.status === 'in_progress' ? 'info.light' :
                        caseItem.status === 'completed' ? 'success.light' : 'error.light',
                      color: 'common.white'
                    }}
                  >
                    {caseItem.status.replace('_', ' ')}
                  </Box>
                </TableCell>
                <TableCell>{caseItem.priority}</TableCell>
                <TableCell>{moment(caseItem.createdAt).format('MMM D, YYYY')}</TableCell>
                <TableCell>
                  <Button 
                    size="small" 
                    component={Link} 
                    to={`/cases/${caseItem.caseId}`}
                    startIcon={<Visibility />}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Case</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Case Title"
              fullWidth
              value={newCase.title}
              onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={newCase.description}
              onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newCase.priority}
                onChange={(e) => setNewCase({ ...newCase, priority: e.target.value })}
                label="Priority"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="h6" gutterBottom>Parties Involved</Typography>
            {newCase.parties.map((party, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Name"
                  fullWidth
                  value={party.name}
                  onChange={(e) => handlePartyChange(index, 'name', e.target.value)}
                />
                <TextField
                  label="Role"
                  fullWidth
                  value={party.role}
                  onChange={(e) => handlePartyChange(index, 'role', e.target.value)}
                />
                <TextField
                  label="Contact"
                  fullWidth
                  value={party.contact}
                  onChange={(e) => handlePartyChange(index, 'contact', e.target.value)}
                />
                <IconButton onClick={() => handleRemoveParty(index)}>
                  <Close />
                </IconButton>
              </Box>
            ))}
            <Button onClick={handleAddParty} startIcon={<Add />}>
              Add Party
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">Create Case</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Case Detail page
const CaseDetailPage = () => {
  const { caseId } = useParams();
  const auth = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentName, setDocumentName] = useState('');

  useEffect(() => {
    const fetchCaseData = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/cases/${caseId}`, {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        setCaseData(response.data.data);
        setHearings(response.data.data.hearings || []);
      } catch (err) {
        console.error('Failed to fetch case data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseData();
  }, [caseId, auth.token]);

  const handleDocumentSubmit = async (e) => {
    e.preventDefault();
    try {
      const documentUrl = `https://example.com/documents/${documentFile.name}`;
      
      await axios.post(`http://localhost:5000/api/cases/${caseId}/documents`, {
        name: documentName,
        url: documentUrl
      }, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      
      const response = await axios.get(`http://localhost:5000/api/cases/${caseId}`, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      setCaseData(response.data.data);
      
      setDocumentFile(null);
      setDocumentName('');
    } catch (err) {
      console.error('Failed to upload document', err);
    }
  };

  if (loading) {
    return <Typography>Loading case details...</Typography>;
  }

  if (!caseData) {
    return <Typography>Case not found</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{caseData.title}</Typography>
        <Box>
          <Box 
            sx={{
              display: 'inline-block',
              p: 1,
              borderRadius: 1,
              bgcolor: 
                caseData.status === 'pending' ? 'warning.light' :
                caseData.status === 'in_progress' ? 'info.light' :
                caseData.status === 'completed' ? 'success.light' : 'error.light',
              color: 'common.white'
            }}
          >
            {caseData.status.replace('_', ' ').toUpperCase()}
          </Box>
          <Box 
            sx={{
              display: 'inline-block',
              p: 1,
              borderRadius: 1,
              bgcolor: 'grey.300',
              ml: 1
            }}
          >
            {caseData.priority.toUpperCase()}
          </Box>
        </Box>
      </Box>
      
      <Typography variant="body1" paragraph>{caseData.description}</Typography>
      
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Parties Involved</Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Contact</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {caseData.parties.map((party, index) => (
              <TableRow key={index}>
                <TableCell>{party.name}</TableCell>
                <TableCell>{party.role}</TableCell>
                <TableCell>{party.contact}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Typography variant="h6" gutterBottom>Hearings</Typography>
      {hearings.length === 0 ? (
        <Typography>No hearings scheduled</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Judge</TableCell>
                <TableCell>Lawyers</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {hearings.map((hearing) => (
                <TableRow key={hearing.hearingId}>
                  <TableCell>{moment(hearing.date).format('MMM D, YYYY')}</TableCell>
                  <TableCell>{hearing.startTime} - {hearing.endTime}</TableCell>
                  <TableCell>{hearing.judgeName}</TableCell>
                  <TableCell>{hearing.lawyerNames?.join(', ') || 'None'}</TableCell>
                  <TableCell>
                    <Box 
                      sx={{
                        display: 'inline-block',
                        p: 0.5,
                        borderRadius: 1,
                        bgcolor: 
                          hearing.status === 'scheduled' ? 'info.light' :
                          hearing.status === 'completed' ? 'success.light' :
                          hearing.status === 'cancelled' ? 'error.light' : 'warning.light',
                        color: 'common.white'
                      }}
                    >
                      {hearing.status}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="small" 
                      component={Link} 
                      to={`/hearings/${hearing.hearingId}`}
                      startIcon={<Visibility />}
                      sx={{ mr: 1 }}
                    >
                      View
                    </Button>
                    {(auth.user.role === 'judge' || auth.user.role === 'staff') && (
                      <Button 
                        size="small" 
                        color="error"
                        startIcon={<Delete />}
                        onClick={async () => {
                          try {
                            await axios.delete(`http://localhost:5000/api/hearings/${hearing.hearingId}`, {
                              headers: {
                                Authorization: `Bearer ${auth.token}`
                              }
                            });
                            setHearings(hearings.filter(h => h.hearingId !== hearing.hearingId));
                          } catch (err) {
                            console.error('Failed to delete hearing', err);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {auth.user.role === 'judge' && (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<ScheduleSend />}
            component={Link}
            to={`/hearing/new?caseId=${caseData.caseId}`}
          >
            Schedule Hearing for This Case
          </Button>
        </Box>
      )}
      
      <Typography variant="h6" gutterBottom>Documents</Typography>
      {caseData.documents?.length === 0 ? (
        <Typography>No documents uploaded</Typography>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {caseData.documents?.map((doc, index) => (
                <TableRow key={index}>
                  <TableCell>{doc.name}</TableCell>
                  <TableCell>{moment(doc.uploadedAt).format('MMM D, YYYY')}</TableCell>
                  <TableCell>
                    <Button 
                      size="small" 
                      href={doc.url} 
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Upload Document</Typography>
        <form onSubmit={handleDocumentSubmit}>
          <TextField
            label="Document Name"
            fullWidth
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <input
            type="file"
            onChange={(e) => setDocumentFile(e.target.files[0])}
            style={{ display: 'none' }}
            id="document-upload"
          />
          <label htmlFor="document-upload">
            <Button 
              variant="outlined" 
              component="span"
              startIcon={<Upload />}
              sx={{ mr: 2 }}
            >
              Choose File
            </Button>
          </label>
          {documentFile && (
            <Typography variant="body2" display="inline" sx={{ mr: 2 }}>
              {documentFile.name}
            </Typography>
          )}
          <Button 
            type="submit" 
            variant="contained" 
            disabled={!documentFile || !documentName}
          >
            Upload
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

// Hearing Detail page
const HearingDetailPage = () => {
  const { hearingId } = useParams();
  const auth = useAuth();
  const [hearing, setHearing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [lawyers, setLawyers] = useState([]);
  const [selectedLawyers, setSelectedLawyers] = useState([]);

  useEffect(() => {
    const fetchHearingData = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/hearings/${hearingId}`, {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        setHearing(response.data.data);
        
        if (auth.user.role === 'judge') {
          const lawyersResponse = await axios.get('http://localhost:5000/api/lawyers', {
            headers: {
              Authorization: `Bearer ${auth.token}`
            }
          });
          setLawyers(lawyersResponse.data.data);
          setSelectedLawyers(response.data.data.lawyerIds || []);
        }
      } catch (err) {
        console.error('Failed to fetch hearing data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHearingData();
  }, [hearingId, auth.token, auth.user]);

  const handleStatusChange = async () => {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/hearings/${hearingId}`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        }
      );
      setHearing(response.data.data);
      setOpenStatusDialog(false);
    } catch (err) {
      console.error('Failed to update hearing status', err);
    }
  };

  const handleAssignLawyers = async () => {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/hearings/${hearingId}`,
        { lawyerIds: selectedLawyers },
        {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        }
      );
      setHearing(response.data.data);
    } catch (err) {
      console.error('Failed to assign lawyers', err);
    }
  };

  const handleDeleteHearing = async () => {
    try {
      await axios.delete(`http://localhost:5000/api/hearings/${hearingId}`, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      window.location.href = '/calendar';
    } catch (err) {
      console.error('Failed to delete hearing', err);
    }
  };

  if (loading) {
    return <Typography>Loading hearing details...</Typography>;
  }

  if (!hearing) {
    return <Typography>Hearing not found</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Hearing Details</Typography>
        <Box>
          <Box 
            sx={{
              display: 'inline-block',
              p: 1,
              borderRadius: 1,
              bgcolor: 
                hearing.status === 'scheduled' ? 'info.light' :
                hearing.status === 'completed' ? 'success.light' :
                hearing.status === 'cancelled' ? 'error.light' : 'warning.light',
              color: 'common.white'
            }}
          >
            {hearing.status.toUpperCase()}
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Case Information</Typography>
              <Typography><strong>Case Title:</strong> {hearing.caseTitle}</Typography>
              <Typography><strong>Case ID:</strong> {hearing.caseId}</Typography>
              <Button 
                size="small" 
                component={Link} 
                to={`/cases/${hearing.caseId}`}
                sx={{ mt: 1 }}
              >
                View Case Details
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Hearing Details</Typography>
              <Typography><strong>Date:</strong> {moment(hearing.date).format('MMMM D, YYYY')}</Typography>
              <Typography><strong>Time:</strong> {hearing.startTime} - {hearing.endTime}</Typography>
              <Typography><strong>Judge:</strong> {hearing.judgeName}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Assigned Lawyers</Typography>
              {auth.user.role === 'judge' && (
                <Button 
                  variant="outlined" 
                  startIcon={<PersonAdd />}
                  onClick={handleAssignLawyers}
                >
                  Update Assignment
                </Button>
              )}
            </Box>
            
            {hearing.lawyerNames?.length > 0 ? (
              <List>
                {hearing.lawyerNames.map((name, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={name} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography>No lawyers assigned</Typography>
            )}

            {auth.user.role === 'judge' && (
              <Box sx={{ mt: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Assign Lawyers</InputLabel>
                  <Select
                    multiple
                    value={selectedLawyers}
                    onChange={(e) => setSelectedLawyers(e.target.value)}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((lawyerId) => {
                          const lawyer = lawyers.find(l => l.userId === lawyerId);
                          return lawyer ? (
                            <Chip key={lawyerId} label={lawyer.name} />
                          ) : null;
                        })}
                      </Box>
                    )}
                  >
                    {lawyers.map((lawyer) => (
                      <MenuItem key={lawyer.userId} value={lawyer.userId}>
                        <Checkbox checked={selectedLawyers.indexOf(lawyer.userId) > -1} />
                        <ListItemText primary={lawyer.name} secondary={lawyer.email} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => {
            setNewStatus(hearing.status);
            setOpenStatusDialog(true);
          }}
        >
          Change Status
        </Button>
        {(auth.user.role === 'judge' || auth.user.role === 'staff') && (
          <Button
            variant="contained"
            color="error"
            startIcon={<Delete />}
            onClick={handleDeleteHearing}
          >
            Delete Hearing
          </Button>
        )}
      </Box>

      <Dialog open={openStatusDialog} onClose={() => setOpenStatusDialog(false)}>
        <DialogTitle>Change Hearing Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              label="Status"
            >
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="postponed">Postponed</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStatusDialog(false)}>Cancel</Button>
          <Button onClick={handleStatusChange} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Availability Management page
const AvailabilityPage = () => {
  const auth = useAuth();
  const [availabilities, setAvailabilities] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState([]);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/availability', {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        setAvailabilities(response.data.data);
        
        const dateStr = selectedDate.toISOString().split('T')[0];
        const existingAvailability = response.data.data.find(a => 
          new Date(a.date).toISOString().split('T')[0] === dateStr
        );
        
        if (existingAvailability) {
          setTimeSlots(existingAvailability.timeSlots);
        } else {
          setTimeSlots(generateTimeSlots());
        }
      } catch (err) {
        console.error('Failed to fetch availability', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [auth.token]);

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const nextHour = minute === 30 ? hour + 1 : hour;
        const nextMinute = minute === 30 ? 0 : 30;
        const endTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
        slots.push({ startTime: time, endTime: endTime, status: 'available' });
      }
    }
    return slots;
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    
    const dateStr = date.toISOString().split('T')[0];
    const existingAvailability = availabilities.find(a => 
      new Date(a.date).toISOString().split('T')[0] === dateStr
    );
    
    if (existingAvailability) {
      setTimeSlots(existingAvailability.timeSlots);
    } else {
      setTimeSlots(generateTimeSlots());
    }
  };

  const handleTimeSlotChange = (index, status) => {
    const updatedSlots = [...timeSlots];
    updatedSlots[index].status = status;
    setTimeSlots(updatedSlots);
  };

  const handleSave = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      await axios.post('http://localhost:5000/api/availability', {
        date: dateStr,
        timeSlots
      }, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      
      const existingIndex = availabilities.findIndex(a => 
        new Date(a.date).toISOString().split('T')[0] === dateStr
      );
      
      if (existingIndex >= 0) {
        const updatedAvailabilities = [...availabilities];
        updatedAvailabilities[existingIndex].timeSlots = timeSlots;
        setAvailabilities(updatedAvailabilities);
      } else {
        setAvailabilities([...availabilities, {
          userId: auth.user.userId,
          userRole: auth.user.role,
          date: selectedDate,
          timeSlots
        }]);
      }
    } catch (err) {
      console.error('Failed to save availability', err);
    }
  };

  if (loading) {
    return <Typography>Loading availability...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Manage Availability
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          label="Select Date"
          type="date"
          value={selectedDate.toISOString().split('T')[0]}
          onChange={(e) => handleDateChange(new Date(e.target.value))}
          InputLabelProps={{
            shrink: true,
          }}
        />
      </Box>
      
      <Typography variant="h6" gutterBottom>
        Time Slots for {moment(selectedDate).format('MMMM D, YYYY')}
      </Typography>
      
      <Grid container spacing={2}>
        {timeSlots.map((slot, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
            <Paper 
              sx={{ 
                p: 2,
                cursor: 'pointer',
                backgroundColor: 
                  slot.status === 'available' ? 'success.light' :
                  slot.status === 'unavailable' ? 'error.light' : 'warning.light',
                color: 'common.white',
                textAlign: 'center'
              }}
              onClick={() => handleTimeSlotChange(
                index, 
                slot.status === 'available' ? 'unavailable' : 'available'
              )}
            >
              <Typography>
                {slot.startTime} - {slot.endTime}
              </Typography>
              <Typography variant="body2">
                {slot.status.toUpperCase()}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      
      <Box sx={{ mt: 3 }}>
        <Button 
          variant="contained" 
          onClick={handleSave}
          startIcon={<Check />}
        >
          Save Availability
        </Button>
      </Box>
    </Box>
  );
};

// Reports page
const ReportsPage = () => {
  const auth = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newReport, setNewReport] = useState({
    type: 'case_progress',
    period: 'monthly',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/reports', {
          headers: {
            Authorization: `Bearer ${auth.token}`
          }
        });
        setReports(response.data.data);
      } catch (err) {
        console.error('Failed to fetch reports', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [auth.token]);

  const handleGenerateReport = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/reports', newReport, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      setReports([...reports, response.data.data]);
      setOpenDialog(false);
      setNewReport({
        type: 'case_progress',
        period: 'monthly',
        startDate: '',
        endDate: ''
      });
    } catch (err) {
      console.error('Failed to generate report', err);
    }
  };

  if (loading) {
    return <Typography>Loading reports...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Reports</Typography>
        <Button 
          variant="contained" 
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
        >
          Generate Report
        </Button>
      </Box>
      
      <Grid container spacing={3}>
        {reports.map((report) => (
          <Grid item xs={12} md={6} key={report.reportId}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {report.type.replace('_', ' ').toUpperCase()} - {report.period.toUpperCase()}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Generated on {moment(report.createdAt).format('MMM D, YYYY')}
                </Typography>
                
                {report.type === 'case_progress' && (
                  <Box>
                    <Typography variant="subtitle1">Case Status Distribution</Typography>
                    {Object.entries(report.data).map(([status, count]) => (
                      <Box key={status} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ width: 100 }}>
                          <Typography>{status.replace('_', ' ')}</Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Box 
                            sx={{
                              height: 20,
                              width: `${count / Math.max(...Object.values(report.data)) * 100}%`,
                              bgcolor: 'primary.main',
                              borderRadius: 1
                            }}
                          />
                        </Box>
                        <Box sx={{ width: 40, textAlign: 'right' }}>
                          <Typography>{count}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                
                {report.type === 'judge_performance' && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Judge</TableCell>
                          <TableCell align="right">Cases Completed</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {report.data.map((judgeData) => (
                          <TableRow key={judgeData._id}>
                            <TableCell>{judgeData.judgeName}</TableCell>
                            <TableCell align="right">{judgeData.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                
                {report.type === 'resource_utilization' && (
                  <Box>
                    <Typography variant="subtitle1">Time Slot Utilization</Typography>
                    {Object.entries(report.data).map(([status, count]) => (
                      <Box key={status} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ width: 100 }}>
                          <Typography>{status}</Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Box 
                            sx={{
                              height: 20,
                              width: `${count / Math.max(...Object.values(report.data)) * 100}%`,
                              bgcolor: 'secondary.main',
                              borderRadius: 1
                            }}
                          />
                        </Box>
                        <Box sx={{ width: 40, textAlign: 'right' }}>
                          <Typography>{count}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button size="small">View Details</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate New Report</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={newReport.type}
                onChange={(e) => setNewReport({ ...newReport, type: e.target.value })}
                label="Report Type"
              >
                <MenuItem value="case_progress">Case Progress</MenuItem>
                <MenuItem value="judge_performance">Judge Performance</MenuItem>
                <MenuItem value="resource_utilization">Resource Utilization</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={newReport.period}
                onChange={(e) => setNewReport({ ...newReport, period: e.target.value })}
                label="Time Period"
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            
            {newReport.period === 'custom' && (
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                  value={newReport.startDate}
                  onChange={(e) => setNewReport({ ...newReport, startDate: e.target.value })}
                />
                <TextField
                  label="End Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                  value={newReport.endDate}
                  onChange={(e) => setNewReport({ ...newReport, endDate: e.target.value })}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleGenerateReport} variant="contained">Generate</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// App component
const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Make public cases the default route */}
          <Route path="/" element={
            <GuestLayout>
              <GuestCasesPage />
            </GuestLayout>
          } />
          
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Public routes */}
          <Route path="/public/cases" element={
            <GuestLayout>
              <GuestCasesPage />
            </GuestLayout>
          } />
          <Route path="/public/cases/:caseId" element={
            <GuestLayout>
              <GuestCaseDetailPage />
            </GuestLayout>
          } />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute>
              <MainLayout>
                <CalendarPage />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/cases" element={
            <ProtectedRoute>
              <MainLayout>
                <CasesPage />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/cases/:caseId" element={
            <ProtectedRoute>
              <MainLayout>
                <CaseDetailPage />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/hearings/:hearingId" element={
            <ProtectedRoute>
              <MainLayout>
                <HearingDetailPage />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/hearing/new" element={
            <ProtectedRoute roles={['judge']}>
              <MainLayout>
                <CalendarPage />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/availability" element={
            <ProtectedRoute roles={['judge', 'lawyer']}>
              <MainLayout>
                <AvailabilityPage />
              </MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute roles={['staff']}>
              <MainLayout>
                <ReportsPage />
              </MainLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;