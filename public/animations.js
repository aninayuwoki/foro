// animations.js - Animaciones con GSAP para el foro
// Asegúrate de incluir GSAP en tu HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>

class ForumAnimations {
    constructor() {
        this.initializeAnimations();
        this.setupScrollTriggers();
    }

    // Inicializar animaciones básicas al cargar la página
    initializeAnimations() {
        // Animación del header al cargar
        gsap.fromTo('.site-header', 
            { y: -100, opacity: 0 },
            { y: 0, opacity: 1, duration: 1, ease: "power3.out" }
        );

        // Animación del formulario principal
        gsap.fromTo('.nueva-publicacion form', 
            { scale: 0.9, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.8, delay: 0.3, ease: "back.out(1.7)" }
        );

        // Animación inicial de las publicaciones existentes
        this.animateExistingPosts();
    }

    // Animar publicaciones existentes al cargar la página
    animateExistingPosts() {
        gsap.fromTo('.publicacion', 
            { y: 50, opacity: 0 },
            { 
                y: 0, 
                opacity: 1, 
                duration: 0.6, 
                stagger: 0.1, 
                delay: 0.5,
                ease: "power2.out" 
            }
        );
    }

    // Animar nueva publicación cuando se agrega
    animateNewPost(postElement) {
        // Aparecer desde la izquierda con efecto bounce
        gsap.fromTo(postElement, 
            { x: -300, opacity: 0, scale: 0.8 },
            { 
                x: 0, 
                opacity: 1, 
                scale: 1,
                duration: 0.8, 
                ease: "back.out(1.7)",
                onComplete: () => {
                    // Secondary bounce/wobble animation
                    gsap.fromTo(postElement, 
                        { scale: 1 }, 
                        { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1, ease: "power1.inOut", delay: 0.05 }
                    );
                    // Efecto de highlight después de aparecer
                    this.highlightElement(postElement);
                }
            }
        );
    }

    // Efecto de highlight/brillo para elementos importantes
    highlightElement(element) {
        const tl = gsap.timeline();
        tl.to(element, {
            boxShadow: "0 0 20px rgba(74, 144, 226, 0.5)",
            duration: 0.3
        })
        .to(element, {
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            duration: 0.5,
            delay: 1
        });
    }

    // Animar respuesta cuando se agrega
    animateNewReply(replyElement) {
        gsap.fromTo(replyElement, 
            { x: 50, opacity: 0, scale: 0.9 },
            { 
                x: 0, 
                opacity: 1, 
                scale: 1,
                duration: 0.6, 
                ease: "power3.out" 
            }
        );
    }

    // Animación de hover mejorada para publicaciones
    setupHoverAnimations() {
        const posts = document.querySelectorAll('.publicacion');
        
        posts.forEach(post => {
            post.addEventListener('mouseenter', () => {
                gsap.to(post, {
                    y: -5,
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                    duration: 0.3,
                    ease: "power2.out"
                });
            });

            post.addEventListener('mouseleave', () => {
                gsap.to(post, {
                    y: 0,
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    duration: 0.3,
                    ease: "power2.out"
                });
            });
        });
    }

    // Animación para botones con efecto de pulso
    animateButtonClick(button) {
        const tl = gsap.timeline();
        tl.to(button, {
            scale: 0.90, // More noticeable scale
            filter: 'brightness(1.2)', // Add brightness
            duration: 0.1
        })
        .to(button, {
            scale: 1,
            filter: 'brightness(1)', // Reset brightness
            duration: 0.1
        });
    }

    // Animación de las estrellas de votación
    animateStarRating(stars, rating) {
        stars.forEach((star, index) => {
            if (index < rating) {
                // Selected stars: Pop effect
                gsap.to(star, {
                    scale: 1.4, // Pop bigger
                    color: "#FFD700", // Brighter gold
                    duration: 0.2,
                    delay: index * 0.05,
                    ease: "back.out(2)", // Adjusted ease for more pop
                    onComplete: () => {
                        gsap.to(star, { scale: 1.15, duration: 0.2, ease: "power1.out" }); // Settle slightly larger and smoother
                    }
                });
            } else {
                // Unselected stars: Reset
                gsap.to(star, {
                    scale: 1,
                    color: "#ddd", // Original unselected color
                    duration: 0.2,
                    delay: index * 0.05,
                    ease: "power1.out"
                });
            }
        });
    }

