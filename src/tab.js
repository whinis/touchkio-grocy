
const switchBtn = document.getElementById("switchBtn");

switchBtn.addEventListener("click", () => {
  window.tabs.switch_tab()
});
const keyboardBtn = document.getElementById("keyboardBtn");

keyboardBtn.addEventListener("click", () => {
  window.tabs.toggle_keyboard()
});
