const db = require('../config/database');
const createReview = (req, res) => {    
    const { orderinfo_id, customer_id, item_id, rating, review_text } = req.body;
    const imageFiles = req.files || [];

    if (!orderinfo_id || !customer_id || !item_id || !rating) {
        const missingFields = [];
        if (!orderinfo_id) missingFields.push('orderinfo_id');
        if (!customer_id) missingFields.push('customer_id');
        if (!item_id) missingFields.push('item_id');
        if (!rating) missingFields.push('rating');
        
        return res.status(400).json({ 
            error: 'Missing required fields', 
            missing: missingFields,
            received: req.body 
        });
    }

    const reviewSql = `
        INSERT INTO reviews 
        (orderinfo_id, customer_id, item_id, rating, review_text, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    `;
    const reviewValues = [orderinfo_id, customer_id, item_id, rating, review_text || null];

    db.execute(reviewSql, reviewValues, (err, result) => {
        if (err) {
            console.error('Database error creating review:', err);
            return res.status(500).json({ error: 'Error creating review', details: err.message });
        }

        const reviewId = result.insertId;

        if (imageFiles.length > 0) {
            const imgSql = `INSERT INTO review_images (review_id, image_path, created_at) VALUES ?`;
            const imgValues = imageFiles.map(file => [reviewId, file.filename, new Date()]);
            
            db.query(imgSql, [imgValues], (err3) => {      
                if (err3) {
                    console.error('Error saving review images:', err3);
                    return res.status(500).json({ error: 'Error saving review images', details: err3.message });
                }
                return res.status(201).json({ 
                    success: true, 
                    message: 'Review created with images', 
                    reviewId,
                    imageCount: imageFiles.length
                });
            });
        } else {
            return res.status(201).json({ 
                success: true, 
                message: 'Review created', 
                reviewId 
            });
        }
    });
};

