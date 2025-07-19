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
        message: "Access Denied: You do not have permission to access this page. Only administrators can manage categories.",
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
  const apiUrl = `${url}api/category/admin/all`;
  let currentViewMode = 'pagination';
  let currentPage = 1;
  let itemsPerPage = 10;
  let allCategories = [];
  let filteredCategories = [];
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

  // Load all categories
  function loadCategories() {
    isLoading = true;
    $('#loading-spinner').show();

    $.get(apiUrl, function (res) {
      if (res.data) {
        allCategories = res.data;
        filteredCategories = [...allCategories];
        renderCategories();
        if (currentViewMode === 'pagination') {
          setupPagination();
        }
      }
    }).fail(function (xhr) {
      if (xhr.status === 401 || xhr.status === 403) {
        return;
      }
      bootbox.alert("Error loading categories. Please try again.");
    }).always(function () {
      isLoading = false;
      $('#loading-spinner').hide();
    });
  }

  // Render categories based on current view mode
  function renderCategories() {
    const tbody = $('#cbody');
    tbody.empty();

    let categoriesToRender = [];
    if (currentViewMode === 'pagination') {
      const startIndex = (currentPage - 1) * itemsPerPage;
      categoriesToRender = filteredCategories.slice(startIndex, startIndex + itemsPerPage);
    } else {
      // For infinite scroll, show all loaded categories
      categoriesToRender = filteredCategories;
    }

    if (categoriesToRender.length === 0) {
      tbody.append('<tr><td colspan="3" class="text-center">No categories found</td></tr>');
      return;
    }

    categoriesToRender.forEach(category => {
      let btns = `
        <a href='#' class='editCategoryBtn' data-id="${category.category_id}">
          <i class='fas fa-edit text-primary' style='font-size: 20px;'></i>
        </a>
        <a href='#' class='deleteCategoryBtn' data-id="${category.category_id}">
          <i class='fas fa-trash-alt text-danger' style='font-size: 20px;'></i>
        </a>`;

      if (category.deleted_at) {
        btns += `
        <a href='#' class='unarchiveCategoryBtn' data-id="${category.category_id}">
          <i class='fas fa-undo text-success' style='font-size: 20px;'></i>
        </a>`;
      }

      tbody.append(`
        <tr>
          <td>${category.category_id}</td>
          <td>${category.description || ''}</td>
          <td class="action-buttons">${btns}</td>
        </tr>
      `);
    });
  }

  // Setup pagination
  function setupPagination() {
    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
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
      renderCategories();
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

      renderCategories();
      if (viewMode === 'pagination') {
        setupPagination();
      }
    }
  });

  // Search functionality
  $('#searchButton').click(function () {
    performSearch();
  });

  $('#categorySearch').keypress(function (e) {
    if (e.which === 13) {
      performSearch();
    }
  });

  function performSearch() {
    const searchTerm = $('#categorySearch').val().toLowerCase();
    if (searchTerm) {
      filteredCategories = allCategories.filter(category =>
        (category.description && category.description.toLowerCase().includes(searchTerm)) ||
        (category.category_id && category.category_id.toString().includes(searchTerm)));
    } else {
      filteredCategories = [...allCategories];
    }

    currentPage = 1;
    renderCategories();
    if (currentViewMode === 'pagination') {
      setupPagination();
    }
  }

  // Infinite scroll handler
  $(window).scroll(function () {
    if (currentViewMode !== 'infinite' || isLoading || !hasMoreData) return;

    if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
      // Simulate loading more data (in a real app, you'd make an API call)
      $('#loading-spinner').show();
      setTimeout(() => {
        $('#loading-spinner').hide();
      }, 500);
    }
  });

  // Export to Excel
  $('#exportExcel').click(function () {
    const data = filteredCategories.map(category => [
      category.category_id,
      category.description,
      category.deleted_at ? 'Archived' : 'Active'
    ]);

    const ws = XLSX.utils.json_to_sheet(filteredCategories);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Categories");
    XLSX.writeFile(wb, "categories.xlsx");
  });

  // Export to PDF
  $('#exportPdf').click(function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const headers = ["ID", "Description", "Status"];

    const data = filteredCategories.map(category => [
      category.category_id,
      category.description,
      category.deleted_at ? 'Archived' : 'Active'
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

    doc.save('categories.pdf');
  });

  // Submit new category
  $("#categorySubmit").on('click', function (e) {
    e.preventDefault();
    const formData = { description: $('#category_description').val() };

    if (!formData.description.trim()) {
      bootbox.alert("Please enter a category description.");
      return;
    }

    $.ajax({
      method: "POST",
      url: `${url}api/category/create`,
      data: JSON.stringify(formData),
      contentType: "application/json",
      success: function () {
        $("#categoryModal").modal("hide");
        loadCategories();
        bootbox.alert("Category created successfully!");
      },
      error: function (err) {
        console.log(err);
        if (err.status !== 401 && err.status !== 403) {
          bootbox.alert("Error creating category.");
        }
      }
    });
  });

  // Edit category button
  $(document).on('click', '.editCategoryBtn', function (e) {
    e.preventDefault();
    $("#cform").trigger("reset");
    $('#categoryId').remove();

    const id = $(this).data('id');
    $('<input>').attr({ type: 'hidden', id: 'categoryId', name: 'category_id', value: id }).appendTo('#cform');

    $('#categoryModal').modal('show');
    $('#categorySubmit').hide();
    $('#categoryUpdate').show();

    $.ajax({
      method: "GET",
      url: `${url}api/category/${id}`,
      dataType: "json",
      success: function (data) {
        const { result } = data;
        $('#category_description').val(result[0].description);
      },
      error: function (xhr) {
        if (xhr.status !== 401 && xhr.status !== 403) {
          bootbox.alert("Error loading category data.");
        }
      }
    });
  });

  // Update category
  $("#categoryUpdate").on('click', function (e) {
    e.preventDefault();
    const id = $('#categoryId').val();
    const formData = { description: $('#category_description').val() };

    if (!formData.description.trim()) {
      bootbox.alert("Please enter a category description.");
      return;
    }

    $.ajax({
      method: "PUT",
      url: `${url}api/category/${id}`,
      data: JSON.stringify(formData),
      contentType: "application/json",
      success: function () {
        $('#categoryModal').modal("hide");
        loadCategories();
        bootbox.alert("Category updated successfully!");
      },
      error: function (xhr) {
        if (xhr.status !== 401 && xhr.status !== 403) {
          const errorMessage = xhr.responseJSON?.error || "Error updating category.";
          bootbox.alert(errorMessage);
        }
      }
    });
  });

  // Delete category
  $(document).on('click', '.deleteCategoryBtn', function (e) {
    e.preventDefault();
    const id = $(this).data('id');

    bootbox.confirm({
      message: "Are you sure you want to delete this category?",
      buttons: {
        confirm: { label: 'Yes', className: 'btn-success' },
        cancel: { label: 'No', className: 'btn-danger' }
      },
      callback: function (result) {
        if (result) {
          $.ajax({
            method: "DELETE",
            url: `${url}api/category/${id}`,
            success: function (data) {
              loadCategories();
              bootbox.alert(data.message || "Category deleted successfully!");
            },
            error: function (xhr) {
              if (xhr.status !== 401 && xhr.status !== 403) {
                const errorMessage = xhr.responseJSON?.error || "Error deleting category.";
                bootbox.alert(errorMessage);
              }
            }
          });
        }
      }
    });
  });

  // Restore category
  $(document).on('click', '.unarchiveCategoryBtn', function (e) {
    e.preventDefault();
    const id = $(this).data('id');

    $.ajax({
      method: "PUT",
      url: `${url}api/category/restore/${id}`,
      success: function () {
        loadCategories();
        bootbox.alert("Category restored successfully!");
      },
      error: function (xhr) {
        if (xhr.status !== 401 && xhr.status !== 403) {
          const errorMessage = xhr.responseJSON?.error || "Error restoring category.";
          bootbox.alert(errorMessage);
        }
      }
    });
  });

  loadCategories();
});