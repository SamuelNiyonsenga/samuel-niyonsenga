  (function(){
            const slider = document.getElementById('hero-slider');
            const slidesEl = slider.querySelector('.slides');
            const slides = Array.from(slidesEl.children);
            const dotsContainer = document.getElementById('dots');
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');

            let index = 0;
            const count = slides.length;
            const intervalMs = 2000;
            let timer = null;

            // build dots

              slides.forEach((_, i) => {
                const d = document.createElement('div');
                d.className = 'dot' + (i === 0 ? ' active' : '');
                d.dataset.index = i;
                d.addEventListener('click', () => goTo(parseInt(d.dataset.index, 10)));
                dotsContainer.appendChild(d);
            });

            function update() {
                slidesEl.style.transform = `translateX(-${index * 100}%)`;
                Array.from(dotsContainer.children).forEach((dot, i) => dot.classList.toggle('active', i === index));
            }

            function next() { index = (index + 1) % count; update(); }
            function prev() { index = (index - 1 + count) % count; update(); }
            function goTo(i) { index = i % count; update(); resetTimer(); }

            nextBtn.addEventListener('click', () => { next(); resetTimer(); });
            prevBtn.addEventListener('click', () => { prev(); resetTimer(); });

             function startTimer() {
                if (timer) return;
                timer = setInterval(next, intervalMs);
            }
            function stopTimer() { clearInterval(timer); timer = null; }
            function resetTimer() { stopTimer(); startTimer(); }

            // Pause on hover/focus
            slider.addEventListener('pointerenter', stopTimer);
            slider.addEventListener('pointerleave', startTimer);
            slider.addEventListener('focusin', stopTimer);
            slider.addEventListener('focusout', startTimer);

            // Simple swipe support
            let startX = 0;
            let isDown = false;
            slider.addEventListener('pointerdown', (e) => {
                isDown = true;
                startX = e.clientX;
                slider.setPointerCapture(e.pointerId);
            });
              slider.addEventListener('pointerup', (e) => {
                if (!isDown) return;
                const dx = e.clientX - startX;
                if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); resetTimer(); }
                isDown = false;
            });
            slider.addEventListener('pointercancel', () => isDown = false);

            // init
            update();
            startTimer();
        })();
    