const getAllReviews = (req, res) => {
    const sql = `
        SELECT 
            r.*, 
            i.item_name,
            c.fname,
            c.lname,
            concat(c.fname, ' ', c.lname) AS customer_name
        FROM reviews r
        INNER JOIN item i ON r.item_id = i.item_id
        INNER JOIN customer c ON r.customer_id = c.customer_id
        WHERE r.deleted_at IS NULL
        ORDER BY r.created_at DESC
    `;

    const imagesSql = `
        SELECT review_id, image_path 
        FROM review_images 
        WHERE deleted_at IS NULL
    `;

    try {
        db.query(sql, (err, reviews, fields) => {
            if (err instanceof Error) {
                console.log(err);
                return res.status(500).json({ error: 'Database error fetching reviews' });
            }

            // Get all review images
            db.query(imagesSql, (err, images) => {
                if (err instanceof Error) {
                    console.log(err);
                    return res.status(500).json({ error: 'Database error fetching review images' });
                }

                // Group images by review_id
                const imagesByReview = images.reduce((acc, image) => {
                    if (!acc[image.review_id]) {
                        acc[image.review_id] = [];
                    }
                    acc[image.review_id].push(image.image_path);
                    return acc;
                }, {});

                const reviewsWithImages = reviews.map(review => ({
                    ...review,
                    images: imagesByReview[review.review_id] || [],
                    image: imagesByReview[review.review_id] ? imagesByReview[review.review_id][0] : null
                }));

                return res.status(200).json({
                    rows: reviewsWithImages
                });
            });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const getAllDeletedReviews = (req, res) => {
    const sql = `
        SELECT 
            r.*, 
            i.item_name,
            c.fname,
            c.lname,
            concat(c.fname, ' ', c.lname) AS customer_name
        FROM reviews r
        INNER JOIN item i ON r.item_id = i.item_id
        INNER JOIN customer c ON r.customer_id = c.customer_id
        WHERE r.deleted_at IS NOT NULL
        ORDER BY r.deleted_at DESC
    `;

    const imagesSql = `
        SELECT review_id, image_path 
        FROM review_images 
        WHERE deleted_at IS NULL
    `;

    try {
        db.query(sql, (err, reviews, fields) => {
            if (err instanceof Error) {
                console.log(err);
                return res.status(500).json({ error: 'Database error fetching deleted reviews' });
            }

            // Get all review images
            db.query(imagesSql, (err, images) => {
                if (err instanceof Error) {
                    console.log(err);
                    return res.status(500).json({ error: 'Database error fetching review images' });
                }

                // Group images by review_id
                const imagesByReview = images.reduce((acc, image) => {
                    if (!acc[image.review_id]) {
                        acc[image.review_id] = [];
                    }
                    acc[image.review_id].push(image.image_path);
                    return acc;
                }, {});

                const reviewsWithImages = reviews.map(review => ({
                    ...review,
                    images: imagesByReview[review.review_id] || [],
                    image: imagesByReview[review.review_id] ? imagesByReview[review.review_id][0] : null
                }));

                return res.status(200).json({
                    rows: reviewsWithImages
                });
            });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const getReviewsByCustomer = (req, res) => {
    const customerId = req.params.customerId;
  
    const sql = `
      SELECT 
        r.review_id,
        r.orderinfo_id,
        r.created_at,
        r.updated_at,
        r.deleted_at,
        r.item_id,
        r.rating,
        r.review_text,
        r.created_at,
        i.item_name,
        i.sell_price AS price
      FROM reviews r
      JOIN item i ON r.item_id = i.item_id
      WHERE r.customer_id = ? AND r.deleted_at IS NULL
      ORDER BY r.created_at DESC
    `;
  
    db.query(sql, [customerId], (err, reviews) => {
      if (err) {
        console.error("Error fetching reviews:", err);
        return res.status(500).json({ success: false, message: "Error fetching reviews" });
      }
  
      if (!reviews.length) {
        return res.json({ success: true, data: [] });
      }
  
      const reviewIds = reviews.map(r => r.review_id);
      const placeholders = reviewIds.map(() => '?').join(',');
  
      const imagesSql = `
        SELECT 
          review_id,
          image_path
        FROM review_images 
        WHERE review_id IN (${placeholders}) AND deleted_at IS NULL
      `;
  
      db.query(imagesSql, reviewIds, (err, reviewImages) => {
        if (err) {
          console.error("Error fetching review images:", err);
          return res.status(500).json({ success: false, message: "Error fetching review images" });
        }
  
        // Group images by review_id
        const imagesByReview = {};
        reviewImages.forEach(image => {
          if (!imagesByReview[image.review_id]) {
            imagesByReview[image.review_id] = [];
          }
          imagesByReview[image.review_id].push(image.image_path);
        });
  
        // Add images to reviews
        const reviewsWithImages = reviews.map(review => ({
          ...review,
          images: imagesByReview[review.review_id] || [],
          image: imagesByReview[review.review_id] ? imagesByReview[review.review_id][0] : null
        }));
  
        res.json({ success: true, data: reviewsWithImages });
      });
    });
  };
  
  // Edit (update) review
const updateReview = (req, res) => {
    const reviewId = req.params.id;
    const { rating, review_text } = req.body;
    const imageFiles = req.files || [];

    const sql = `UPDATE reviews SET rating = ?, review_text = ?, updated_at = NOW() WHERE review_id = ?`;
    db.query(sql, [rating, review_text, reviewId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error updating review', details: err });

        if (imageFiles.length > 0) {
            // Delete old images from review_images table
            const deleteSql = `DELETE FROM review_images WHERE review_id = ?`;
            db.query(deleteSql, [reviewId], (delErr) => {
                if (delErr) return res.status(500).json({ error: 'Error deleting old review images', details: delErr });

                // Insert new images
                const imgSql = `INSERT INTO review_images (review_id, image_path, created_at) VALUES ?`;
                const imgValues = imageFiles.map(file => [reviewId, file.filename, new Date()]);
                db.query(imgSql, [imgValues], (err3) => {
                    if (err3) return res.status(500).json({ error: 'Error saving review images', details: err3 });
                    return res.status(200).json({ success: true, message: 'Review updated with new images' });
                });
            });
        } else {
            return res.status(200).json({ success: true, message: 'Review updated' });
        }
    });
};

// Soft delete review
const softDeleteReview = (req, res) => {
    const reviewId = req.params.id;
    const sql = `UPDATE reviews SET deleted_at = NOW() WHERE review_id = ?`;
    db.query(sql, [reviewId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error soft deleting review', details: err });
        return res.status(200).json({ success: true, message: 'Review soft deleted' });
    });
};

// Restore review
const restoreReview = (req, res) => {
    const reviewId = req.params.id;
    const sql = `UPDATE reviews SET deleted_at = NULL WHERE review_id = ?`;
    db.query(sql, [reviewId], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error restoring review', details: err });
        return res.status(200).json({ success: true, message: 'Review restored' });
    });
};

module.exports = {
    createReview,
    getReviewsByCustomer,
    updateReview,
    softDeleteReview,
    restoreReview,
    getAllReviews,
    getAllDeletedReviews
};