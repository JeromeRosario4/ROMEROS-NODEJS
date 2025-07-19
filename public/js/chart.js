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
                message: "Access Denied: You do not have permission to access this page. Only administrators can manage charts.",
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
    const url = 'http://localhost:3000/'
    
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

    $.ajax({
        method: "GET",
        url: `${url}api/chart/address-chart`,
        dataType: "json",
        success: function (data) {
            console.log(data.rows);
            const { rows } = data
            var ctx = $("#addressChart");

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: rows.map(row => row.addressline),
                    datasets: [{
                        label: 'Number of Customers per town',
                        data: rows.map(row => row.total),
                        backgroundColor: () => {
                            var colors = [];
                            for (var i = 0; i < rows.length; i++) {
                                var letters = '0123456789ABCDEF'.split('');
                                var color = '#';
                                for (var x = 0; x < 6; x++) {
                                    color += letters[Math.floor(Math.random() * 16)];
                                }
                                colors.push(color);
                            }
                            return colors;
                        },
                        borderColor: [
                            'rgb(255, 99, 132)',
                            'rgb(255, 159, 64)',
                            'rgb(255, 205, 86)',
                            'rgb(75, 192, 192)',
                            'rgb(54, 162, 235)',
                            'rgb(153, 102, 255)',
                            'rgb(201, 203, 207)'
                        ],
                        borderWidth: 1,

                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    },
                    indexAxis: 'y',
                },
            });
        },
        error: function (error) {
            console.log(error);
        }
    });

    $.ajax({
        type: "GET",
        url: `${url}api/chart/sales-chart`,
        dataType: "json",
        success: function (data) {
            console.log(data);
            const { rows } = data
            var ctx = $("#salesChart");
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: rows.map(row => row.month),
                    datasets: [{
                        label: 'Monthly sales',
                        data: rows.map(row => row.total),
                        backgroundColor: () => {
                            var colors = [];
                            for (var i = 0; i < rows.length; i++) {
                                var letters = '0123456789ABCDEF'.split('');
                                var color = '#';
                                for (var x = 0; x < 6; x++) {
                                    color += letters[Math.floor(Math.random() * 16)];
                                }
                                colors.push(color);
                            }
                            return colors;
                        },

                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                },
            });

        },
        error: function (error) {
            console.log(error);
        }
    });

    $.ajax({
        type: "GET",
        url: `${url}api/chart/items-chart`,
        dataType: "json",
        success: function (data) {
            console.log(data);
            const { rows } = data
            var ctx = $("#itemsChart");
            new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: rows.map(row => row.items),
                    datasets: [{
                        label: 'number of items sold',
                        data: rows.map(row => row.total),

                        backgroundColor: () => {
                            var colors = [];
                            for (var i = 0; i < rows.length; i++) {
                                var letters = '0123456789ABCDEF'.split('');
                                var color = '#';
                                for (var x = 0; x < 6; x++) {
                                    color += letters[Math.floor(Math.random() * 16)];
                                }
                                colors.push(color);
                            }
                            return colors;
                        },
                        borderColor: [
                            'rgba(75, 192, 192, 1)',
                            'rgba(255,99,132,1)'
                        ],
                        borderWidth: 1,
                        responsive: true,
                    }]
                },
                options: {
                    plugins: {
                        datalabels: {
                            backgroundColor: function (context) {
                                return context.dataset.backgroundColor;
                            },
                            borderColor: 'white',
                            borderRadius: 25,
                            borderWidth: 2,
                            color: 'white',
                            display: function (context) {
                                var dataset = context.dataset;
                                var count = dataset.data.length;
                                var value = dataset.data[context.dataIndex];
                                return value > count * 1.5;
                            },
                            font: {
                                weight: 'bold'
                            },
                            padding: 6,
                            formatter: Math.round
                        },
                        aspectRatio: 4 / 3,
                        cutoutPercentage: 32,
                        layout: {
                            padding: 32
                        },
                        elements: {
                            line: {
                                fill: false
                            },
                            point: {
                                hoverRadius: 7,
                                radius: 5
                            }
                        },
                    }
                }


            });

        },
        error: function (error) {
            console.log(error);
        }
    });
})