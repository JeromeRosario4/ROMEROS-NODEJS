$(document).ready(function () {
    const url = 'http://localhost:3000/';
    
    $('#loginForm').on('submit', function (e) {
        e.preventDefault();
        const formData = {
            email: $('input[name="email"]').val().trim(),
            password: $('input[name="password"]').val()
        };

        // Validate inputs
        if (!formData.email || !formData.password) {
            showLoginMessage('❌ Please enter both email and password', 'danger');
            return;
        }

        // Show loading
        showLoginMessage('Authenticating...', 'info');
        $('#loginBtn').prop('disabled', true);
        
        $.ajax({
            url: `${url}api/users/login`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function (res) {
                handleLoginSuccess(res);
            },
            error: function (err) {
                handleLoginError(err);
            },
            complete: function() {
                $('#loginBtn').prop('disabled', false);
            }
        });
    });

    function handleLoginSuccess(res) {
        if (!res.token || !res.user) {
            showLoginMessage('❌ Invalid server response', 'danger');
            return;
        }

        // Check if account is deactivated
        if (res.user.deleted_at) {
            showLoginMessage(`
                <div class="alert alert-danger">
                    ❌ Your account is deactivated. Please contact support.
                </div>
            `);
            return;
        }

        storeUserData(res);
        
        showLoginMessage('✅ Login successful!', 'success');
        
        // Check if user is Admin - redirect immediately for Admin users
        if (res.user.role === 'Admin') {
            setTimeout(() => {
                window.location.href = 'chart.html';
            }, 1500);
        } else {
            setTimeout(() => checkProfileCompletion(res.user.id, res.token), 1500);
        }
    }

    function handleLoginError(err) {
        let errorMsg = '❌ Login failed. Check your credentials.';
        
        if (err.responseJSON && err.responseJSON.message) {
            errorMsg = `❌ ${err.responseJSON.message}`;
        } else if (err.status === 0) {
            errorMsg = '❌ Cannot connect to server. Please check your connection.';
        } else if (err.status === 500) {
            errorMsg = '❌ Server error. Please try again later.';
        }
        
        showLoginMessage(errorMsg, 'danger');
        console.error('Login error:', err);
    }

    function storeUserData(res) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('userId', res.user.id);
        localStorage.setItem('userRole', res.user.role || 'User');
        localStorage.setItem('userEmail', res.user.email);
        
        if (res.user.fname) localStorage.setItem('userFname', res.user.fname);
        if (res.user.lname) localStorage.setItem('userLname', res.user.lname);
    }

    function checkProfileCompletion(userId, token) {
        $.ajax({
            url: `${url}api/users/customers/${userId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(res) {
                if (res.success && res.data) {
                    const profile = res.data;
                    const isProfileComplete = profile.fname && profile.lname && profile.addressline && profile.town;
                    
                    redirectUser(isProfileComplete);
                } else {
                    window.location.href = 'profile.html';
                }
            },
            error: function(err) {
                console.error('Error checking profile:', err);
                window.location.href = 'profile.html';
            }
        });
    }

    function redirectUser(isProfileComplete) {
        if (isProfileComplete) {
            window.location.href = 'home.html';
        } else {
            window.location.href = 'profile.html';
        }
    }

    function showLoginMessage(message, type = 'info') {
        const alertClass = type === 'info' ? 'alert-info' : 
                         type === 'success' ? 'alert-success' : 'alert-danger';
        
        $('#loginMsg').html(`
            <div class="alert ${alertClass}">
                ${message}
            </div>
        `);
    }
});