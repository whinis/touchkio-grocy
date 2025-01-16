
const screensaverBtn = document.getElementById("screensaverBtn");

screensaverBtn.addEventListener("click", () => {
  window.tabs.screensaver_off()
});

function makeid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

const interval = setInterval(function() {
  id = makeid(10)
  screensaverBtn.style.backgroundImage = 'url(' + "screensaver://"+id+".png" + ')';
}, 30000);
var t = setInterval(startTime, 500);
function startTime() {
  var today = new Date();
  var h = today.getHours();
  var m = today.getMinutes();
  var s = today.getSeconds();
  var am = "AM"
  if (h>= 12){
    h = h - 12;
    am = "PM";
  }
  if( h===0){
    h = 12
  }
  m = checkTime(m);
  s = checkTime(s);
  document.getElementById('clock').innerHTML =
    h + ":" + m + " "+am;
}
function checkTime(i) {
  if (i < 10) {i = "0" + i};  // add zero in front of numbers < 10
  return i;
}