    // Animación de aparición de modal de imagen
    animateImageModal(modal) {
        const backdrop = modal.querySelector('.modal-backdrop');
        const content = modal.querySelector('.modal-content');

        gsap.set(modal, { display: 'flex' });
        gsap.fromTo(backdrop, 
            { opacity: 0 },
            { opacity: 1, duration: 0.3 }
        );
        gsap.fromTo(content, 
            { scale: 0.8, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
        );
    }

    // Animación de cierre de modal
    closeImageModal(modal) {
        const backdrop = modal.querySelector('.modal-backdrop');
        const content = modal.querySelector('.modal-content');

        const tl = gsap.timeline({
            onComplete: () => {
                gsap.set(modal, { display: 'none' });
            }
        });

        tl.to(content, {
            scale: 0.8,
            opacity: 0,
            duration: 0.3,
            ease: "back.in(1.7)"
        })
        .to(backdrop, {
            opacity: 0,
            duration: 0.2
        }, "-=0.1");
    }

    // Animación de filtros activos
    animateActiveFilter(filterElement) {
        gsap.fromTo(filterElement, 
            { scale: 0.9, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
        );
    }

    // Animación de hashtags
    animateHashtagSelection(hashtag) {
        gsap.to(hashtag, {
            scale: 1.1,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut"
        });
    }

    // Configurar ScrollTrigger para animaciones al hacer scroll
    setupScrollTriggers() {
        // Verificar si ScrollTrigger está disponible
        if (typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);

            // Animar elementos al entrar en viewport
            gsap.fromTo('.publicacion', 
                { y: 50, opacity: 0.3 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 0.6,
                    stagger: 0.1,
                    scrollTrigger: {
                        trigger: '.publicaciones-grid',
                        start: 'top 80%',
                        end: 'bottom 20%',
                        toggleActions: 'play none none reverse'
                    }
                }
            );
        }
    }

    // Animación de carga para nuevos elementos
    showLoadingAnimation(container) {
        const loader = document.createElement('div');
        loader.className = 'loader';
        container.appendChild(loader);

        gsap.to(loader, {
            rotation: 360,
            duration: 1,
            repeat: -1,
            ease: "none"
        });

        return loader;
    }

    // Remover animación de carga
    hideLoadingAnimation(loader) {
        gsap.to(loader, {
            opacity: 0,
            scale: 0,
            duration: 0.3,
            onComplete: () => {
                if (loader && loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            }
        });
    }

    // Animación de transición entre secciones
    transitionToSection(fromSection, toSection) {
        const tl = gsap.timeline();

        tl.to(fromSection, {
            x: -100,
            opacity: 0,
            duration: 0.4,
            ease: "power2.in"
        })
        .set(fromSection, { display: 'none' })
        .set(toSection, { display: 'block', x: 100, opacity: 0 })
        .to(toSection, {
            x: 0,
            opacity: 1,
            duration: 0.4,
            ease: "power2.out"
        });
    }

    // Animación de contador de caracteres
    animateCharacterCounter(counter, isWarning = false) {
        if (isWarning) {
            gsap.to(counter, {
                color: "#e74c3c",
                scale: 1.1,
                duration: 0.2,
                yoyo: true,
                repeat: 1
            });
        } else {
            gsap.to(counter, {
                color: "#777",
                scale: 1,
                duration: 0.2
            });
        }
    }

    // Método para limpiar todas las animaciones
    cleanup() {
        gsap.killTweensOf("*");
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.killAll();
        }
    }
}

// Inicializar las animaciones cuando el DOM esté listo
let forumAnimations;

document.addEventListener('DOMContentLoaded', function() {
    // Verificar que GSAP esté cargado
    if (typeof gsap !== 'undefined') {
        forumAnimations = new ForumAnimations();
        window.forumAnimationsInstance = forumAnimations; // Expose instance
        console.log('Animaciones GSAP inicializadas correctamente');
    } else {
        console.warn('GSAP no está cargado. Asegúrate de incluir la librería GSAP.');
    }
});

// Exportar para uso global
// window.ForumAnimations = ForumAnimations; // Commented out