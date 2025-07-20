$(document).ready(function () {
    const API_BASE_URL = 'http://localhost:3000';
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const userDisplayName = localStorage.getItem('userDisplayName') || 'User';
    $('#userDisplayName').text(userDisplayName);

    // ------------------- Load Header & Logout -------------------
    $('#header').load('/header.html', function () {
        if (token && userId) {
            $('#login-link, #register-link').addClass('d-none');
            $('#user-dropdown').removeClass('d-none');
        }

        $('#logoutBtn').click(function () {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.clear();
                window.location.href = '/login.html';
            }
        });
    });

    // ------------------- Review Context -------------------
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

    $('#itemName').val(reviewContext.itemName || 'Unknown Product');

    // ------------------- Photo Upload -------------------
    let selectedFiles = [];
    const MAX_FILES = 5;
    const MAX_SIZE = 5 * 1024 * 1024;

    $('#photoUploadArea')
        .on('click', function (e) {
            if ($(e.target).closest('.photo-remove').length === 0) {
                $('#photoInput').click();
            }
        })
        .on('dragover', function (e) {
            e.preventDefault();
            $(this).addClass('dragover');
        })
        .on('dragleave', function () {
            $(this).removeClass('dragover');
        })
        .on('drop', function (e) {
            e.preventDefault();
            $(this).removeClass('dragover');
            handleFileSelect(e.originalEvent.dataTransfer.files);
        });

    $('#photoInput').on('change', function (e) {
        handleFileSelect(e.target.files);
        $(this).val('');
    });

    function handleFileSelect(files) {
        const remainingSlots = MAX_FILES - selectedFiles.length;

        if (files.length > remainingSlots) {
            showAlert(`You can only upload ${remainingSlots} more photo(s).`);
            return;
        }

        Array.from(files).slice(0, remainingSlots).forEach(file => {
            if (file.size > MAX_SIZE) {
                showAlert(`File "${file.name}" is too large (max 5MB).`);
                return;
            }

            if (!file.type.match('image/(jpeg|png)')) {
                showAlert(`File "${file.name}" is not a supported image type (JPEG/PNG only).`);
                return;
            }

            selectedFiles.push(file);
            displayPhotoPreview(file);
        });

        updatePhotoCount();
    }

    function displayPhotoPreview(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const safeFilename = file.name.replace(/"/g, '&quot;');
            const preview = $(`
                <div class="photo-preview" data-filename="${safeFilename}">
                    <img src="${e.target.result}" alt="Preview">
                    <button class="photo-remove btn btn-danger btn-sm">
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

    // ------------------- Star Rating -------------------
    $('.rating-stars i').on('click', function () {
        const rating = $(this).data('rating');
        updateRatingDisplay(rating);
    }).hover(
        function () {
            const hoverRating = $(this).data('rating');
            $('.rating-stars i').each(function () {
                $(this).toggleClass('fas far', $(this).data('rating') <= hoverRating);
            });
        },
        function () {
            const currentRating = $('#ratingValue').val();
            updateRatingDisplay(currentRating);
        }
    );

    function updateRatingDisplay(rating) {
        $('#ratingValue').val(rating);
        $('#ratingDescription').text(`${rating} out of 5 stars`);
        $('.rating-stars i').each(function () {
            $(this).toggleClass('fas far', $(this).data('rating') <= rating);
        });
    }

   // ------------------- Submit Review -------------------
$('#reviewForm').submit(function (e) {
    e.preventDefault(); // Prevent actual form submission

    const rating = parseInt($('#ratingValue').val());
    const reviewText = $('#reviewText').val().trim();
    let isValid = true;

    if (!rating || rating < 1 || rating > 5) {
        isValid = false;
        showAlert('Please select a rating between 1 and 5 stars.');
    }

    if (reviewText.length < 20) {
        isValid = false;
        $('#reviewText').addClass('is-invalid');
    } else {
        $('#reviewText').removeClass('is-invalid');
    }

    if (!isValid) return;

    const formData = new FormData();
    formData.append('orderinfo_id', reviewContext.orderId);
    formData.append('customer_id', userId);
    formData.append('item_id', reviewContext.itemId);
    formData.append('rating', rating);
    formData.append('review_text', reviewText);
    selectedFiles.forEach(file => formData.append('images', file));

    const $btn = $('#submitReview');
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
        success: function (response) {
            if (response.success) {
                $('#reviewForm').hide();
                $('#thankYouMessage').show();
                localStorage.removeItem('reviewContext');
                $('#viewReviewBtn').show().off('click').on('click', function () {
                    window.location.href = '/myreviews.html';
                });
            } else {
                showAlert(response.message || 'Failed to submit review');
                resetSubmitButton($btn);
            }
        },
        error: function (xhr) {
            console.error('AJAX Error:', xhr);
            const errorMsg = xhr.responseJSON?.message || xhr.statusText || 'Error submitting review';
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
