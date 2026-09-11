/**
 * Victory Fluent Forum ToolHub - Core Utility Module (v3.0)
 */

window.ToolHub = window.ToolHub || {};

/* Accordion FAQ Helper */
function toggleFAQ(element) {
  var item = element.parentElement;
  var isActive = item.classList.contains('active');
  
  // Close all open FAQs
  document.querySelectorAll('.saas-accordion-item').forEach(function(el) {
    el.classList.remove('active');
  });

  // Toggle clicked FAQ
  if (!isActive) {
    item.classList.add('active');
  }
}

/* Theme Manager */
ToolHub.Theme = {
  init: function() {
    var savedTheme = localStorage.getItem('vff_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  },
  toggle: function() {
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    var newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('vff_theme', newTheme);
  }
};

/* Copy Clipboard Helper */
ToolHub.Copy = {
  text: function(str, buttonEl) {
    if (!navigator.clipboard) {
      alert('Copied to clipboard!');
      return;
    }
    navigator.clipboard.writeText(str).then(function() {
      if (buttonEl) {
        var origText = buttonEl.innerHTML;
        buttonEl.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(function() { buttonEl.innerHTML = origText; }, 2000);
      }
    });
  }
};

/* Print Helper */
ToolHub.Print = {
  report: function() {
    window.print();
  }
};

// Initialize Theme & Micro-Interactions on Load
document.addEventListener('DOMContentLoaded', function() {
  ToolHub.Theme.init();

  // Scroll Reading Progress Listener
  window.addEventListener('scroll', function() {
    var progressBar = document.getElementById('readingProgress');
    if (progressBar) {
      var winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var scrolled = (winScroll / height) * 100;
      progressBar.style.width = scrolled + "%";
    }
  });
});
