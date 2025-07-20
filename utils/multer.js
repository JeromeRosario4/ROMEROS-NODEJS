const multer = require("multer");
const path = require("path");

// Configure storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images'); // Ensure this directory exists
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();

    // Sanitize base name (remove slashes or weird chars)
    let baseName = path.parse(file.originalname).name.replace(/[^\w\-]/g, '_');
    cb(null, `${baseName}-${timestamp}-${random}${ext}`);
  }
});

const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // or your storage setup

router.post('/reviews', upload.array('image'), reviewController.createReview);


// File filter for image types only
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) {
    cb(new Error("Unsupported file type! Only .jpg, .jpeg, .png allowed."), false);
  } else {
    cb(null, true);
  }
};

// Export configured multer instance
module.exports = multer({
  storage: storage,
  fileFilter: fileFilter,
});
