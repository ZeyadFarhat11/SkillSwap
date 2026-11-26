(function () {
  const avatarInput = document.getElementById('avatarInput');
  const avatarPreviewContainer = document.getElementById('avatarPreviewContainer');

  if (avatarInput && avatarPreviewContainer) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target && event.target.result;
        if (typeof dataUrl !== 'string') return;

        let previewImg = document.getElementById('avatarPreviewImg');
        if (!previewImg) {
          const fallback = document.getElementById('avatarPreviewFallback');
          if (fallback) fallback.remove();
          previewImg = document.createElement('img');
          previewImg.id = 'avatarPreviewImg';
          previewImg.alt = 'Profile Avatar';
          previewImg.className = 'w-full h-full object-cover object-top';
          avatarPreviewContainer.appendChild(previewImg);
        }
        previewImg.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  const bioInput = document.getElementById('bio');
  const bioCounter = document.getElementById('bio-counter');

  if (bioInput && bioCounter) {
    bioInput.addEventListener('input', () => {
      bioCounter.textContent = `${bioInput.value.length} / 1000`;
    });
  }

  const container = document.getElementById('projectLinksContainer');
  const addBtn = document.getElementById('addProjectLinkBtn');

  function bindRemoveButtons() {
    if (!container) return;
    container.querySelectorAll('.remove-project-link').forEach((btn) => {
      btn.onclick = function () {
        const rows = container.querySelectorAll('.project-link-row');
        if (rows.length > 1) {
          btn.closest('.project-link-row').remove();
        } else {
          const input = btn.closest('.project-link-row').querySelector('input');
          if (input) input.value = '';
        }
      };
    });
  }

  if (container && addBtn) {
    bindRemoveButtons();
    addBtn.addEventListener('click', () => {
      const currentRows = container.querySelectorAll('.project-link-row').length;
      if (currentRows >= 10) return;

      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 project-link-row';

      const input = document.createElement('input');
      input.type = 'url';
      input.name = 'projectLinks';
      input.placeholder = 'https://github.com/username/project';
      input.className =
        'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-[#0057C2] focus:border-transparent outline-none transition duration-150 shadow-sm';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className =
        'remove-project-link px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg';
      removeBtn.textContent = 'Remove';

      row.appendChild(input);
      row.appendChild(removeBtn);
      container.appendChild(row);
      bindRemoveButtons();
    });
  }
})();
