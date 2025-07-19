$(document).ready(function () {
    // Check if user is authorized to access this page
    function checkAdminAccess() {
        const userRole = localStorage.getItem('userRole');
        const token = localStorage.getItem('token');

        // If no token, redirect to login
        if (!token) {
            bootbox.alert({
                message: "Please log in to access this page.",
                callback: function () {
                    window.location.href = 'login.html';
                }
            });
            return false;
        }

        // If user is not Admin, show error and redirect
        if (userRole !== 'Admin') {
            bootbox.alert({
                message: "Access Denied: You do not have permission to access this page. Only administrators can manage users.",
                callback: function () {
                    window.location.href = 'home.html';
                }
            });
            return false;
        }

        return true;
    }

    // Check access before initializing the page
    if (!checkAdminAccess()) {
        return;
    }
    const url = 'http://localhost:3000/';
    let currentPage = 1;
    let totalPages = 1;
    let isLoading = false;
    let currentViewType = 'pagination';
    let searchQuery = '';
    let allUsers = [];

    // Add authorization header to all AJAX requests
    $.ajaxSetup({
        beforeSend: function (xhr) {
            const token = localStorage.getItem('token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
        },
        error: function (xhr, status, error) {
            // Handle unauthorized access
            if (xhr.status === 401) {
                bootbox.alert({
                    message: "Your session has expired. Please log in again.",
                    callback: function () {
                        localStorage.clear();
                        window.location.href = 'login.html';
                    }
                });
            } else if (xhr.status === 403) {
                bootbox.alert({
                    message: "Access Denied: You do not have permission to perform this action.",
                    callback: function () {
                        window.location.href = 'home.html';
                    }
                });
            }
        }
    });

    init();

    // View type change handler
    $('#viewType').change(function () {
        currentViewType = $(this).val();
        currentPage = 1;
        loadUsers();
        updateViewTypeUI();
    });

    function updateViewTypeUI() {
        if (currentViewType === 'pagination') {
            $('#paginationContainer').show();
            $('#loadingSpinner').hide();
            $('#scrollInfo').hide();
        } else {
            $('#paginationContainer').hide();
            $('#scrollInfo').show();
        }
    }

    function init() {
        loadUsers();
        updateViewTypeUI();

        // Set up infinite scroll if selected
        $(window).scroll(function () {
            if (currentViewType === 'infinite' && !isLoading && currentPage < totalPages) {
                if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
                    loadMoreUsers();
                }
            }
        });
    }

    function loadUsers() {
        isLoading = true;
        $('#loadingSpinner').show();
        $('#ubody').html('');

        $.ajax({
            url: `${url}api/users/users`,
            method: 'GET',
            data: {
                page: currentPage,
                search: searchQuery
            },
            dataType: 'json',
            success: function (response) {
                allUsers = response.rows || [];
                totalPages = response.totalPages || 1;

                renderUsers(allUsers);
                if (currentViewType === 'pagination') {
                    renderPagination();
                }
            },
            error: function (xhr, status, error) {
                console.error('Error loading users:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: 'Failed to load user data.',
                });
            },
            complete: function () {
                isLoading = false;
                $('#loadingSpinner').hide();
            }
        });
    }

    function loadMoreUsers() {
        if (isLoading || currentPage >= totalPages) return;

        isLoading = true;
        currentPage++;
        $('#loadingSpinner').show();
        $('#scrollInfo').text('Loading more users...');

        $.ajax({
            url: `${url}api/users/users`,
            method: 'GET',
            data: {
                page: currentPage,
                search: searchQuery
            },
            dataType: 'json',
            success: function (response) {
                const newUsers = response.rows || [];
                allUsers = [...allUsers, ...newUsers];
                renderUsers(newUsers);
                totalPages = response.totalPages || 1;
            },
            error: function (xhr, status, error) {
                console.error('Error loading more users:', error);
                currentPage--; // Revert page increment on error
            },
            complete: function () {
                isLoading = false;
                $('#loadingSpinner').hide();
                if (currentPage < totalPages) {
                    $('#scrollInfo').text('Scroll to load more users');
                } else {
                    $('#scrollInfo').text('All users loaded');
                    setTimeout(() => $('#scrollInfo').fadeOut(), 2000);
                }
            }
        });
    }

    function renderUsers(users) {
        const $tbody = $('#ubody');

        if (users.length === 0) {
            $tbody.html('<tr><td colspan="9" class="text-center">No users found</td></tr>');
            return;
        }

        users.forEach(user => {
            const roleClass = `role-${user.role.toLowerCase()}`;
            const statusClass = `status-${user.status.toLowerCase()}`;

            const $row = $(`
          <tr data-id="${user.id}">
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.addressline || ''}</td>
            <td>${user.town || ''}</td>
            <td>${user.phone || ''}</td>
            <td><span class="role-badge ${roleClass}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></td>
            <td><span class="status-badge ${statusClass}">${user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span></td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-sm btn-warning roleBtn" data-id="${user.id}" title="Change Role">
                  <i class="fas fa-user-tag"></i>
                </button>
                <button class="btn btn-sm btn-secondary statusBtn" data-id="${user.id}" title="Change Status">
                  <i class="fas fa-toggle-on"></i>
                </button>
              </div>
            </td>
          </tr>
        `);

            $tbody.append($row);
        });
    }

    function renderPagination() {
        const $pagination = $('#pagination');
        $pagination.empty();

        // Previous button
        const prevDisabled = currentPage <= 1 ? 'disabled' : '';
        $pagination.append(`
        <li class="page-item ${prevDisabled}">
          <a class="page-link" href="#" aria-label="Previous" data-page="${currentPage - 1}">
            <span aria-hidden="true">&laquo;</span>
          </a>
        </li>
      `);

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            $pagination.append('<li class="page-item disabled"><a class="page-link" href="#">...</a></li>');
        }

        for (let i = startPage; i <= endPage; i++) {
            const active = i === currentPage ? 'active' : '';
            $pagination.append(`
          <li class="page-item ${active}">
            <a class="page-link" href="#" data-page="${i}">${i}</a>
          </li>
        `);
        }

        if (endPage < totalPages) {
            $pagination.append('<li class="page-item disabled"><a class="page-link" href="#">...</a></li>');
        }

        // Next button
        const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
        $pagination.append(`
        <li class="page-item ${nextDisabled}">
          <a class="page-link" href="#" aria-label="Next" data-page="${currentPage + 1}">
            <span aria-hidden="true">&raquo;</span>
          </a>
        </li>
      `);

        // Page click handler
        $pagination.on('click', 'a.page-link', function (e) {
            e.preventDefault();
            const page = $(this).data('page');
            if (page && page !== currentPage) {
                currentPage = page;
                loadUsers();
            }
        });
    }

    // Search functionality
    $('#searchButton').click(function () {
        searchQuery = $('#userSearch').val();
        currentPage = 1;
        loadUsers();
    });

    $('#userSearch').keypress(function (e) {
        if (e.which === 13) { // Enter key
            searchQuery = $(this).val();
            currentPage = 1;
            loadUsers();
        }
    });

    // Add new admin form submission
    $('#addUserForm').submit(function (e) {
        e.preventDefault();

        // Validate form
        if (!this.checkValidity()) {
            e.stopPropagation();
            this.classList.add('was-validated');
            return;
        }

        // Validate password length
        const password = $('#add_password').val();
        if (password.length < 8) {
            $('#add_password').addClass('is-invalid');
            $('#add_password').next('.invalid-feedback').remove();
            $('#add_password').after(`<div class="invalid-feedback">Password must be at least 8 characters long</div>`);
            return;
        }

        const adminData = {
            name: $('#add_name').val(),
            email: $('#add_email').val(),
            password: password,
            role: 'Admin'
        };

        Swal.fire({
            title: 'Creating Admin...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        $.ajax({
            method: "POST",
            url: `${url}api/users/create-admin`,
            data: JSON.stringify(adminData),
            contentType: 'application/json',
            dataType: "json",
            success: function (data) {
                $("#userModal").modal("hide");
                $('#addUserForm')[0].reset();
                $('#addUserForm').removeClass('was-validated');
                currentPage = 1;
                loadUsers();

                Swal.fire({
                    icon: 'success',
                    title: 'Admin Added!',
                    text: 'New admin has been added successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            },
            error: function (xhr) {
                let errorMsg = 'Failed to add admin. Please try again.';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMsg = xhr.responseJSON.error;
                    // Special handling for duplicate email
                    if (xhr.responseJSON.error.includes('email')) {
                        $('#add_email').addClass('is-invalid');
                        $('#add_email').next('.invalid-feedback').remove();
                        $('#add_email').after(`<div class="invalid-feedback">${errorMsg}</div>`);
                    }
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: errorMsg,
                });
            }
        });
    });

    // Clear validation errors when modal is hidden
    $('#userModal').on('hidden.bs.modal', function () {
        $('#addUserForm')[0].reset();
        $('#addUserForm').removeClass('was-validated');
        $('.is-invalid').removeClass('is-invalid');
        $('.invalid-feedback').remove();
    });

    // Change role button click handler
    $('#ubody').on('click', '.roleBtn', function (e) {
        e.preventDefault();
        const id = $(this).data('id');
        $('#role_user_id').val(id);
        $('#roleModal').modal('show');
    });

    // Submit role change
    $("#roleSubmit").on('click', function (e) {
        e.preventDefault();

        const userId = $('#role_user_id').val();
        const newRole = $('#new_role').val();

        if (!newRole) {
            $('#roleForm')[0].reportValidity();
            return;
        }

        Swal.fire({
            title: 'Updating Role...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        $.ajax({
            method: "PUT",
            url: `${url}api/users/users/${userId}/role`,
            data: JSON.stringify({ role: newRole }),
            contentType: 'application/json',
            dataType: "json",
            success: function (data) {
                $('#roleModal').modal("hide");
                loadUsers();

                Swal.fire({
                    icon: 'success',
                    title: 'Role Updated!',
                    text: 'User role has been updated successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            },
            error: function (xhr) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: xhr.responseJSON?.error || 'Failed to update role. Please try again.',
                });
            }
        });
    });

    // Change status button click handler
    $('#ubody').on('click', '.statusBtn', function (e) {
        e.preventDefault();
        const id = $(this).data('id');
        $('#status_user_id').val(id);
        $('#statusModal').modal('show');
    });

    // Submit status change
    $("#statusSubmit").on('click', function (e) {
        e.preventDefault();

        const userId = $('#status_user_id').val();
        const newStatus = $('#new_status').val();

        if (!newStatus) {
            $('#statusForm')[0].reportValidity();
            return;
        }

        Swal.fire({
            title: 'Updating Status...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        $.ajax({
            method: "PUT",
            url: `${url}api/users/users/${userId}/status`,
            data: JSON.stringify({ status: newStatus }),
            contentType: 'application/json',
            dataType: "json",
            success: function (data) {
                $('#statusModal').modal("hide");
                loadUsers();

                Swal.fire({
                    icon: 'success',
                    title: 'Status Updated!',
                    text: 'User status has been updated successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            },
            error: function (xhr) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: xhr.responseJSON?.error || 'Failed to update status. Please try again.',
                });
            }
        });
    });

    // Reset forms when modals are hidden
    $('#userModal').on('hidden.bs.modal', function () {
        $('#addUserForm')[0].reset();
    });

    $('#roleModal').on('hidden.bs.modal', function () {
        $('#roleForm')[0].reset();
    });

    $('#statusModal').on('hidden.bs.modal', function () {
        $('#statusForm')[0].reset();
    });
});