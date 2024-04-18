// controllers/userAuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user');
const saltRounds = 10;
const axios = require('axios');


// Function to generate JWT token
const generateToken = (userId, expiresIn) => {
  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ userId }, secret, { expiresIn });
  return token;
};

// Function to compare password with hashed password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Function to get user by ID
const getUserById = async (userId) => {
  return await User.findById(userId);
};

// Function to generate a random token
const generateRandomToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

// Function to update user's reset password token and expiry
const updateResetPasswordToken = async (email, token, expiry) => {
  return await User.findOneAndUpdate(
    { email },
    { resetPasswordToken: token, resetPasswordExpiry: expiry },
    { new: true }
  );
};

// Function to handle user login
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({email}).lean().exec()
  if(!user){
    return res.status(401).json({ success: false, message: "Invalid username or password" });
  }
  const match = await bcrypt.compare(password, user.password);
  const token = generateToken(user?._id, '1d')
  const refreshToken = generateRandomToken()
  const updatedUser = await User.findOneAndUpdate({_id:user?._id},{$set:{token, refreshToken, isActive:true}},{new:true, projection: { password: 0 } })
  if (match) {
    // Generate and set authentication token (you might use JWT)
    return res.status(200).json({ success: true, user: updatedUser });
  } else {
    return  res.status(401).json({ success: false, message: "Invalid username or password" });
  }
};

const refreshToken = async(req,res)=>{
  const { refreshToken } = req.body;
  const user = User.find(user => user.refreshToken === refreshToken);
  if (!user) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
  const token = generateToken(user?._id, '1d');
  const newRefreshToken = generateRandomToken();
  await User.findOneAndUpdate({_id:user?._id},{$set:{token, refreshToken: newRefreshToken, isActive:true}},{new:true})
  return res.json({ token, refreshToken });
}

// Function to handle user logout
const logoutUser = async (req, res) => {
  await User.findOneAndUpdate({_id:req?.user?._id},{$set:{token:'',isActive:false}},{new:true})
  return res.status(200).json({ success: true, message: "User logged out successfully" });
};

const forgotPassword = async (req, res) => {
  // Implement logic to send a password reset email to the user
  const { email } = req.body;

  // You might want to generate and send a unique reset link/token
  const resetToken = generateResetToken(email);

  // Send reset link to the user's email address
  sendResetEmail(email, resetToken);

  return res.status(200).json({ success: true, message: "Password reset instructions sent to your email" });
};

// Function to handle user reset password
const resetPassword = async (req, res) => {
  // Validate the reset token and update the user's password
  const { resetToken, newPassword } = req.body;

  // Validate the reset token (you should implement this part)
  const isValidToken = validateResetToken(resetToken);

  if (isValidToken) {
    // Update the user's password (you should implement this part)
    updatePassword(resetToken, newPassword);

    return res.status(200).json({ success: true, message: "Password reset successfully" });
  } else {
    return res.status(401).json({ success: false, message: "Invalid reset token" });
  }
};


// Function to handle updating user account
const updateAccount = async (req, res) => {
  // Update the user's account information (you should implement this part)
  const updatedUserData = req.body;
  // Validate input
  const validation = validateRegistrationInput(updatedUserData.email, updatedUserData.phoneNo);
  if (!validation.success) {
    return res.status(400).json(validation);
  }

  console.log('updatedUserData',updatedUserData)
  // Check if email is unique
  const isUnique = await User.findOne({email:updatedUserData.email , _id:{$ne: req.user.userId} });

  if (isUnique) {
    return res.status(400).json({ success: false, message: 'Email is already registered' });
  }

  // Example: Update user data in the database
  const updatedUser = await User.findByIdAndUpdate(req.user.userId, updatedUserData,{new:true, projection: { password: 0 }});
  console.log('user ID', req.user.userId)
  // console.log('updated user',updatedUser)

  if (updatedUser) {
    return res.status(200).json({ success: true, message: "Account updated successfully", user: updatedUser});
  } else {
    return res.status(500).json({ success: false, message: "Failed to update account" });
  }
};

// Function to handle user registration
const validateRegistrationInput = (email, phone) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: 'Invalid email format' };
  }

  // const phoneRegex = /^[0-9]{12}$/; // Assuming a 12-digit phone number for simplicity with isd code
  // if (!phoneRegex.test(phone)) {
  //   return { success: false, message: 'Invalid phone number format' };
  // }

  return { success: true };
};

const registerUser = async (req, res) => {
  const { name, email, phoneNo, password } = req.body;

  const validation = validateRegistrationInput(email, phoneNo, password);
  if (!validation.success) {
    return res.status(400).json(validation);
  }

  const isUniqueEmail = await User.findOne({
    $or: [
      { email: email }
    ]
  });
    if (isUniqueEmail) {
    return res.status(400).json({ success: false, message: 'Email is already registered' });
  }

  const isUniqueNumber = await User.findOne({
    $or: [
      { phoneNo: phoneNo }
    ]
  });
    if (isUniqueNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is already registered' });
  }

  const passwordHash = await hashPassword(password, saltRounds);

  const userData = {name, email, phoneNo, password: passwordHash };
  const newUser = await User.create(userData);
  
  const token = generateToken(newUser?._id, '1d')
  const refreshToken = generateRandomToken()
  const updatedUser = await User.findOneAndUpdate({_id:newUser?._id},{$set:{token, refreshToken, isActive:true}},{new:true,  projection: { password: 0 } })

  return res.status(201).json({ success: true, user: updatedUser });
};

const refreshWebhook = async (req, res)=>{
  try {
    const webhook_url = process.env.WEBHOOK_API
    const access_token = process.env.ACCESS_TOKEN_CB
    const {instance_id} = req.body 
    let enable = true;
    let url =`${process.env.LOGIN_CB_API}/set_webhook`

    const result = await axios.get(url, {params:{
      webhook_url,access_token,enable,instance_id
    }})

    console.log('result' , result );

  } catch (error) {
    
  }
}

const hashPassword = async (password, saltRounds) => {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(hash);
    return hash;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const changePassword = async (req,res)=>{
  const { oldPassword, newPassword } = req.body;
  try {
    // Find the user by username
    const user = await User.findOne({ _id: req.user.userId });

    // If user not found or old password is incorrect
    const match = await bcrypt.compare(oldPassword, user.password );

    if (!match) {
      return res.status(401).json({ success: false, message: 'Old password is incorrect' });
    }


    const newMatch = await bcrypt.compare(newPassword, user.password );

    if (newMatch) {
      return res.status(401).json({ success: false, message: "New password can't be same as old" });
    }

    // Update the password
    user.password = await hashPassword(newPassword, saltRounds);

    await user.save();

    // Send success response
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
  }
}

module.exports = {
  generateToken,
  refreshToken,
  comparePassword,
  getUserById,
  generateRandomToken,
  updateResetPasswordToken,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  updateAccount,
  registerUser,
  refreshWebhook,
  changePassword
};
