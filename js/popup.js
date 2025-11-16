document.addEventListener('DOMContentLoaded', function () {
    const popupOverlay = document.getElementById('popupOverlay');
    const closePopupBtn = document.getElementById('closePopupBtn');
    const closeAndShowLaterBtn = document.getElementById('closeAndShowLaterBtn');
    const popupTimer = document.getElementById('popupTimer');

    let autoCloseTimeout;
    let showAgainTimeout;
    let remainingTime = 30; // 30 seconds
    let timerInterval;

    // Show popup immediately after page load
    setTimeout(() => {
        showPopup();
        startAutoCloseTimer();
    }, 100);

    // Close popup button
    closePopupBtn.addEventListener('click', function () {
        hidePopup();
        clearTimeout(autoCloseTimeout);
        clearInterval(timerInterval);
    });

    // Close and show again after 40 seconds
    closeAndShowLaterBtn.addEventListener('click', function () {
        hidePopup();
        clearTimeout(autoCloseTimeout);
        clearInterval(timerInterval);

        // Show again after 40 seconds
        showAgainTimeout = setTimeout(() => {
            remainingTime = 30;
            showPopup();
            startAutoCloseTimer();
        }, 40000);
    });

    // Function to show popup
    function showPopup() {
        popupOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Function to hide popup
    function hidePopup() {
        popupOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // Function to start auto close timer
    function startAutoCloseTimer() {
        clearTimeout(autoCloseTimeout);
        clearInterval(timerInterval);

        autoCloseTimeout = setTimeout(() => {
            hidePopup();
        }, remainingTime * 1000);

        // Update timer display every second
        timerInterval = setInterval(() => {
            remainingTime--;
            updateTimerDisplay();

            if (remainingTime <= 0) {
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    // Function to update timer display
    function updateTimerDisplay() {
        popupTimer.textContent = `Auto closing in: ${remainingTime} seconds`;
    }

    // Close popup when clicking outside
    popupOverlay.addEventListener('click', function (e) {
        if (e.target === popupOverlay) {
            hidePopup();
            clearTimeout(autoCloseTimeout);
            clearInterval(timerInterval);
        }
    });
});