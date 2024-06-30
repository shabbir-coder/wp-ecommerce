// routes/userRoutes.js
const express = require('express');
const cmsController = require('../controllers/cms.controller');
const { authenticateToken } = require('../middlewares/auth');
const multer = require('multer');
const fs = require('fs');
const router = express.Router();

// Set up storage strategy for Multer
const FileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads/') // make sure this folder exists
    },
    filename: function (req, file, cb) {
      // You can use the original name or add a timestamp for uniqueness
      cb(null, Date.now() + '-' + file.originalname.trim().replaceAll(' ',''))
    }
  });
  const upload = multer({ storage: FileStorage });

  const ImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads/Images') // make sure this folder exists
    },
    filename: function (req, file, cb) {
      // You can use the original name or add a timestamp for uniqueness
      cb(null, file.originalname.trim().replaceAll(' ',''))
    }
  });


  const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = './uploads/Images'; // Adjust the path as needed

        // Check if directory exists, create it if not
        fs.access(uploadPath, (error) => {
            if (error) {
                // Directory does not exist, create it
                fs.mkdir(uploadPath, { recursive: true }, (error) => {
                    if (error) {
                        cb(error);
                    } else {
                        cb(null, uploadPath);
                    }
                });
            } else {
                // Directory exists, pass the path to callback
                cb(null, uploadPath);
            }
        });
    },
    filename: function (req, file, cb) {
        const safeFileName = file.originalname.trim().toLowerCase().replace(/\s+/g, '');
        cb(null, safeFileName); 
    }
});
  const imagesUpload = multer({ storage: imageStorage });


  router.get('',  authenticateToken, cmsController.listAllFiles);

  router.post('/chatConfig', authenticateToken, cmsController.createChatConfig);
  router.get('/chatConfig', authenticateToken, cmsController.getChatConfig);
  router.get('/:id', authenticateToken, cmsController.getFile);
  router.post('/upload', authenticateToken , upload.single('file'), cmsController.uploadFile);
  router.delete('/:id', authenticateToken, cmsController.deleteFile);
  router.post('/:id/status', authenticateToken, cmsController.updateFileStatus);

  router.post('/upload/images/:fileId', authenticateToken, imagesUpload.array('images'), cmsController.uploadImages);
  router.post('/upload/image/:fileId/:ImageId', authenticateToken, imagesUpload.single('image'), cmsController.uploadImageById);
  router.get('/images/:fileId', authenticateToken, cmsController.getAllImages);

module.exports = router;
