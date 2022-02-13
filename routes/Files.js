const express = require('express');
const router = express.Router();
const fileController = require('../controllers/files');

router.get('/', fileController.generate_Object_File);
router.post('/api', fileController.generate_Object_File_API);

module.exports = router;