$(document).ready(function () {
    const API_BASE_URL = 'http://localhost:3000/';
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    // Enhanced authentication check
    if (!token || !userId) {
        Swal.fire({
            title: 'Access Denied',
            text: 'You must be logged in to view this page',
            icon: 'warning',
            confirmButtonText: 'Go to Login',
            allowOutsideClick: false,
            allowEscapeKey: false
        }).then(() => {
            // Clear any existing user data
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            sessionStorage.clear();
            window.location.href = '/login.html';
        });
        return;
    }

    // Initialize header with user-specific data
    function initHeader() {
        $('#header').load('/header.html', function (response, status, xhr) {
            if (status === "error") {
                console.error("Failed to load header:", xhr.status, xhr.statusText);
                return;
            }

            // Initialize dropdowns
            const dropdowns = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
            dropdowns.forEach(el => new bootstrap.Dropdown(el));

            // Update UI based on authentication
            $('#login-link, #register-link').addClass('d-none');
            $('#user-dropdown').removeClass('d-none');

            // Load user-specific data for header
            loadHeaderProfile();
        });
    }

    // Load user profile data for header
    function loadHeaderProfile() {
        $.ajax({
            url: `${API_BASE_URL}api/users/customers/${userId}`,
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            success: function(res) {
                if (res.success && res.data) {
                    const data = res.data;
                    const fullName = `${data.fname || ''} ${data.lname || ''}`.trim();
                    $('#username').text(fullName || 'USER');
                    
                    // Only update image if it exists and belongs to this user
                    if (data.image_path && data.userId === userId) {
                        $('.profile-img').attr('src', `/${data.image_path}`);
                    }
                }
            },
            error: function(err) {
                console.error('Error loading user data:', err);
                // Don't show error to user for header load
            }
        });
    }

    // Load profile data with proper isolation
    function fetchProfileData() {
        $.ajax({
            url: `${API_BASE_URL}api/users/customers/${userId}`,
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            success: function(res) {
                if (res.success && res.data) {
                    const data = res.data;
                    
                    // Verify the data belongs to the current user
                    if (data.userId !== userId) {
                        console.error('Data does not belong to current user');
                        showProfileError('Invalid profile data');
                        return;
                    }

                    // Populate form fields
                    $('#userId').val(userId);
                    $('#title').val(data.title || '');
                    $('#fname').val(data.fname || '');
                    $('#lname').val(data.lname || '');
                    $('#addressline').val(data.addressline || '');
                    $('#town').val(data.town || '');
                    $('#phone').val(data.phone || '');
                    
                    // Only set image if it exists and belongs to this user
                    if (data.image_path) {
                        $('#profileImagePreview').attr('src', `/${data.image_path}`);
                    }
                } else {
                    showProfileError(res.message || 'Failed to load profile');
                }
            },
            error: function(err) {
                console.error('Error fetching profile:', err);
                showProfileError('Failed to load profile data');
                
                // If unauthorized, redirect to login
                if (err.status === 401) {
                    handleUnauthorized();
                }
            }
        });
    }

    // Handle image preview with validation
    $('#image').on('change', function() {
        const file = this.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            showProfileError('Only JPG, PNG or GIF images are allowed');
            this.value = '';
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showProfileError('Image must be less than 5MB');
            this.value = '';
            return;
        }

        // Preview image
        const reader = new FileReader();
        reader.onload = function(e) {
            $('#profileImagePreview').attr('src', e.target.result);
        };
        reader.readAsDataURL(file);
    });

    // Handle form submission with enhanced security
    $('#profileForm').on('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        formData.append('userId', userId);

        // Show loading state
        const submitBtn = $('#profileForm button[type="submit"]');
        const originalText = submitBtn.html();
        submitBtn.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...');
        submitBtn.prop('disabled', true);

        $.ajax({
            url: `${API_BASE_URL}api/users/update-profile`,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            data: formData,
            contentType: false,
            processData: false,
            success: function(res) {
                submitBtn.html(originalText);
                submitBtn.prop('disabled', false);
                
                if (res.success) {
                    Swal.fire({
                        title: 'Success!',
                        text: 'Profile updated successfully',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    
                    // Refresh profile data
                    fetchProfileData();
                    
                    // Update header if image changed
                    if ($('#image')[0].files[0]) {
                        $('.profile-img').attr('src', $('#profileImagePreview').attr('src'));
                    }
                } else {
                    showProfileError(res.message || 'Update failed');
                }
            },
            error: function(err) {
                submitBtn.html(originalText);
                submitBtn.prop('disabled', false);
                
                console.error('Update error:', err);
                if (err.status === 401) {
                    handleUnauthorized();
                } else {
                    showProfileError(err.responseJSON?.message || 'Error updating profile');
                }
            }
        });
    });

    // Enhanced deactivation handler
    $('#deactivateBtn').on('click', function() {
        Swal.fire({
            title: 'Confirm Deactivation',
            html: `
                <p>This will permanently deactivate your account. All your data will be removed.</p>
                <p>To confirm, please enter your password:</p>
                <input type="password" id="deactivatePassword" class="swal2-input" placeholder="Your Password">
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Deactivate',
            cancelButtonText: 'Cancel',
            focusConfirm: false,
            allowOutsideClick: false,
            preConfirm: () => {
                const password = Swal.getPopup().querySelector('#deactivatePassword').value;
                if (!password) {
                    Swal.showValidationMessage('Password is required');
                    return false;
                }
                return { password: password };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const password = result.value.password;
                
                Swal.fire({
                    title: 'Processing...',
                    html: 'Deactivating your account',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                        
                        $.ajax({
                            url: `${API_BASE_URL}api/users/deactivate`,
                            method: 'POST',
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            data: JSON.stringify({
                                userId: userId,
                                password: password
                            }),
                            success: function(res) {
                                if (res.success) {
                                    // Clear all user data
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    
                                    Swal.fire({
                                        title: 'Account Deactivated',
                                        text: 'Your account has been deactivated successfully. You will be redirected to the home page.',
                                        icon: 'success',
                                        timer: 3000,
                                        showConfirmButton: false
                                    }).then(() => {
                                        window.location.href = '/';
                                    });
                                } else {
                                    Swal.fire({
                                        title: 'Error',
                                        text: res.message || 'Deactivation failed',
                                        icon: 'error'
                                    });
                                }
                            },
                            error: function(err) {
                                Swal.fire({
                                    title: 'Error',
                                    text: err.responseJSON?.message || 'Deactivation failed',
                                    icon: 'error'
                                });
                            }
                        });
                    }
                });
            }
        });
    });

    // Helper function to show profile errors
    function showProfileError(message) {
        const msgEl = $('#profileMsg');
        msgEl.removeClass('alert-success').addClass('alert-danger')
             .text(message).fadeIn();
        setTimeout(() => msgEl.fadeOut(), 5000);
    }

    // Handle unauthorized access
    function handleUnauthorized() {
        Swal.fire({
            title: 'Session Expired',
            text: 'Your session has expired. Please log in again.',
            icon: 'warning',
            confirmButtonText: 'Login',
            allowOutsideClick: false
        }).then(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            window.location.href = '/login.html';
        });
    }

    // Initialize everything
    initHeader();
    fetchProfileData();
});