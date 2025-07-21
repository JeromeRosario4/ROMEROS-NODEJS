const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review');
const upload = require('../middlewares/upload');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

router.post('/create', upload.array('images', 5), reviewController.createReview);
router.get('/customer/:customerId', reviewController.getReviewsByCustomer);
router.get('/', reviewController.getAllReviews);
router.put('/edit/:id', upload.array('images', 5), reviewController.updateReview); 
router.put('/delete/:id', reviewController.softDeleteReview); 
router.patch('/restore/:id', reviewController.restoreReview); 
router.get('/admin', isAuthenticatedUser, authorizeRoles('Admin'), reviewController.getAllDeletedReviews);


module.exports = router;