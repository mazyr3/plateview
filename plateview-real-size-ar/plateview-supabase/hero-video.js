(() => {
  const video = document.getElementById('platecropHeroVideo');
  const source = document.getElementById('platecropHeroVideoSource');
  const sound = document.getElementById('heroVideoSound');
  const play = document.getElementById('heroVideoPlay');
  if (!video) return;

  const cfg = window.PLATECROP_MARKETING || {};
  if (cfg.heroVideo && source && source.getAttribute('src') !== cfg.heroVideo) {
    source.src = cfg.heroVideo;
    video.load();
  }
  if (cfg.heroVideoPoster) video.poster = cfg.heroVideoPoster;

  // Autoplay reliably on mobile by starting muted.
  video.muted = true;
  video.play().catch(() => {});

  sound?.addEventListener('click', () => {
    video.muted = !video.muted;
    sound.textContent = video.muted ? 'Sound on' : 'Mute';
  });

  play?.addEventListener('click', () => {
    if (video.paused) {
      video.play();
      play.textContent = 'Ⅱ';
      play.setAttribute('aria-label', 'Pause video');
    } else {
      video.pause();
      play.textContent = '▶';
      play.setAttribute('aria-label', 'Play video');
    }
  });
})();
