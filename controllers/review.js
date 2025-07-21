const db = require('../config/database');

// Helper function to handle database errors
const handleDbError = (res, err, operation) => {
    console.error(`Database error during ${operation}:`, err);
    return res.status(500).json({ 
        success: false,
        error: `Database error during ${operation}`,
        details: err.message 
    });
};

// Helper function to validate review data
const validateReviewData = (data) => {
    const { orderinfo_id, customer_id, item_id, rating } = data;
    const errors = [];
    
    if (!orderinfo_id) errors.push('orderinfo_id is required');
    if (!customer_id) errors.push('customer_id is required');
    if (!item_id) errors.push('item_id is required');
    if (!rating) errors.push('rating is required');
    if (rating && (rating < 1 || rating > 5)) errors.push('rating must be between 1 and 5');
    
    return errors.length ? errors : null;
};

const createReview = async (req, res) => {
    try {
        const { orderinfo_id, customer_id, item_id, rating, review_text } = req.body;
        const imageFiles = req.files || [];

        // Validate input
        const validationErrors = validateReviewData(req.body);
        if (validationErrors) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Start transaction
        await db.promise().beginTransaction();

        try {
            // Create review
            const [reviewResult] = await db.promise().execute(
                `INSERT INTO reviews 
                (orderinfo_id, customer_id, item_id, rating, review_text, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())`,
                [orderinfo_id, customer_id, item_id, rating, review_text || null]
            );

            const reviewId = reviewResult.insertId;

            // Handle images if present
            if (imageFiles.length > 0) {
                await db.promise().query(
                    `INSERT INTO review_images (review_id, image_path, created_at) VALUES ?`,
                    [imageFiles.map(file => [reviewId, file.filename, new Date()])]
                );
            }

            // Commit transaction
            await db.promise().commit();

            return res.status(201).json({ 
                success: true, 
                message: imageFiles.length ? 'Review created with images' : 'Review created',
                reviewId,
                imageCount: imageFiles.length
            });

        } catch (err) {
            // Rollback transaction on error
            await db.promise().rollback();
            return handleDbError(res, err, 'review creation');
        }

    } catch (err) {
        return handleDbError(res, err, 'review creation');
    }
};

const getAllReviews = async (req, res) => {
    try {
        // Get all active reviews
        const [reviews] = await db.promise().query(`
            SELECT 
                r.*, 
                i.item_name,
                c.fname,
                c.lname,
                CONCAT(c.fname, ' ', c.lname) AS customer_name
            FROM reviews r
            INNER JOIN item i ON r.item_id = i.item_id
            INNER JOIN customer c ON r.customer_id = c.customer_id
            WHERE r.deleted_at IS NULL
            ORDER BY r.created_at DESC
        `);

        // Get all active review images
        const [images] = await db.promise().query(`
            SELECT review_id, image_path 
            FROM review_images 
            WHERE deleted_at IS NULL
        `);

        // Group images by review_id
        const imagesByReview = images.reduce((acc, image) => {
            if (!acc[image.review_id]) {
                acc[image.review_id] = [];
            }
            acc[image.review_id].push(image.image_path);
            return acc;
        }, {});

        // Combine reviews with their images
        const reviewsWithImages = reviews.map(review => ({
            ...review,
            images: imagesByReview[review.review_id] || [],
            image: imagesByReview[review.review_id]?.[0] || null
        }));

        return res.status(200).json({
            success: true,
            data: reviewsWithImages
        });

    } catch (err) {
        return handleDbError(res, err, 'fetching reviews');
    }
};

