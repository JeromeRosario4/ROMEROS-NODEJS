        // Initialize header functionality
        $(document).ready(function() {
            // Load user info
            const userDisplayName = localStorage.getItem('userDisplayName') || 'User';
            $('#userDisplayName').text(userDisplayName);
            
            // Your existing JavaScript code goes here
            const API_BASE_URL = 'http://localhost:3000';
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            
            // Get review context with validation
            let reviewContext;
            try {
                reviewContext = JSON.parse(localStorage.getItem('reviewContext'));
                if (!reviewContext || !reviewContext.itemId || !reviewContext.orderId) {
                    throw new Error('Invalid review context');
                }
            } catch (e) {
                showAlertAndRedirect('⛔ Please select an item to review from your orders page.', '/orders.html');
                return;
            }

            // Initialize form
            $('#itemName').val(reviewContext.itemName || 'Unknown Product');
            
            // Photo upload handling
            let selectedFiles = [];
            const MAX_FILES = 5;
            const MAX_SIZE = 5 * 1024 * 1024; // 5MB

            // Setup photo upload area
            $('#photoUploadArea')
                .on('click', function(e) {
                    // Only trigger if not clicking on a child button (like remove)
                    if ($(e.target).closest('.photo-remove').length === 0) {
                        $('#photoInput').click();
                    }
                })
                .on('dragover', function(e) {
                    e.preventDefault();
                    $(this).addClass('dragover');
                })
                .on('dragleave', function() {
                    $(this).removeClass('dragover');
                })
                .on('drop', function(e) {
                    e.preventDefault();
                    $(this).removeClass('dragover');
                    if (e.originalEvent.dataTransfer.files.length) {
                        handleFileSelect(e.originalEvent.dataTransfer.files);
                    }
                });

            $('#photoInput').on('change', function(e) {
                handleFileSelect(e.target.files);
                $(this).val(''); // Reset to allow re-uploading same files
            });

            function handleFileSelect(files) {
                const remainingSlots = MAX_FILES - selectedFiles.length;
                
                if (files.length > remainingSlots) {
                    showAlert(`You can only upload ${remainingSlots} more photo(s).`);
                    return;
                }

                Array.from(files).slice(0, remainingSlots).forEach(file => {
                    if (file.size > MAX_SIZE) {
                        showAlert(`File "${file.name}" is too large (max 5MB)`);
                        return;
                    }

                    if (!file.type.match('image/(jpeg|png)')) {
                        showAlert(`File "${file.name}" is not a supported image type (JPEG/PNG only)`);
                        return;
                    }

                    selectedFiles.push(file);
                    displayPhotoPreview(file);
                });

                updatePhotoCount();
            }

            function displayPhotoPreview(file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const safeFilename = file.name.replace(/"/g, '&quot;');
                    const preview = $(`
                        <div class="photo-preview" data-filename="${safeFilename}">
                            <img src="${e.target.result}" alt="Preview">
                            <button class="photo-remove btn btn-danger btn-sm" 
                                    aria-label="Remove photo">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `);
                    preview.find('.photo-remove').click(() => removePhoto(safeFilename));
                    $('#photoPreview').append(preview);
                };
                reader.readAsDataURL(file);
            }

            function removePhoto(filename) {
                selectedFiles = selectedFiles.filter(f => f.name !== filename);
                $(`.photo-preview[data-filename="${filename}"]`).remove();
                updatePhotoCount();
            }

            function updatePhotoCount() {
                const statusText = `${selectedFiles.length} photo(s) selected. ` + 
                                 (selectedFiles.length < MAX_FILES ? 
                                  `You can add ${MAX_FILES - selectedFiles.length} more.` : 
                                  'Maximum reached.');
                $('#photoUploadArea .upload-status').text(statusText);
            }

            // Star rating
            $('.rating-stars i').on('click', function() {
                const rating = $(this).data('rating');
                updateRatingDisplay(rating);
            }).hover(
                function() {
                    const hoverRating = $(this).data('rating');
                    $('.rating-stars i').each(function() {
                        $(this).toggleClass('fas far', $(this).data('rating') <= hoverRating);
                    });
                },
                function() {
                    const currentRating = $('#ratingValue').val();
                    updateRatingDisplay(currentRating);
                }
            );

            function updateRatingDisplay(rating) {
                $('#ratingValue').val(rating);
                $('#ratingDescription').text(`${rating} out of 5 stars`);
                $('.rating-stars i').each(function() {
                    $(this).toggleClass('fas far', $(this).data('rating') <= rating);
                });
            }

            // Form submission
            $('#submitReview').click(function() {
                const rating = parseInt($('#ratingValue').val());
                const reviewText = $('#reviewText').val().trim();
                let isValid = true;

                // Validate rating
                if (!rating || rating < 1 || rating > 5) {
                    isValid = false;
                    showAlert('Please select a rating between 1 and 5 stars');
                }

                // Validate review text
                if (reviewText.length < 20) {
                    isValid = false;
                    $('#reviewText').addClass('is-invalid');
                } else {
                    $('#reviewText').removeClass('is-invalid');
                }

                if (!isValid) return;

                // Prepare form data
                const formData = new FormData();
                formData.append('orderinfo_id', reviewContext.orderId);
                formData.append('customer_id', userId);
                formData.append('item_id', reviewContext.itemId);
                formData.append('rating', rating);
                formData.append('review_text', reviewText);
                
                // Add files
                selectedFiles.forEach(file => {
                    formData.append('images', file);
                });

                // Submit
                const $btn = $(this);
                $btn.prop('disabled', true);
                $btn.find('.submit-text').text('Submitting...');
                $btn.find('.spinner-border').removeClass('d-none');

                $.ajax({
                    url: `${API_BASE_URL}/api/reviews/create`,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: function(response) {
                        if (response.success) {
                            $('#reviewForm').hide();
                            $('#thankYouMessage').show();
                            localStorage.removeItem('reviewContext');
                            // Show the View Review button and set its click handler
                            $('#viewReviewBtn').show().off('click').on('click', function() {
                                window.location.href = '/myreviews.html';
                            });
                        } else {
                            showAlert(response.message || 'Failed to submit review');
                            resetSubmitButton($btn);
                        }
                    },
                    error: function(xhr) {
                        const errorMsg = xhr.responseJSON?.message || 
                                        xhr.statusText || 
                                        'Error submitting review';
                        showAlert(errorMsg);
                        resetSubmitButton($btn);
                    }
                });
            });

            function resetSubmitButton($btn) {
                $btn.prop('disabled', false);
                $btn.find('.submit-text').text('Submit Review');
                $btn.find('.spinner-border').addClass('d-none');
            }

            function showAlert(message) {
                // Using SweetAlert2 for better alerts
                Swal.fire({
                    title: 'Notification',
                    text: message,
                    icon: 'info',
                    confirmButtonText: 'OK'
                });
            }

            function showAlertAndRedirect(message, url) {
                Swal.fire({
                    title: 'Notification',
                    text: message,
                    icon: 'warning',
                    confirmButtonText: 'OK'
                }).then(() => {
                    window.location.href = url;
                });
            }
        });

        // Logout function
        function logout() {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('userDisplayName');
                localStorage.removeItem('reviewContext');
                window.location.href = '/login.html';
            }
        }
        $('#header').load('/header.html', function() {
            // Optionally, you can run code here after header loads
            // For example, show/hide login/register links based on token
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            if (token && userId) {
                $('#login-link, #register-link').addClass('d-none');
                $('#user-dropdown').removeClass('d-none');
            }
        });