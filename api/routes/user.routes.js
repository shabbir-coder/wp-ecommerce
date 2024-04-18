// routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/user');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Get user by ID route
router.get('/:userId', authenticateToken, userController.getUserById);

// Update account route
router.put('/update-profile', authenticateToken, userController.updateAccount);

// Update account route
router.put('/update-password', authenticateToken, userController.changePassword);

// Register user route
router.post('/register', userController.registerUser);

module.exports = router;
