document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZACIÓN ---
    AOS.init({ duration: 700, once: true, offset: 50 });

    // --- CONSTANTES ---
    const rootElement = document.documentElement;
    const sections = Array.from(document.querySelectorAll('.fullpage-section'));
    const navLinks = document.querySelectorAll('.nav-menu a, .nav-link');
    const scrollIndicators = document.getElementById('scroll-indicators');
    const arrowUp = document.getElementById('arrow-up');
    const arrowDown = document.getElementById('arrow-down');
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const mainHeader = document.querySelector('.main-header');

    // --- NAVEGACIÓN SUAVE Y CIERRE DE MENÚ ---
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const targetSection = document.querySelector(link.getAttribute('href'));
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
            if (navMenu.classList.contains('active')) {
                closeMenu();
            }
        });
    });

    // --- NAVEGACIÓN CON TECLADO ---
    document.addEventListener('keydown', e => {
        if (document.activeElement.tagName === 'INPUT') return;
        const currentSectionIndex = Math.round(rootElement.scrollTop / window.innerHeight);
        if (e.key === 'ArrowDown' && sections[currentSectionIndex + 1]) {
            e.preventDefault();
            sections[currentSectionIndex + 1].scrollIntoView({ behavior: 'smooth' });
        } else if (e.key === 'ArrowUp' && sections[currentSectionIndex - 1]) {
            e.preventDefault();
            sections[currentSectionIndex - 1].scrollIntoView({ behavior: 'smooth' });
        }
    });

    // --- CONTADOR ANIMADO ---
    const animateCounter = (el) => {
        const target = +el.getAttribute('data-target');
        const duration = 1500;
        let current = 0;
        const increment = target / (duration / 16); // 16ms ~ 60fps
        const formatNumber = (num) => new Intl.NumberFormat('de-DE').format(Math.ceil(num));

        const step = () => {
            current += increment;
            if (current < target) {
                el.innerText = formatNumber(current);
                requestAnimationFrame(step);
            } else {
                el.innerText = formatNumber(target);
                if (!el.previousElementSibling || el.previousElementSibling.tagName !== 'I') {
                   el.innerText = '+' + el.innerText;
                }
            }
        };
        requestAnimationFrame(step);
    };

    // --- LÓGICA DE SCROLL (OBSERVER) ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            // Lógica de Indicadores Lottie y Header
            const isLight = entry.target.classList.contains('light-bg');
            scrollIndicators.classList.toggle('invert-colors', isLight);
            mainHeader.classList.toggle('on-dark-bg', !isLight);

            // Lógica del contador animado
            const counters = entry.target.querySelectorAll('.stat-number');
            counters.forEach(counter => {
                if (!counter.classList.contains('is-visible')) {
                    animateCounter(counter);
                    counter.classList.add('is-visible');
                }
            });
        });
    }, { threshold: 0.6 }); // Se activa cuando el 60% de la sección es visible

    sections.forEach(section => observer.observe(section));

    // Ocultar flechas en top/bottom
    const updateScrollArrows = () => {
        const scrollTop = rootElement.scrollTop;
        const maxScroll = rootElement.scrollHeight - rootElement.clientHeight;
        arrowUp.classList.toggle('hidden', scrollTop < 50);
        arrowDown.classList.toggle('hidden', scrollTop > maxScroll - 50);
    };

    document.addEventListener('scroll', updateScrollArrows, { passive: true });
    updateScrollArrows();

    // --- MENÚ HAMBURGUESA ---
    const closeMenu = () => {
        navMenu.classList.remove('active');
        hamburger.querySelector('i').classList.add('fa-bars');
        hamburger.querySelector('i').classList.remove('fa-times');
    };
    
    hamburger.addEventListener('click', () => {
        const isActive = navMenu.classList.toggle('active');
        const icon = hamburger.querySelector('i');
        icon.classList.toggle('fa-bars', !isActive);
        icon.classList.toggle('fa-times', isActive);
    });
});