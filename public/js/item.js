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
        message: "Access Denied: You do not have permission to access this page. Only administrators can manage items.",
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

  const baseUrl = 'http://localhost:3000/api/item/admin';
  const categoryUrl = 'http://localhost:3000/api/category';
  const imageBaseUrl = 'http://localhost:3000/images/';
  let currentViewMode = 'pagination';
  let currentPage = 1;
  let itemsPerPage = 10;
  let allItems = [];
  let filteredItems = [];
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

  // Load categories
  $.get(categoryUrl, function (res) {
    if (res.success) {
      $('#category').empty();
      res.data.forEach(cat => {
        $('#category').append(`<option value="${cat.category_id}">${cat.description}</option>`);
      });
    }
  });

  // Load all items
  function loadItems() {
    isLoading = true;
    $('#loading-spinner').show();

    $.get(baseUrl, function (res) {
      if (res.data) {
        allItems = res.data;
        filteredItems = [...allItems];
        renderItems();
        if (currentViewMode === 'pagination') {
          setupPagination();
        }
      }
    }).always(function () {
      isLoading = false;
      $('#loading-spinner').hide();
    });
  }

  // Render items based on current view mode
  function renderItems() {
    const tbody = $('#ibody');
    tbody.empty();

    let itemsToRender = [];
    if (currentViewMode === 'pagination') {
      const startIndex = (currentPage - 1) * itemsPerPage;
      itemsToRender = filteredItems.slice(startIndex, startIndex + itemsPerPage);
    } else {
      // For infinite scroll, show all loaded items
      itemsToRender = filteredItems;
    }

    if (itemsToRender.length === 0) {
      tbody.append('<tr><td colspan="9" class="text-center">No items found</td></tr>');
      return;
    }

    itemsToRender.forEach(item => {
      const images = item.all_images ? [...new Set(item.all_images)] : [];
      const imageHtml = images.length > 0
        ? images.map(img => `<img src="${imageBaseUrl}${img}" width="40" height="40" class="mr-1 mb-1" onerror="this.src='${imageBaseUrl}placeholder.jpg'; this.onerror=null;"/>`).join('')
        : 'No Image';

      const actions = item.deleted_at
        ? `<a href="#" class="restoreBtn ml-2" data-id="${item.item_id}">
             <i class="fas fa-undo text-success" style="font-size: 20px;"></i>
           </a>`
        : `<a href="#" class="editBtn" data-id="${item.item_id}">
             <i class="fas fa-edit text-primary" style="font-size: 20px;"></i>
           </a>
           <a href="#" class="deleteBtn ml-2" data-id="${item.item_id}">
             <i class="fas fa-trash-alt text-danger" style="font-size: 20px;"></i>
           </a>`;

      tbody.append(`
        <tr>
          <td>${item.item_id}</td>
          <td>${imageHtml}</td>
          <td>${item.item_name || ''}</td>
          <td>${item.description || ''}</td>
          <td>${item.sell_price || ''}</td>
          <td>${item.cost_price || ''}</td>
          <td>${item.quantity || ''}</td>
          <td>${item.category_name || ''}</td>
          <td class="action-buttons">${actions}</td>
        </tr>
      `);
    });
  }

  // Setup pagination
  function setupPagination() {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
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
    if (!isNaN(page) && page !== currentPage) {
      currentPage = page;
      renderItems();
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

      renderItems();
      if (viewMode === 'pagination') {
        setupPagination();
      }
    }
  });

  // Search functionality
  $('#searchButton').click(function () {
    performSearch();
  });

  $('#itemSearch').keypress(function (e) {
    if (e.which === 13) {
      performSearch();
    }
  });

  function performSearch() {
    const searchTerm = $('#itemSearch').val().toLowerCase();
    if (searchTerm) {
      filteredItems = allItems.filter(item =>
        (item.item_name && item.item_name.toLowerCase().includes(searchTerm)) ||
        (item.description && item.description.toLowerCase().includes(searchTerm)) ||
        (item.category_name && item.category_name.toLowerCase().includes(searchTerm)) ||
        (item.item_id && item.item_id.toString().includes(searchTerm))
      );
    } else {
      filteredItems = [...allItems];
    }

    currentPage = 1;
    renderItems();
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
    const data = filteredItems.map(item => [
      item.item_id,
      item.item_name,
      item.description,
      item.cost_price,
      item.sell_price,
      item.quantity,
      item.category_name
    ]);

    const ws = XLSX.utils.json_to_sheet(filteredItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory.xlsx");
  });

  // Export to PDF
  $('#exportPdf').click(function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const headers = [
      "ID",
      "Item Name",
      "Description",
      "Cost Price",
      "Sell Price",
      "Quantity",
      "Category"
    ];

    const data = filteredItems.map(item => [
      item.item_id,
      item.item_name,
      item.description,
      item.cost_price,
      item.sell_price,
      item.quantity,
      item.category_name
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

    doc.save('inventory.pdf');
  });

  $('#itemSubmit').click(function (e) {
    e.preventDefault();
    const formData = new FormData($('#iform')[0]);
    $.ajax({
      url: baseUrl,
      method: 'POST',
      data: formData,
      contentType: false,
      processData: false,
      success: function () {
        Swal.fire('Success', 'Item created!', 'success');
        $('#itemModal').modal('hide');
        loadItems();
      },
      error: function (err) {
        console.error(err);
        Swal.fire('Error', 'Item creation failed.', 'error');
      }
    });
  });

  $(document).on('click', '.editBtn', function (e) {
    e.preventDefault();
    const id = $(this).data('id');
    $('#itemSubmit').hide();
    $('#itemUpdate').show();
    $('#imagePreview').empty();

    $.get(`${baseUrl}/${id}`, function (res) {
      const item = res.result[0];
      $('#itemId').val(item.item_id);
      $('#item_name').val(item.item_name);
      $('#description').val(item.description);
      $('#sell_price').val(item.sell_price);
      $('#cost_price').val(item.cost_price);
      $('#quantity').val(item.quantity);
      $('#category').val(item.category_id);

      const images = [...new Set(item.all_images || [])];
      const previews = images.map(img => `<img src="${imageBaseUrl}${img}" width="100" class="mr-2 mb-2" onerror="this.src='${imageBaseUrl}placeholder.jpg'; this.onerror=null;" />`).join('');
      $('#imagePreview').html(previews);

      $('#itemModal').modal('show');
    }).fail(function () {
      Swal.fire('Error', 'Failed to fetch item data.', 'error');
    });
  });

  $('#itemUpdate').click(function (e) {
    e.preventDefault();
    const id = $('#itemId').val();
    const formData = new FormData($('#iform')[0]);
    $.ajax({
      url: `${baseUrl}/${id}`,
      method: 'PUT',
      data: formData,
      contentType: false,
      processData: false,
      success: function () {
        Swal.fire('Updated', 'Item updated successfully.', 'success');
        $('#itemModal').modal('hide');
        loadItems();
      },
      error: function (err) {
        console.error(err);
        Swal.fire('Error', 'Failed to update item.', 'error');
      }
    });
  });

  $(document).on('click', '.deleteBtn', function (e) {
    e.preventDefault();
    const id = $(this).data('id');
    Swal.fire({
      title: 'Are you sure?',
      text: 'This item will be deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!'
    }).then(result => {
      if (result.isConfirmed) {
        $.ajax({
          url: `${baseUrl}/${id}`,
          method: 'DELETE',
          success: function () {
            Swal.fire('Deleted!', 'Item has been deleted.', 'success');
            loadItems();
          },
          error: function (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to delete item.', 'error');
          }
        });
      }
    });
  });

  $(document).on('click', '.restoreBtn', function (e) {
    e.preventDefault();
    const id = $(this).data('id');
    Swal.fire({
      title: 'Restore Item?',
      text: 'Do you want to restore this item?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, restore it!'
    }).then(result => {
      if (result.isConfirmed) {
        $.ajax({
          url: `${baseUrl}/restore/${id}`,
          method: 'PATCH',
          success: function () {
            Swal.fire('Restored!', 'Item has been restored.', 'success');
            loadItems();
          },
          error: function (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to restore item.', 'error');
          }
        });
      }
    });
  });

  loadItems();
});