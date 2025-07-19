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
        message: "Access Denied: You do not have permission to access this page. Only administrators can manage orders.",
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
  let allOrders = [];
  let filteredOrders = [];
  let isLoading = false;
  let hasMoreData = true;

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

  // Helper function to format dates
  function formatDate(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }

  // Helper function to get status badge
  function getStatusBadge(status) {
    let badgeClass = 'badge-secondary';
    if (status === 'Shipped') badgeClass = 'badge-primary';
    if (status === 'Delivered') badgeClass = 'badge-success';
    if (status === 'Cancelled') badgeClass = 'badge-danger';
    if (status === 'Pending') badgeClass = 'badge-warning';

    return `<span class="badge ${badgeClass}">${status || 'Unknown'}</span>`;
  }

  // Load all orders
  function loadOrders() {
    isLoading = true;
    $('#loading-spinner').show();

    $.get(`${API_BASE_URL}/api/orders/admin`, function (res) {
      if (res.data) {
        // Filter out deleted orders for main table
        allOrders = res.data.filter(order => !order.deleted_at);
        filteredOrders = [...allOrders];
        renderOrders();
        if (currentViewMode === 'pagination') {
          setupPagination();
        }
      }
    }).fail(function(jqXHR, textStatus, errorThrown) {
      console.error("Error loading orders:", textStatus, errorThrown);
      bootbox.alert({
        message: "Failed to load orders. Please try again.",
        callback: function() {
          window.location.reload();
        }
      });
    }).always(function () {
      isLoading = false;
      $('#loading-spinner').hide();
    });
  }

  // Render orders based on current view mode
  function renderOrders() {
    const tbody = $('#obody');
    tbody.empty();

    let ordersToRender = [];
    if (currentViewMode === 'pagination') {
      const startIndex = (currentPage - 1) * itemsPerPage;
      ordersToRender = filteredOrders.slice(startIndex, startIndex + itemsPerPage);
    } else {
      ordersToRender = filteredOrders;
    }

    if (ordersToRender.length === 0) {
      tbody.append('<tr><td colspan="8" class="text-center">No orders found</td></tr>');
      return;
    }

    ordersToRender.forEach(order => {
      const row = `
          <tr>
            <td>${order.orderinfo_id}</td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>${order.date_placed ? formatDate(order.date_placed) : 'N/A'}</td>
            <td>${order.date_shipped ? formatDate(order.date_shipped) : 'Not shipped'}</td>
            <td>${order.date_delivered ? formatDate(order.date_delivered) : 'Not delivered'}</td>
            <td>${order.shipping_method || 'N/A'}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td class="action-buttons">
              <div class="btn-group" role="group">
                <button class="btn btn-sm btn-primary view-order" data-id="${order.orderinfo_id}">
                  <i class="fas fa-eye"></i> View
                </button>
                <button class="btn btn-sm btn-warning edit-order" data-id="${order.orderinfo_id}">
                  <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger delete-order" data-id="${order.orderinfo_id}">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      tbody.append(row);
    });
  }

  // Setup pagination
  function setupPagination() {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
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
      renderOrders();
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

      renderOrders();
      if (viewMode === 'pagination') {
        setupPagination();
      }
    }
  });

  // Search functionality
  $('#searchButton').click(function () {
    performSearch();
  });

  $('#orderSearch').keypress(function (e) {
    if (e.which === 13) {
      performSearch();
    }
  });

  function performSearch() {
    const searchTerm = $('#orderSearch').val().toLowerCase();
    if (searchTerm) {
      filteredOrders = allOrders.filter(order =>
        (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm)) ||
        (order.orderinfo_id && order.orderinfo_id.toString().includes(searchTerm)) ||
        (order.shipping_method && order.shipping_method.toLowerCase().includes(searchTerm)) ||
        (order.status && order.status.toLowerCase().includes(searchTerm)));
    } else {
      filteredOrders = [...allOrders];
    }

    currentPage = 1;
    renderOrders();
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
    const ws = XLSX.utils.json_to_sheet(filteredOrders.map(order => ({
      'Order ID': order.orderinfo_id,
      'Customer': order.customer_name,
      'Date Placed': order.date_placed ? formatDate(order.date_placed) : 'N/A',
      'Date Shipped': order.date_shipped ? formatDate(order.date_shipped) : 'Not shipped',
      'Date Delivered': order.date_delivered ? formatDate(order.date_delivered) : 'Not delivered',
      'Shipping Method': order.shipping_method || 'N/A',
      'Status': order.status
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, "orders.xlsx");
  });

  // Export to PDF
  $('#exportPdf').click(function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const headers = [
      "Order ID",
      "Customer",
      "Date Placed",
      "Date Shipped",
      "Date Delivered",
      "Shipping Method",
      "Status"
    ];

    const data = filteredOrders.map(order => [
      order.orderinfo_id,
      order.customer_name,
      order.date_placed ? formatDate(order.date_placed) : 'N/A',
      order.date_shipped ? formatDate(order.date_shipped) : 'Not shipped',
      order.date_delivered ? formatDate(order.date_delivered) : 'Not delivered',
      order.shipping_method || 'N/A',
      order.status
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

    doc.save('orders.pdf');
  });

  // Show archive modal
  $('#showArchiveBtn').click(function () {
    showArchiveModal();
  });

  // Function to show archive modal
  function showArchiveModal() {
    $('#loading-spinner').show();

    $.get(`${API_BASE_URL}/api/orders/admin`, function (res) {
      if (res.data) {
        // Filter to show only deleted orders
        const archivedOrders = res.data.filter(order => order.deleted_at);

        // Populate archive table
        const archiveBody = $('#archiveBody');
        archiveBody.empty();

        if (archivedOrders.length === 0) {
          archiveBody.append('<tr><td colspan="9" class="text-center">No archived orders found</td></tr>');
        } else {
          archivedOrders.forEach(order => {
            const row = `
                <tr>
                  <td>${order.orderinfo_id}</td>
                  <td>${order.customer_name || 'N/A'}</td>
                  <td>${order.date_placed ? formatDate(order.date_placed) : 'N/A'}</td>
                  <td>${order.date_shipped ? formatDate(order.date_shipped) : 'Not shipped'}</td>
                  <td>${order.date_delivered ? formatDate(order.date_delivered) : 'Not delivered'}</td>
                  <td>${order.shipping_method || 'N/A'}</td>
                  <td>${getStatusBadge(order.status)}</td>
                  <td>${order.deleted_at ? formatDate(order.deleted_at) : 'N/A'}</td>
                  <td class="action-buttons">
                    <div class="btn-group" role="group">
                      <button class="btn btn-sm btn-primary view-order" data-id="${order.orderinfo_id}">
                        <i class="fas fa-eye"></i> View
                      </button>
                      <button class="btn btn-sm btn-success restore-order" data-id="${order.orderinfo_id}">
                        <i class="fas fa-undo"></i> Restore
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            archiveBody.append(row);
          });
        }

        $('#archiveModal').modal('show');
      }
    }).always(function () {
      $('#loading-spinner').hide();
    });
  }

  // View order details
  $(document).on('click', '.view-order', async function () {
    const orderId = $(this).data('id');
    const token = localStorage.getItem('token');

    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Please log in again',
      }).then(() => {
        window.location.href = 'login.html';
      });
      return;
    }

    if (!orderId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Order ID not found'
      });
      return;
    }

    try {
      Swal.fire({
        title: 'Loading...',
        text: 'Fetching order details',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await fetch(`${API_BASE_URL}/api/orders/admin/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }

      const responseData = await response.json();
      Swal.close();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || 'Failed to fetch order details');
      }

      // Populate order details modal
      const order = responseData.data;
      $('#modal-order-id').text(order.orderinfo_id || 'N/A');
      $('#modal-customer-name').text(order.customer_name || 'N/A');
      $('#modal-status').html(getStatusBadge(order.status));
      $('#modal-date-placed').text(order.date_placed ? formatDate(order.date_placed) : 'N/A');
      $('#modal-date-shipped').text(order.date_shipped ? formatDate(order.date_shipped) : 'Not shipped');
      $('#modal-date-delivered').text(order.date_delivered ? formatDate(order.date_delivered) : 'Not delivered');
      $('#modal-shipping-method').text(order.shipping_method || 'N/A');

      // Calculate totals
      const subtotal = parseFloat(order.subtotal || 0);
      const shippingRate = parseFloat(order.shipping_rate || 0);
      const total = subtotal + shippingRate;

      $('#modal-shipping-rate').text(`₱${shippingRate.toFixed(2)}`);
      $('#modal-subtotal').text(`₱${subtotal.toFixed(2)}`);
      $('#modal-total').text(`₱${total.toFixed(2)}`);

      // Populate items
      const itemsBody = $('#modal-items-tbody');
      itemsBody.empty();

      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          const row = `
              <tr>
                <td>${item.item_name || 'N/A'}</td>
                <td>${item.quantity || 0}</td>
                <td>₱${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                <td>₱${parseFloat(item.total_price || 0).toFixed(2)}</td>
              </tr>
            `;
          itemsBody.append(row);
        });
      } else {
        itemsBody.append('<tr><td colspan="4" class="text-center">No items found</td></tr>');
      }

      $('#orderDetailsModal').modal('show');
    } catch (error) {
      Swal.close();
      console.error('Error viewing order:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to load order details'
      });
      
      if (error.message.includes('Session expired')) {
        localStorage.clear();
        window.location.href = 'login.html';
      }
    }
  });

  // Edit order status
  $(document).on('click', '.edit-order', async function () {
    const orderId = $(this).data('id');
    const token = localStorage.getItem('token');

    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Please log in again',
      }).then(() => {
        window.location.href = 'login.html';
      });
      return;
    }

    if (!orderId) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Order ID not found'
      });
      return;
    }

    try {
      Swal.fire({
        title: 'Loading...',
        text: 'Fetching order details',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await fetch(`${API_BASE_URL}/api/orders/admin/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }

      const responseData = await response.json();
      Swal.close();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || 'Failed to fetch order details');
      }

      const currentStatus = responseData.data.status;

      // Restrict editing for Delivered or Cancelled
      if (currentStatus === 'Delivered' || currentStatus === 'Cancelled') {
        Swal.fire({
          icon: 'warning',
          title: 'Not Allowed',
          text: `You cannot edit an order that is ${currentStatus}.`
        });
        return;
      }

      $('#editOrderModal #status').val(currentStatus);
      $('#updateStatusButton').data('id', orderId);
      $('#updateStatusButton').data('current-status', currentStatus);
      $('#editOrderModal').modal('show');
    } catch (error) {
      Swal.close();
      console.error('Error editing order:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to load order details'
      });
      
      if (error.message.includes('Session expired')) {
        localStorage.clear();
        window.location.href = 'login.html';
      }
    }
  });

  // Update order status
  $('#updateStatusButton').click(async function () {
    const orderId = $(this).data('id');
    const currentStatus = $(this).data('current-status');
    const newStatus = $('#editOrderModal #status').val();
    const token = localStorage.getItem('token');

    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Please log in again',
      }).then(() => {
        window.location.href = 'login.html';
      });
      return;
    }

    if (!orderId || !newStatus) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Order ID and new status are required'
      });
      return;
    }

    // Prevent changing to 'Cancelled' if current status is 'Shipped'
    if (currentStatus === 'Shipped' && newStatus === 'Cancelled') {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Action',
        text: 'You cannot cancel an order that has already been shipped.'
      });
      return;
    }

    try {
      Swal.fire({
        title: 'Updating...',
        text: 'Updating order status',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }

      const responseData = await response.json();
      Swal.close();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || 'Failed to update order status');
      }

      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Order status updated successfully'
      });

      $('#editOrderModal').modal('hide');
      loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to update order status'
      });
      
      if (error.message.includes('Session expired')) {
        localStorage.clear();
        window.location.href = 'login.html';
      }
    }
  });

  // Delete order (soft delete)
  $(document).on('click', '.delete-order', function () {
    const orderId = $(this).data('id');
    const token = localStorage.getItem('token');

    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Please log in again',
      }).then(() => {
        window.location.href = 'login.html';
      });
      return;
    }

    Swal.fire({
      title: 'Delete Order?',
      text: 'This will mark the order as deleted (soft delete).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then(function (result) {
      if (!result.isConfirmed) return;

      fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
        .then(function (response) {
          if (response.status === 401) {
            throw new Error('Session expired. Please log in again.');
          }
          return response.json().then(function (data) {
            if (!response.ok || !data.success) {
              throw new Error(data.message || 'Failed to delete order.');
            }

            Swal.fire('Deleted!', 'The order has been marked as deleted.', 'success');
            loadOrders();
          });
        })
        .catch(function (err) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message || 'Something went wrong.'
          });
          
          if (err.message.includes('Session expired')) {
            localStorage.clear();
            window.location.href = 'login.html';
          }
        });
    });
  });

  // Restore order
  $(document).on('click', '.restore-order', function () {
    const orderId = $(this).data('id');
    const token = localStorage.getItem('token');

    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Session Expired',
        text: 'Please log in again',
      }).then(() => {
        window.location.href = 'login.html';
      });
      return;
    }

    Swal.fire({
      title: 'Restore Order?',
      text: 'This will restore the previously deleted order.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, restore it!',
      cancelButtonText: 'Cancel'
    }).then(function (result) {
      if (!result.isConfirmed) return;

      fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/restore`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
        .then(function (response) {
          if (response.status === 401) {
            throw new Error('Session expired. Please log in again.');
          }
          return response.json().then(function (data) {
            if (!response.ok || !data.success) {
              throw new Error(data.message || 'Failed to restore order.');
            }

            Swal.fire('Restored!', 'The order has been restored successfully.', 'success');
            loadOrders();
            $('#archiveModal').modal('hide');
          });
        })
        .catch(function (err) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err.message || 'Something went wrong.'
          });
          
          if (err.message.includes('Session expired')) {
            localStorage.clear();
            window.location.href = 'login.html';
          }
        });
    });
  });

  // Initial load
  loadOrders();
});