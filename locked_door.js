let hasInteracted = false;

  function playAudio() {
    var audio = document.getElementById("audio");

    // no audio found
    if(audio == null){
      return;
    }

    // Play the audio only if the user has interacted
    if (hasInteracted) {
      audio.play().then(() => {

      }).catch((error) => {
        console.error('Error playing audio: ', error);
      });
    }
  }

  // Detect first user interaction
  function userInteractionHandler() {
    if (!hasInteracted) {
      hasInteracted = true;  // Mark the first interaction
      playAudio();  // Optionally play audio after interaction
    }

    // Remove the event listeners after the first interaction to avoid repeated triggers
    document.removeEventListener('click', userInteractionHandler);
    document.removeEventListener('keydown', userInteractionHandler);
    document.removeEventListener('touchstart', userInteractionHandler);
  }

  // Set up event listeners to catch any interaction
  document.addEventListener('click', userInteractionHandler);
  document.addEventListener('keydown', userInteractionHandler);
  document.addEventListener('touchstart', userInteractionHandler);




// Get all elements with the "is3d" attribute
const elements = document.querySelectorAll('[is3d]');
const rotationTracked = [];
for(let i = 0; i < elements.length; i++){
  rotationTracked.push(0);
}

var deltaX = 0;
var deltaY = 0;
var maxDistance = 0;

// Function to continuously spin elements
function continuousSpin() {

  let i = 0;
  elements.forEach((el) => {
    // Get the spin and speed attributes if present
    const spin = el.hasAttribute('spin');
    const speed = parseFloat(el.getAttribute('spin_speed')) || 1; // Default speed to 1 if not specified

    // Apply the spinning transform if the element has the 'spin' attribute
    if (spin) {
      rotationTracked[i] += speed;  // Increment the angle based on the speed
      if (rotationTracked[i] >= 360) rotationTracked[i] = 0;  // Reset angle to 0 when it goes over 360 to avoid large numbers
    }
    i++;
  });


  i = 0;
  elements.forEach((el) => {
    // Get the depth attribute for each element
    const depth = parseFloat(el.getAttribute('depth')) || 50; // Default to 50 if not specified
    const x = parseFloat(el.getAttribute('x')) || 0; // Default to 0 if not specified
    const y = parseFloat(el.getAttribute('y')) || 0; // Default to 0 if not specified

    // Get the spin and speed attributes if present
    const spin = el.hasAttribute('spin');
    const speed = parseFloat(el.getAttribute('speed')) || 1; // Default speed to 1 if not specified

    // Calculate the movement for each element based on its depth
    const moveX = (deltaX / maxDistance) * depth + x;
    const moveY = (deltaY / maxDistance) * depth + y;

    // Apply the spinning transform if the element has the 'spin' attribute
    let transform = `translateX(${moveX}px) translateY(${moveY}px)`;  // Apply translate first

    if (spin) {
      transform += ` rotate(${rotationTracked[i]}deg)`;  // Append the rotation to the transformation
    }

    // Apply the combined transform to the element
    el.style.transform = transform;
    i++;
  });


}

// Function to handle mouse movement and apply both movement and spin
function handleMouseMove(event) {
  const { clientX, clientY } = event;
  const { innerWidth: width, innerHeight: height } = window;

  // Get the center of the screen
  const centerX = width / 2;
  const centerY = height / 2;

  // Calculate the mouse distance from the center
  deltaX = clientX - centerX;
  deltaY = clientY - centerY;

  // Calculate the scale factor for movement
  maxDistance = Math.min(width, height) / 2;


}


// Add the event listener to track mouse movement
window.addEventListener('mousemove', handleMouseMove);

// Start the continuous spin for elements that have the 'spin' attribute
setInterval(continuousSpin, 16);