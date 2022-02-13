const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');

router.get('/', userController.get_User_Data); // Route to Update Email, Number & Profile Pic for Vendors
router.put('/', userController.update_User_Plan); // Route for Vendor Account Delete
router.get('/access', userController.update_Access_Token); // Update Access Token

module.exports = router;