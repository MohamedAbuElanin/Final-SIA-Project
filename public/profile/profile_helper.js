function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('edit') === 'true') {
        // Wait for data load? Or just enable. 
        // enableEditMode relies on refs being set which happens in cacheElements.
        // Data might not be populated yet, but that's fine, inputs will fill when loadUserData finishes.
        // But we want to ensure the modal/form is visible.
        setTimeout(() => {
            enableEditMode();
            if (refs.personalInfoForm) {
                // creating a visual cue
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-info mb-3';
                alertDiv.textContent = "Please complete your profile information.";
                refs.personalInfoForm.insertAdjacentElement('beforebegin', alertDiv);
            }
        }, 1000); // Small delay to ensure UI is ready
    }
}