const getAllDeletedReviews = async (req, res) => {
    try {
        // Get all deleted reviews
        const [reviews] = await db.promise().query(`
            SELECT 
                r.*, 
                i.item_name,
                c.fname,
                c.lname,
                CONCAT(c.fname, ' ', c.lname) AS customer_name
            FROM reviews r
            INNER JOIN item i ON r.item_id = i.item_id
            INNER JOIN customer c ON r.customer_id = c.customer_id
            WHERE r.deleted_at IS NOT NULL
            ORDER BY r.deleted_at DESC
        `);

        // Get all active review images
        const [images] = await db.promise().query(`
            SELECT review_id, image_path 
            FROM review_images 
            WHERE deleted_at IS NULL
        `);

        // Group images by review_id
        const imagesByReview = images.reduce((acc, image) => {
            if (!acc[image.review_id]) {
                acc[image.review_id] = [];
            }
            acc[image.review_id].push(image.image_path);
            return acc;
        }, {});

        // Combine reviews with their images
        const reviewsWithImages = reviews.map(review => ({
            ...review,
            images: imagesByReview[review.review_id] || [],
            image: imagesByReview[review.review_id]?.[0] || null
        }));

        return res.status(200).json({
            success: true,
            data: reviewsWithImages
        });

    } catch (err) {
        return handleDbError(res, err, 'fetching deleted reviews');
    }
};

const getReviewsByCustomer = async (req, res) => {
    try {
        const customerId = req.params.customerId;

        // Get customer's reviews
        const [reviews] = await db.promise().query(`
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
        `, [customerId]);

        if (!reviews.length) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Get review images in one query
        const reviewIds = reviews.map(r => r.review_id);
        const [reviewImages] = await db.promise().query(`
            SELECT review_id, image_path
            FROM review_images
            WHERE review_id IN (?) AND deleted_at IS NULL
        `, [reviewIds]);

        // Group images by review_id
        const imagesByReview = reviewImages.reduce((acc, image) => {
            if (!acc[image.review_id]) {
                acc[image.review_id] = [];
            }
            acc[image.review_id].push(image.image_path);
            return acc;
        }, {});

        // Combine reviews with their images
        const reviewsWithImages = reviews.map(review => ({
            ...review,
            images: imagesByReview[review.review_id] || [],
            image: imagesByReview[review.review_id]?.[0] || null
        }));

        return res.status(200).json({
            success: true,
            data: reviewsWithImages
        });

    } catch (err) {
        return handleDbError(res, err, 'fetching customer reviews');
    }
};

const updateReview = async (req, res) => {
    try {
        const reviewId = req.params.id;
        const { rating, review_text } = req.body;
        const imageFiles = req.files || [];

        // Validate rating if provided
        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be between 1 and 5'
            });
        }

        await db.promise().beginTransaction();

        try {
            // Update review
            await db.promise().execute(
                `UPDATE reviews 
                SET rating = ?, review_text = ?, updated_at = NOW() 
                WHERE review_id = ?`,
                [rating, review_text, reviewId]
            );

            // Handle images if provided
            if (imageFiles.length > 0) {
                // Delete existing images
                await db.promise().execute(
                    `DELETE FROM review_images WHERE review_id = ?`,
                    [reviewId]
                );

                // Insert new images
                await db.promise().query(
                    `INSERT INTO review_images (review_id, image_path, created_at) VALUES ?`,
                    [imageFiles.map(file => [reviewId, file.filename, new Date()])]
                );
            }

            await db.promise().commit();

            return res.status(200).json({
                success: true,
                message: 'Review updated successfully'
            });

        } catch (err) {
            await db.promise().rollback();
            return handleDbError(res, err, 'updating review');
        }

    } catch (err) {
        return handleDbError(res, err, 'updating review');
    }
};

const softDeleteReview = async (req, res) => {
    try {
        const reviewId = req.params.id;

        const [result] = await db.promise().execute(
            `UPDATE reviews SET deleted_at = NOW() WHERE review_id = ?`,
            [reviewId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Review soft deleted successfully'
        });

    } catch (err) {
        return handleDbError(res, err, 'soft deleting review');
    }
};

const restoreReview = async (req, res) => {
    try {
        const reviewId = req.params.id;

        const [result] = await db.promise().execute(
            `UPDATE reviews SET deleted_at = NULL WHERE review_id = ?`,
            [reviewId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Review restored successfully'
        });

    } catch (err) {
        return handleDbError(res, err, 'restoring review');
    }
};

module.exports = {
    createReview,
    getAllReviews,
    getAllDeletedReviews,
    getReviewsByCustomer,
    updateReview,
    softDeleteReview,
    restoreReview
};