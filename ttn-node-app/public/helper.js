var notificationTo;
function showNotification(msg) {
  clearTimeout(notificationTo);

  var el = document.querySelector('#notification');
  el.textContent = msg;
  el.style.opacity = 1;
  el.style.visibility = 'visible';

  notificationTo = setTimeout(function() {
    el.style.opacity = 0;
    el.style.visibility = 'hidden';
  }, 6000);

  el.onclick = function() {
    clearTimeout(notificationTo);
    el.style.opacity = 0;
    el.style.visibility = 'hidden';
  };
}
