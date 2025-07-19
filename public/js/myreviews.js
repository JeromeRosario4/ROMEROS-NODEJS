$(document).ready(async function () {
    const API_BASE_URL = 'http://localhost:3000';
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    // Check authentication
    if (!token || !userId) {
        alert('⛔ Please log in first.');
        window.location.href = '/login.html';
        return;
    }

    // Load header with loading indicator
    $('#header').html(`
        <div class="d-flex justify-content-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `);

    try {
        await loadHeader();
        await loadReviews();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('⚠️ Failed to load page content. Please try again.');
    }

    // Header loading function
    async function loadHeader() {
        return new Promise((resolve) => {
            $('#header').load('/header.html', function () {
                // Initialize dropdowns
                const dropdownTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
                dropdownTriggerList.forEach(dropdownTriggerEl => {
                    new bootstrap.Dropdown(dropdownTriggerEl);
                });

                if (token && userId) {
                    $('#login-link, #register-link').addClass('d-none');
                    $('#user-dropdown').removeClass('d-none');

                    $.get(`${API_BASE_URL}/api/users/customers/${userId}`, function (res) {
                        if (res.success && res.data) {
                            const data = res.data;
                            const fullName = `${data.fname || ''} ${data.lname || ''}`.trim();
                            $('#username').text(fullName || 'USER');
                            if (data.image_path) {
                                $('.profile-img').attr('src', `/${data.image_path}`);
                            }
                        }
                    });
                }
                updateCartCount();
                resolve();
            });
        });
    }

    async function loadReviews() {
        try {
            console.log('Loading reviews for userId:', userId);

            // Show loading state
            $('#reviewsList').html(`
                <div class="d-flex justify-content-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading reviews...</span>
                    </div>
                </div>
            `);

            // Get customer profile
            const profileRes = await $.ajax({
                url: `${API_BASE_URL}/api/users/customers/${userId}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!profileRes.success || !profileRes.data) {
                $('#reviewsList').html('<p class="text-danger">⚠️ No customer profile found.</p>');
                return;
            }

            const customerId = profileRes.data.customer_id;
            console.log('Customer ID:', customerId);

            if (!customerId) {
                $('#reviewsList').html('<p class="text-danger">⚠️ Customer ID not found in profile.</p>');
                return;
            }

            // Get reviews - modify the endpoint to include deleted reviews
            const reviewsRes = await $.ajax({
                url: `${API_BASE_URL}/api/reviews/customer/${customerId}?include_deleted=true`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Reviews response:', reviewsRes);

            if (!reviewsRes.success) {
                $('#reviewsList').html(`<p class="text-danger">⚠️ Failed to load reviews: ${reviewsRes.message || 'Unknown error'}</p>`);
                return;
            }

            if (!Array.isArray(reviewsRes.data) || reviewsRes.data.length === 0) {
                $('#reviewsList').html(`
                    <div class="no-reviews">
                        <i class="fas fa-star fa-3x text-muted mb-3"></i>
                        <h4 class="text-muted">No Reviews Yet</h4>
                        <p class="text-muted">You haven't written any reviews yet.</p>
                        <a href="/myorders.html" class="btn btn-primary">
                            <i class="fas fa-shopping-cart me-2"></i>View My Orders
                        </a>
                    </div>
                `);
                return;
            }

            // Process and display reviews
            const html = reviewsRes.data.map(review => {
                const stars = generateStars(review.rating);
                const images = Array.isArray(review.images) ? review.images : [];
                const isDeleted = review.deleted_at !== null;

                return `
                    <div class="review-card mb-4 p-3 border rounded shadow-sm ${isDeleted ? 'bg-light opacity-75' : ''}">
                        ${isDeleted ? '<div class="badge bg-warning text-dark mb-2">Deleted</div>' : ''}
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="flex-grow-1">
                                <div class="item-name mb-2">${escapeHtml(review.item_name)}</div>
                                <div class="rating-display">
                                    <span class="stars">${stars}</span>
                                    <span class="badge bg-primary">${review.rating}/5</span>
                                </div>
                            </div>
                            <div class="review-meta text-end">
                                <small>Order #${review.orderinfo_id}</small><br>
                                <small>${formatDate(review.created_at)}</small>
                                ${isDeleted ? `<br><small class="text-muted">Deleted: ${formatDate(review.deleted_at)}</small>` : ''}
                            </div>
                        </div>
                        
                        ${review.review_text ? `
                            <div class="review-text">
                                <i class="fas fa-quote-left text-muted me-2"></i>
                                ${escapeHtml(review.review_text)}
                            </div>
                        ` : ''}
                        
                        ${images.length > 0 && !isDeleted ? `
                            <div class="review-images">
                                ${images.map(image => `
                                    <img src="/images/${image}" 
                                         alt="Review Image" 
                                         class="review-image"
                                         onclick="showImageModal('/images/${image}')">
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        <div class="mt-3">
                            ${!isDeleted ? `
                                <button class="btn btn-sm btn-info edit-review-btn" 
                                    data-review-id="${review.review_id}" 
                                    data-review-text="${encodeURIComponent(review.review_text || '')}"
                                    data-rating="${review.rating}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger delete-review-btn" 
                                    data-review-id="${review.review_id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : `
                                <button class="btn btn-sm btn-success restore-review-btn" 
                                    data-review-id="${review.review_id}">
                                    <i class="fas fa-undo"></i> Restore
                                </button>
                                <button class="btn btn-sm btn-danger permanently-delete-btn" 
                                    data-review-id="${review.review_id}">
                                    <i class="fas fa-times"></i> Delete Permanently
                                </button>
                            `}
                        </div>
                    </div>
                `;
            }).join('');

            $('#reviewsList').html(html);

        } catch (error) {
            console.error('Error loading reviews:', error);

            let errorMessage = 'Failed to load reviews. Please try again.';

            if (error.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
                setTimeout(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    window.location.href = '/login.html';
                }, 2000);
            } else if (error.status === 403) {
                errorMessage = 'Access denied. You don\'t have permission to view these reviews.';
            } else if (error.status === 404) {
                errorMessage = 'Reviews not found or API endpoint not available.';
            } else if (error.status === 500) {
                errorMessage = 'Server error. Please try again later.';
            }

            $('#reviewsList').html(`<p class="text-danger">⚠️ ${errorMessage}</p>`);
        }
    }

    // Helper functions
    function updateCartCount() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        $('#cart-count').text(totalQty);
    }

    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Invalid Date';
        }
    }

    function generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let stars = '';

        // Full stars
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }

        // Half star
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }

        // Empty stars
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }

        return stars;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    // Image modal function
    window.showImageModal = function (imageSrc) {
        $('#modalImage').attr('src', imageSrc);
        $('#imageModal').modal('show');
    };

    /// Edit review - enhanced with star rating functionality
    $(document).on('click', '.edit-review-btn', function () {
        const reviewId = $(this).data('review-id');
        const reviewText = decodeURIComponent($(this).data('review-text'));
        const rating = parseInt($(this).data('rating'));

        // Set values in modal
        $('#editReviewId').val(reviewId);
        $('#editReviewText').val(reviewText);
        $('#editRating').val(rating);

        // Initialize star rating display
        updateEditRatingDisplay(rating);

        // Show modal
        $('#editReviewModal').modal('show');
    });

    // Star rating for edit modal
    $('#editReviewModal .rating-stars i').on('click', function () {
        const rating = $(this).data('rating');
        $('#editRating').val(rating);
        updateEditRatingDisplay(rating);
    }).hover(
        function () {
            const hoverRating = $(this).data('rating');
            $('#editReviewModal .rating-stars i').each(function () {
                $(this).toggleClass('fas far', $(this).data('rating') <= hoverRating);
            });
        },
        function () {
            const currentRating = $('#editRating').val();
            updateEditRatingDisplay(currentRating);
        }
    );

    function updateEditRatingDisplay(rating) {
        $('#editRatingDescription').text(`${rating} out of 5 stars`);
        $('#editReviewModal .rating-stars i').each(function () {
            $(this).toggleClass('fas far', $(this).data('rating') <= rating);
        });
    }

    // Add this code to your existing myreviews.js file

    // Image preview functionality for edit modal
    $('#editReviewImages').on('change', function () {
        const files = this.files;
        const previewContainer = $('#editImagePreview');
        previewContainer.empty();

        if (files.length > 5) {
            alert('You can only upload up to 5 images');
            this.value = '';
            return;
        }

        // Show preview of selected images
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const imgPreview = $(`
                    <div class="image-preview-item d-inline-block me-2 mb-2 position-relative">
                        <img src="${e.target.result}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;">
                        <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 remove-preview" 
                                data-index="${i}" style="width: 20px; height: 20px; padding: 0; font-size: 12px;">×</button>
                    </div>
                `);
                    previewContainer.append(imgPreview);
                };
                reader.readAsDataURL(file);
            }
        }
    });

    // Remove image from preview
    $(document).on('click', '.remove-preview', function () {
        const index = $(this).data('index');
        $(this).closest('.image-preview-item').remove();

        // Reset file input to remove the selected file
        const fileInput = $('#editReviewImages')[0];
        const dt = new DataTransfer();
        const files = fileInput.files;

        for (let i = 0; i < files.length; i++) {
            if (i !== index) {
                dt.items.add(files[i]);
            }
        }

        fileInput.files = dt.files;
    });

    // Enhanced edit form submission with image upload
    $('#editReviewForm').off('submit').on('submit', function (e) {
        e.preventDefault();

        const $submitBtn = $(this).find('button[type="submit"]');
        $submitBtn.prop('disabled', true);
        $submitBtn.find('.submit-text').text('Saving...');
        $submitBtn.find('.spinner-border').removeClass('d-none');

        const reviewId = $('#editReviewId').val();
        const reviewText = $('#editReviewText').val().trim();
        const rating = $('#editRating').val();
        const imageFiles = $('#editReviewImages')[0].files;

        // Basic validation
        if (!reviewText || reviewText.length < 20) {
            alert('Please write at least 20 characters for your review');
            resetSubmitButton($submitBtn);
            return;
        }

        if (rating < 1 || rating > 5) {
            alert('Please select a rating between 1 and 5 stars');
            resetSubmitButton($submitBtn);
            return;
        }

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('review_text', reviewText);
        formData.append('rating', rating);

        // Add image files if any
        if (imageFiles.length > 0) {
            for (let i = 0; i < imageFiles.length; i++) {
                formData.append('images', imageFiles[i]);
            }
        }

        $.ajax({
            url: `${API_BASE_URL}/api/reviews/edit/${reviewId}`,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
                // Don't set Content-Type for FormData, let jQuery handle it
            },
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                $('#editReviewModal').modal('hide');
                loadReviews();

                // Clear the form
                $('#editReviewForm')[0].reset();
                $('#editImagePreview').empty();

                Swal.fire({
                    icon: 'success',
                    title: 'Review Updated',
                    text: 'Your review has been updated successfully!',
                    timer: 2000,
                    showConfirmButton: false
                });
            },
            error: function (xhr) {
                console.error('Error updating review:', xhr);

                let errorMessage = 'Failed to update review. Please try again.';

                if (xhr.responseJSON?.message) {
                    errorMessage = xhr.responseJSON.message;
                } else if (xhr.status === 413) {
                    errorMessage = 'Images are too large. Please choose smaller images.';
                } else if (xhr.status === 415) {
                    errorMessage = 'Invalid image format. Please use JPEG or PNG images.';
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Update Failed',
                    text: errorMessage
                });
            },
            complete: function () {
                resetSubmitButton($submitBtn);
            }
        });
    });

    // Helper function to reset submit button
    function resetSubmitButton($submitBtn) {
        $submitBtn.prop('disabled', false);
        $submitBtn.find('.submit-text').text('Save Changes');
        $submitBtn.find('.spinner-border').addClass('d-none');
    }

    // Enhanced edit review button click handler
    $(document).on('click', '.edit-review-btn', function () {
        const reviewId = $(this).data('review-id');
        const reviewText = decodeURIComponent($(this).data('review-text'));
        const rating = parseInt($(this).data('rating'));

        // Set values in modal
        $('#editReviewId').val(reviewId);
        $('#editReviewText').val(reviewText);
        $('#editRating').val(rating);

        // Clear previous image selection and preview
        $('#editReviewImages').val('');
        $('#editImagePreview').empty();

        // Initialize star rating display
        updateEditRatingDisplay(rating);

        // Show modal
        $('#editReviewModal').modal('show');
    });

    // Clear form when modal is closed
    $('#editReviewModal').on('hidden.bs.modal', function () {
        $('#editReviewForm')[0].reset();
        $('#editImagePreview').empty();
        $('#editRating').val(0);
        updateEditRatingDisplay(0);
    });



    // Soft delete review (mark as deleted)
    $(document).on('click', '.delete-review-btn', function () {
        if (!confirm('Are you sure you want to delete this review? You can restore it later.')) return;
        const reviewId = $(this).data('review-id');
        $.ajax({
            url: `${API_BASE_URL}/api/reviews/delete/${reviewId}`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function (res) {
                loadReviews();
                alert('Review deleted successfully. You can restore it anytime.');
            },
            error: function () {
                alert('Failed to delete review.');
            }
        });
    });

    // Restore review
    $(document).on('click', '.restore-review-btn', function () {
        if (!confirm('Are you sure you want to restore this review?')) return;
        const reviewId = $(this).data('review-id');
        $.ajax({
            url: `${API_BASE_URL}/api/reviews/${reviewId}/restore`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function (res) {
                loadReviews();
                alert('Review restored successfully.');
            },
            error: function () {
                alert('Failed to restore review.');
            }
        });
    });
});

// Global logout function
window.logout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('reviewContext');
    window.location.href = '/login.html';
};