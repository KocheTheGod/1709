// Confetti celebration
const duration = 5 * 1000;
const animationEnd = Date.now() + duration;
const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

const interval = setInterval(function () {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
        return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Confetti from left
    confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#ff6b9d', '#ffc2d1', '#c44569', '#e056fd', '#ff9a9e', '#FFE4E8']
    });

    // Confetti from right
    confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#ff6b9d', '#ffc2d1', '#c44569', '#e056fd', '#ff9a9e', '#FFE4E8']
    });
}, 250);

// Heart emoji confetti
setTimeout(() => {
    confetti({
        particleCount: 100,
        spread: 160,
        origin: { y: 0.6 },
        shapes: ['circle'],
        colors: ['#ff6b9d', '#ffc2d1', '#ff8fa3']
    });
}, 500);
