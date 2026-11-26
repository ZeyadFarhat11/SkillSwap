(function () {
  const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function setError(input, message) {
    const errorEl = document.getElementById(input.id + 'Error');
    input.classList.add('input-error');
    input.classList.remove('input-success');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  function setValid(input) {
    const errorEl = document.getElementById(input.id + 'Error');
    input.classList.remove('input-error');
    input.classList.add('input-success');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  function validateEmailInput(input) {
    const value = input.value.trim();
    if (!value) {
      setError(input, 'Please enter your email address.');
      return false;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setError(input, 'Invalid email! Example: name@example.com');
      return false;
    }
    setValid(input);
    return true;
  }

  const toggleBtn = document.getElementById('togglePassword');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      const targetId = toggleBtn.getAttribute('data-toggle-target') || 'password';
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;

      if (targetInput.type === 'password') {
        targetInput.type = 'text';
        toggleBtn.textContent = 'Hide';
      } else {
        targetInput.type = 'password';
        toggleBtn.textContent = 'Show';
      }
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    const validateLoginPassword = () => {
      if (!passwordInput.value.trim()) {
        setError(passwordInput, 'Please enter your password.');
        return false;
      }
      setValid(passwordInput);
      return true;
    };

    emailInput.addEventListener('input', () => validateEmailInput(emailInput));
    passwordInput.addEventListener('input', validateLoginPassword);

    loginForm.addEventListener('submit', (event) => {
      const okEmail = validateEmailInput(emailInput);
      const okPassword = validateLoginPassword();
      if (!okEmail || !okPassword) {
        event.preventDefault();
      }
    });
  }

  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');

    const validateRequired = (input, message) => {
      if (!input.value.trim()) {
        setError(input, message);
        return false;
      }
      setValid(input);
      return true;
    };

    const validateSignupPassword = () => {
      if (passwordInput.value.length < 8) {
        setError(passwordInput, 'Password must be at least 8 characters.');
        return false;
      }
      setValid(passwordInput);
      return true;
    };

    const validateConfirmPassword = () => {
      if (!confirmInput.value) {
        setError(confirmInput, 'Please confirm your password.');
        return false;
      }
      if (confirmInput.value !== passwordInput.value) {
        setError(confirmInput, 'Passwords do not match.');
        return false;
      }
      setValid(confirmInput);
      return true;
    };

    firstNameInput.addEventListener('input', () =>
      validateRequired(firstNameInput, 'Please enter your first name.')
    );
    lastNameInput.addEventListener('input', () =>
      validateRequired(lastNameInput, 'Please enter your last name.')
    );
    emailInput.addEventListener('input', () => validateEmailInput(emailInput));
    passwordInput.addEventListener('input', () => {
      validateSignupPassword();
      if (confirmInput.value) {
        validateConfirmPassword();
      }
    });
    confirmInput.addEventListener('input', validateConfirmPassword);

    signupForm.addEventListener('submit', (event) => {
      const checks = [
        validateRequired(firstNameInput, 'Please enter your first name.'),
        validateRequired(lastNameInput, 'Please enter your last name.'),
        validateEmailInput(emailInput),
        validateSignupPassword(),
        validateConfirmPassword(),
      ];
      if (checks.some((ok) => !ok)) {
        event.preventDefault();
      }
    });
  }
})();
