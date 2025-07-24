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
                message: "Access Denied: You do not have permission to access this page. Only administrators can manage reviews.",
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

    const API_BASE_URL = 'http://localhost:3000';
    let currentViewMode = 'pagination';
    let currentPage = 1;
    let itemsPerPage = 10;
    let allReviews = [];
    let filteredReviews = [];
    let isLoading = false;
    let hasMoreData = true;
    let currentFilter = 'all';

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
            } else if (xhr.status === 500) {
                bootbox.alert({
                    message: "Server error occurred. Please try again later.",
                    callback: function () {
                        window.location.reload();
                    }
                });
            }
        }
    });

    // Helper function to format dates
    function formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
        }
    }

    // Function to generate star rating display
    function generateStarRating(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star text-warning"></i>';
            } else {
                stars += '<i class="far fa-star text-warning"></i>';
            }
        }
        return stars;
    }

    // Function to generate action buttons
    function generateActionButtons(review) {
        if (review.deleted_at) {
            return `
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-success restore-btn" data-id="${review.review_id}" title="Restore">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${review.review_id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
    }

    // Function to fetch reviews based on filter
    function fetchReviews(filter = 'all') {
        isLoading = true;
        $('#loading-spinner').show();

        let endpoint = `${API_BASE_URL}/api/reviews`;

        if (filter === 'deleted') {
            endpoint = `${API_BASE_URL}/api/reviews/deleted`;
        } else if (filter === 'active') {
            endpoint = `${API_BASE_URL}/api/reviews/active`;
        }

        $.ajax({
            url: endpoint,
            method: 'GET',
            dataType: 'json',
            success: function (response) {
                if (response.success) {
                    allReviews = response.data || response.rows || [];
                    filteredReviews = [...allReviews];
                    renderReviews();
                    if (currentViewMode === 'pagination') {
                        setupPagination();
                    }
                } else {
                    console.error('API Error:', response.message);
                    Swal.fire('Error', response.message || 'Failed to fetch reviews', 'error');
                }
            },
            error: function (xhr, status, error) {
                console.error('Error fetching reviews:', error);
                Swal.fire('Error', 'Failed to fetch reviews. Please try again.', 'error');
            },
            complete: function () {
                isLoading = false;
                $('#loading-spinner').hide();
            }
        });
    }

    // Render reviews based on current view mode
    function renderReviews() {
        const tbody = $('#reviewsBody');
        tbody.empty();

        let reviewsToRender = [];
        if (currentViewMode === 'pagination') {
            const startIndex = (currentPage - 1) * itemsPerPage;
            reviewsToRender = filteredReviews.slice(startIndex, startIndex + itemsPerPage);
        } else {
            reviewsToRender = filteredReviews;
        }

        if (reviewsToRender.length === 0) {
            tbody.append('<tr><td colspan="9" class="text-center">No reviews found</td></tr>');
            return;
        }

        reviewsToRender.forEach(review => {
            const row = `
                <tr ${review.deleted_at ? 'class="deleted-row"' : ''} data-customer-id="${review.customer_id}">
                    <td>${review.review_id}</td>
                    <td>${review.orderinfo_id}</td>
                    <td>${review.item_name}</td>
                    <td>${generateStarRating(review.rating)}</td>
                    <td>${review.review_text}</td>
                    <td>${formatDate(review.created_at)}</td>
                    <td>${review.deleted_at ? '<span class="badge badge-danger">Deleted</span>' : '<span class="badge badge-success">Active</span>'}</td>
                    <td>${generateActionButtons(review)}</td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    // Setup pagination
    function setupPagination() {
        const totalPages = Math.ceil(filteredReviews.length / itemsPerPage);
        const pagination = $('#pagination');
        pagination.empty();

        if (totalPages <= 1) return;

        // Previous button
        pagination.append(`
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
            </li>
        `);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            pagination.append(`
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `);
        }

        // Next button
        pagination.append(`
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
            </li>
        `);
    }

    // Handle pagination clicks
    $(document).on('click', '.page-link', function (e) {
        e.preventDefault();
        const page = parseInt($(this).data('page'));
        if (!isNaN(page)) {
            currentPage = page;
            renderReviews();
            $('html, body').animate({ scrollTop: 0 }, 'fast');
        }
    });

    // View mode toggle handler
    $('.view-option').click(function () {
        const viewMode = $(this).data('view');
        if (viewMode !== currentViewMode) {
            currentViewMode = viewMode;
            $('.view-option').removeClass('active');
            $(this).addClass('active');

            // Toggle UI elements
            if (viewMode === 'infinite') {
                $('#pagination-container').hide();
                $('#scroll-info').show();
            } else {
                $('#pagination-container').show();
                $('#scroll-info').hide();
                currentPage = 1;
            }

            renderReviews();
            if (viewMode === 'pagination') {
                setupPagination();
            }
        }
    });

    // Filter button click handler
    $('.filter-btn').click(function () {
        $('.filter-btn').removeClass('active');
        $(this).addClass('active');
        currentFilter = $(this).data('filter');
        fetchReviews(currentFilter);
    });

    // Search functionality
    $('#searchBtn').click(function () {
        performSearch();
    });

    $('#searchInput').keypress(function (e) {
        if (e.which === 13) {
            performSearch();
        }
    });

    function performSearch() {
        const searchTerm = $('#searchInput').val().toLowerCase();
        if (searchTerm) {
            filteredReviews = allReviews.filter(review =>
                (review.customer_first_name && review.customer_first_name.toLowerCase().includes(searchTerm)) ||
                (review.customer_last_name && review.customer_last_name.toLowerCase().includes(searchTerm)) ||
                (review.item_name && review.item_name.toLowerCase().includes(searchTerm)) ||
                (review.review_text && review.review_text.toLowerCase().includes(searchTerm)) ||
                (review.review_id && review.review_id.toString().includes(searchTerm)) ||
                (review.orderinfo_id && review.orderinfo_id.toString().includes(searchTerm)));
        } else {
            filteredReviews = [...allReviews];
        }

        currentPage = 1;
        renderReviews();
        if (currentViewMode === 'pagination') {
            setupPagination();
        }
    }

    // Infinite scroll handler
    $(window).scroll(function () {
        if (currentViewMode !== 'infinite' || isLoading || !hasMoreData) return;

        if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
            $('#loading-spinner').show();
            setTimeout(() => {
                $('#loading-spinner').hide();
            }, 500);
        }
    });

    // Export to Excel
    $('#exportExcel').click(function () {
        const data = filteredReviews.map(review => ({
            'Review ID': review.review_id,
            'Order ID': review.orderinfo_id,
            'Customer': `${review.customer_first_name} ${review.customer_last_name}`,
            'Item': review.item_name,
            'Rating': review.rating,
            'Review': review.review_text,
            'Date': formatDate(review.created_at),
            'Status': review.deleted_at ? 'Deleted' : 'Active'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reviews");
        XLSX.writeFile(wb, "reviews.xlsx");
    });

    // Export to PDF
    $('#exportPdf').click(function () {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const headers = [
            "Review ID",
            "Order ID",
            "Customer",
            "Item",
            "Rating",
            "Review",
            "Date",
            "Status"
        ];

        const data = filteredReviews.map(review => [
            review.review_id,
            review.orderinfo_id,
            `${review.customer_first_name} ${review.customer_last_name}`,
            review.item_name,
            review.rating,
            review.review_text,
            formatDate(review.created_at),
            review.deleted_at ? 'Deleted' : 'Active'
        ]);

        doc.autoTable({
            head: [headers],
            body: data,
            theme: 'grid',
            headStyles: {
                fillColor: [52, 58, 64],
                textColor: 255
            }
        });

        doc.save('reviews.pdf');
    });

    // Delete review with foreign key validation
    $(document).on('click', '.delete-btn', function () {
        const reviewId = $(this).data('id');
        const customerId = $(this).closest('tr').data('customer-id');

        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                // First verify customer exists
                $.ajax({
                    url: `${API_BASE_URL}/api/customers/${customerId}/exists`,
                    method: 'GET',
                    success: function(existsResponse) {
                        if (!existsResponse.exists) {
                            Swal.fire(
                                'Error!',
                                'Cannot delete review - customer no longer exists',
                                'error'
                            );
                            return;
                        }

                        // Proceed with deletion
                        $.ajax({
                            url: `${API_BASE_URL}/api/reviews/${reviewId}`,
                            method: 'DELETE',
                            success: function (response) {
                                if (response.success) {
                                    Swal.fire(
                                        'Deleted!',
                                        'The review has been deleted.',
                                        'success'
                                    );
                                    fetchReviews(currentFilter);
                                } else {
                                    Swal.fire('Error', response.message || 'Failed to delete review', 'error');
                                }
                            },
                            error: function (xhr, status, error) {
                                console.error('Error deleting review:', error);
                                let errorMsg = 'Failed to delete review.';
                                
                                if (xhr.responseJSON && xhr.responseJSON.errorCode === 'FOREIGN_KEY_VIOLATION') {
                                    errorMsg = 'Cannot delete review due to database constraints.';
                                }
                                
                                Swal.fire('Error', errorMsg, 'error');
                            }
                        });
                    },
                    error: function() {
                        Swal.fire('Error', 'Failed to verify customer existence', 'error');
                    }
                });
            }
        });
    });

    // Restore review with foreign key validation
    $(document).on('click', '.restore-btn', function () {
        const reviewId = $(this).data('id');
        const customerId = $(this).closest('tr').data('customer-id');

        Swal.fire({
            title: 'Are you sure?',
            text: "This review will be restored.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, restore it!'
        }).then((result) => {
            if (result.isConfirmed) {
                // First verify customer exists
                $.ajax({
                    url: `${API_BASE_URL}/api/customers/${customerId}/exists`,
                    method: 'GET',
                    success: function(existsResponse) {
                        if (!existsResponse.exists) {
                            Swal.fire(
                                'Error!',
                                'Cannot restore review - customer no longer exists',
                                'error'
                            );
                            return;
                        }

                        // Proceed with restoration
                        $.ajax({
                            url: `${API_BASE_URL}/api/reviews/${reviewId}/restore`,
                            method: 'PATCH',
                            success: function (response) {
                                if (response.success) {
                                    Swal.fire(
                                        'Restored!',
                                        'The review has been restored.',
                                        'success'
                                    );
                                    fetchReviews(currentFilter);
                                } else {
                                    Swal.fire('Error', response.message || 'Failed to restore review', 'error');
                                }
                            },
                            error: function (xhr, status, error) {
                                console.error('Error restoring review:', error);
                                let errorMsg = 'Failed to restore review.';
                                
                                if (xhr.responseJSON && xhr.responseJSON.errorCode === 'FOREIGN_KEY_VIOLATION') {
                                    errorMsg = 'Cannot restore review due to database constraints.';
                                }
                                
                                Swal.fire('Error', errorMsg, 'error');
                            }
                        });
                    },
                    error: function() {
                        Swal.fire('Error', 'Failed to verify customer existence', 'error');
                    }
                });
            }
        });
    });

    // Initial load
    fetchReviews();
});