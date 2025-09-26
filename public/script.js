document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById('modal-terminos');
  const btnAceptar = document.getElementById('btn-aceptar-terminos');

  // Siempre asigna el evento al botón
  if (btnAceptar) {
    btnAceptar.addEventListener('click', function () {
      localStorage.setItem('terminosAceptados', 'true');
      modal.style.display = 'none';
      iniciarAplicacion();
    });
  }

  // Mostrar el modal si no se aceptó
  if (!localStorage.getItem('terminosAceptados')) {
    modal.style.display = 'flex';
  } else {
    modal.style.display = 'none'; // Por si quedó visible por error
    iniciarAplicacion();
  }

  // Nuevo: Selector de género por íconos
  const generoBotones = document.querySelectorAll('.genero-btn');
  const generoInput = document.getElementById('genero');
  if (generoBotones.length && generoInput) {
    generoBotones.forEach(btn => {
      btn.addEventListener('click', function () {
        generoInput.value = this.dataset.genero;

        // Limpiar selección anterior
        generoBotones.forEach(b => b.classList.remove('seleccionado'));
        this.classList.add('seleccionado');
      });
    });
  }
});


function iniciarAplicacion() {
  cargarPublicacionesRecientes();
  cargarHashtags();
  configurarModalImagen();
  configurarTerminosYCondiciones();
}


let hashtagActual = '';
let imagenSeleccionada = null;

const EMOJIS = ['👍', '😂', '❤️', '🤔', '😢', '😮'];

// terminos y condiciones
function configurarTerminosYCondiciones() {
  if (document.getElementById('acepto-terminos')) {
    return;
  }

  const formPublicacion = document.getElementById('form-publicacion');
  const submitButton = formPublicacion.querySelector('button[type="submit"]');

  const contenedorTerminos = document.createElement('div');
  contenedorTerminos.className = 'terminos-contenedor';
  contenedorTerminos.innerHTML = `
    <div class="terminos-checkbox-grupo">
      <input type="checkbox" id="acepto-terminos" name="acepto-terminos" required>
      <label for="acepto-terminos" class="terminos-label">
        Asegurese de leer los <a href="terminos.html" class="enlace-terminos">términos y condiciones</a>
        antes de marcar la casilla
        <span class="terminos-obligatorio">*</span>
      </label>
    </div>
    <div id="error-terminos" class="error-terminos" style="display: none;">
      Debe aceptar los términos y condiciones para poder publicar
    </div>
  `;

  // insertar terminos en el formulario
  formPublicacion.insertBefore(contenedorTerminos, submitButton);

  // Deshabilitar el botón inicialmente
  submitButton.disabled = true;
  submitButton.classList.add('btn-disabled');

  // Ahora sí: accede a los elementos recién insertados
  const checkbox = document.getElementById('acepto-terminos');
  const errorTerminos = document.getElementById('error-terminos');

  checkbox.addEventListener('change', function () {
    if (this.checked) {
      submitButton.disabled = false;
      submitButton.classList.remove('btn-disabled');
      errorTerminos.style.display = 'none';
    } else {
      submitButton.disabled = true;
      submitButton.classList.add('btn-disabled');
    }
  });
}



// Function to set up event listeners for emoji reactions (VERSIÓN CORREGIDA)
function setupEmojiEventListeners() {
  document.querySelectorAll('.emoji-reaction-btn').forEach(button => {
    // Clone and replace the button to remove any old listeners and prevent accumulation
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    newButton.addEventListener('click', async function() {
      const postId = this.dataset.postId;
      const emoji = this.dataset.emoji;
      const localStorageKey = `reacted_emoji_${postId}_${emoji}`;
      const countSpan = this.querySelector('.emoji-count');

      if (!countSpan) {
        console.error("Count span not found for emoji button:", this);
        return;
      }

      const hasReacted = localStorage.getItem(localStorageKey) === 'true';

      try {
        // Enviar reacción al servidor
        const response = await fetch(`/api/publicaciones/${postId}/emoji-reaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emoji: emoji,
            action: hasReacted ? 'remove' : 'add'
          })
        });

        if (!response.ok) {
          const errorData = await response.text(); // Leer más detalles del error
          throw new Error(`Error en la respuesta del servidor: ${response.status} ${errorData}`);
        }

        const data = await response.json();

        // Actualizar el estado local y la UI solo si el servidor respondió correctamente
        if (hasReacted) {
          // User is un-reacting
          localStorage.removeItem(localStorageKey);
          this.classList.remove('selected-emoji');
          console.log(`Post ID: ${postId}, Emoji: ${emoji} un-reacted. New count: ${data.count}`);
        } else {
          // User is reacting
          localStorage.setItem(localStorageKey, 'true');
          this.classList.add('selected-emoji');
          console.log(`Post ID: ${postId}, Emoji: ${emoji} reacted. New count: ${data.count}`);
        }

        // Actualizar el contador con la respuesta del servidor
        countSpan.textContent = data.count;

      } catch (error) {
        console.error('Error al procesar reacción de emoji:', error);
        alert('Hubo un error al procesar tu reacción. Inténtalo de nuevo.');
      }
    });
  });
}

function cargarPublicacionesRecientes() {
  document.getElementById('btn-recientes')?.classList.add('hashtag-activo');
  document.getElementById('btn-votadas')?.classList.remove('hashtag-activo');
  cargarPublicaciones();
}

function cargarPublicacionesMasVotadas() {
  document.getElementById('btn-votadas')?.classList.add('hashtag-activo');
  document.getElementById('btn-recientes')?.classList.remove('hashtag-activo');
  fetch('/api/publicaciones/mas-votadas')
    .then(res => res.json())
    .then(data => mostrarPublicaciones(data));
}

// Función para mostrar publicaciones (MODIFICACIÓN MÍNIMA)
function mostrarPublicaciones(publicaciones) {
  const contenedor = document.getElementById('publicaciones');
  contenedor.innerHTML = '';

  if (publicaciones.length === 0) {
    contenedor.innerHTML = '<div class="publicacion">No hay publicaciones disponibles.</div>';
    return;
  }

  publicaciones.forEach((pub, index) => {
    const div = document.createElement('div');
    div.className = 'publicacion';
    div.classList.add(`genero-${pub.genero || 'otro'}`);
    div.id = `pub-${pub.id}`;

    const mensajeConHashtags = procesarHashtags(pub.mensaje);

    const imagenHTML = pub.imagen ?
      `<div class="publicacion-imagen">
         <img src="${pub.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${pub.imagen}')">
       </div>` : '';

    const videoHTML = pub.video ? crearReproductorVideo(pub.video) : '';

    const promedioEstrellas = pub.estrellas && pub.estrellas.length
      ? (pub.estrellas.reduce((a, b) => a + b, 0) / pub.estrellas.length).toFixed(1)
      : 'Sin puntuación';

    const votosHTML = `
      <div class="publicacion-footer">
        <div class="votacion">
          <button class="btn-like" data-pub-id="${pub.id}">
            ▲ <span class="contador-like">${pub.likes || 0}</span>
          </button>
          <button class="btn-dislike" data-pub-id="${pub.id}">
            ▼ <span class="contador-dislike">${pub.dislikes || 0}</span>
          </button>
        </div>
        <div class="publicaciones-acciones">
          ⭐ Promedio: ${promedioEstrellas} / 5
          <br>
          <span class="votar-estrellas" data-id="${pub.id}">
            Calificar:
            ${
              (() => {
                const key_estrellas = `votado_estrellas_${pub.id}`;
                const puntuacion_estrellas = localStorage.getItem(key_estrellas) ? parseInt(localStorage.getItem(key_estrellas)) : 0;
                return [1, 2, 3, 4, 5].map(i =>
                  `<span class="estrella ${i <= puntuacion_estrellas ? 'votada' : ''}" data-id="${pub.id}" data-score="${i}">★</span>`
                ).join('');
              })()
            }
          </span>
        </div>
        <div class="publicacion-acciones">
          <button class="btn-responder" onclick="mostrarFormularioRespuesta(${pub.id})">Responder</button>
          <a href="javascript:void(0)" onclick="verComentarios(${pub.id})" class="btn-comentarios">Ver comentarios</a>
        </div>
      </div>
    `;

    // MODIFICACIÓN PRINCIPAL: Usar datos del servidor para los emojis
    let emojiReactionsHTML = '<div class="emoji-reactions">';
    EMOJIS.forEach(emoji => {
      const localStorageKey = `reacted_emoji_${pub.id}_${emoji}`;
      const isReacted = localStorage.getItem(localStorageKey) === 'true';

      const currentEmojiCount = (pub.emojiCounts && typeof pub.emojiCounts[emoji] !== 'undefined')
        ? pub.emojiCounts[emoji]
        : 0;

      emojiReactionsHTML += `
        <button class="emoji-reaction-btn ${isReacted ? 'selected-emoji' : ''}" data-post-id="${pub.id}" data-emoji="${emoji}">
          ${emoji} <span class="emoji-count">${currentEmojiCount}</span>
        </button>
      `;
    });
    emojiReactionsHTML += '</div>';

    div.innerHTML = `
      <strong>${pub.nombre}</strong><br>
      ${mensajeConHashtags}<br>
      ${videoHTML}
      ${imagenHTML}
      <small>${new Date(pub.fecha).toLocaleString()}</small><br>
      ${votosHTML}
      ${emojiReactionsHTML}
      <div id="respuestas-${pub.id}">
        ${pub.replicas?.map((rep, repIndex) => {
          const repMensajeConHashtags = procesarHashtags(rep.mensaje);
          const repImagenHTML = rep.imagen ? `<div class="respuesta-imagen"><img src="${rep.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${rep.imagen}')"></div>` : '';
          const repVideoHTML = rep.video ? crearReproductorVideo(rep.video) : '';
          const respVotosHTML = `
            <div class="respuesta-footer">
              <div class="votacion votacion-respuesta">
                <button class="btn-like" data-pub-id="${pub.id}" data-resp-index="${repIndex}">
                  ▲ <span class="contador-like">${rep.likes || 0}</span>
                </button>
                <button class="btn-dislike" data-pub-id="${pub.id}" data-resp-index="${repIndex}">
                  ▼ <span class="contador-dislike">${rep.dislikes || 0}</span>
                </button>
              </div>
            </div>
          `;
          return `
            <div class="respuesta genero-${rep.genero || 'otro'}" id="resp-${pub.id}-${repIndex}">
              <strong>${rep.nombre}</strong><br>
              ${repMensajeConHashtags}<br>
              ${repVideoHTML}
              ${repImagenHTML}
              <small>${new Date(rep.fecha).toLocaleString()}</small>
              ${respVotosHTML}
            </div>
          `;
        }).join('') || ''}
      </div>
      <div id="form-respuesta-${pub.id}" style="display:none; margin-top:10px;">
        <input type="text" placeholder="Tu nombre o apodo" id="nombre-rep-${pub.id}"><br>
        <select id="genero-rep-${pub.id}">
          <option value="">-- No especificar --</option>
          <option value="hombre">Hombre</option>
          <option value="mujer">Mujer</option>
          <option value="mecha">Mecha</option>
        </select><br>
        <textarea placeholder="Tu respuesta..." id="mensaje-rep-${pub.id}"></textarea><br>
        <div class="imagen-container">
          <input type="file" id="imagen-rep-${pub.id}" accept="image/*" class="input-imagen">
          <label for="imagen-rep-${pub.id}" class="btn-imagen">📷 Añadir imagen (1)</label>
          <div id="imagen-preview-rep-${pub.id}"></div>
        </div>
        <!-- Términos para respuestas -->
        <div class="terminos-respuesta">
          <input type="checkbox" id="acepto-terminos-resp-${pub.id}" required>
          <label for="acepto-terminos-resp-${pub.id}" class="terminos-label-small">
            Acepto la responsabilidad por el contenido de mi respuesta
          </label>
        </div>
        <button class="btn btn-primary" onclick="enviarRespuesta(${pub.id})" disabled id="btn-enviar-resp-${pub.id}">Enviar respuesta</button>
      </div>
    `;

    contenedor.appendChild(div);

    const inputImagen = document.getElementById(`imagen-rep-${pub.id}`);
    if (inputImagen) {
      inputImagen.addEventListener('change', function (e) {
        manejarImagenRespuesta(e, pub.id);
      });
    }

    // Configurar checkbox de términos para respuestas
    const checkboxResp = document.getElementById(`acepto-terminos-resp-${pub.id}`);
    const btnEnviarResp = document.getElementById(`btn-enviar-resp-${pub.id}`);

    if (checkboxResp && btnEnviarResp) {
      checkboxResp.addEventListener('change', function() {
        btnEnviarResp.disabled = !this.checked;
        if (this.checked) {
          btnEnviarResp.classList.remove('btn-disabled');
        } else {
          btnEnviarResp.classList.add('btn-disabled');
        }
      });
    }
  }); // End of publicaciones.forEach

  document.querySelectorAll('.hashtag').forEach(tag => {
    tag.addEventListener('click', function () {
      const hashtag = this.getAttribute('data-hashtag');
      filtrarPorHashtag(hashtag);
    });
  });

  gestionarVotos();
  document.querySelectorAll('.estrella').forEach(estrella => {
    estrella.addEventListener('click', async function () {
      const pubId = this.getAttribute('data-id');
      const valor = parseInt(this.getAttribute('data-score'));
      const key_estrellas_click = `votado_estrellas_${pubId}`;
      if (localStorage.getItem(key_estrellas_click)) {
        alert('Ya calificaste esta publicación.');
        return;
      }
      await fetch(`/api/publicaciones/${pubId}/estrella`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor })
      });
      localStorage.setItem(key_estrellas_click, valor);
      alert('¡Gracias por tu puntuación!');
      actualizarEstrellas(pubId, valor);
    });
  });

  setupEmojiEventListeners(); // Call after rendering posts
}

// Función para mostrar publicación detallada (MODIFICACIÓN MÍNIMA)
function mostrarPublicacionDetallada(pub, contenedor) {
  const div = document.createElement('div');
  div.className = 'publicacion publicacion-detallada';
  div.classList.add(`genero-${pub.genero || 'otro'}`);
  div.id = `pub-${pub.id}`;

  const mensajeConHashtags = procesarHashtags(pub.mensaje);
  const imagenHTML = pub.imagen ? `<div class="publicacion-imagen"><img src="${pub.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${pub.imagen}')"></div>` : '';
  const videoHTML = pub.video ? crearReproductorVideo(pub.video) : '';

  const footerHTML = `
    <div class="publicacion-footer">
      <div class="votacion">
        <button class="btn-like" data-pub-id="${pub.id}">
          ▲ <span class="contador-like">${pub.likes || 0}</span>
        </button>
        <button class="btn-dislike" data-pub-id="${pub.id}">
          ▼ <span class="contador-dislike">${pub.dislikes || 0}</span>
        </button>
      </div>
      <button class="btn-responder" onclick="mostrarFormularioRespuesta(${pub.id})">Responder</button>
    </div>`;

  let emojiReactionsHTML = '<div class="emoji-reactions">';
  EMOJIS.forEach(emoji => {
    const localStorageKey = `reacted_emoji_${pub.id}_${emoji}`;
    const isReacted = localStorage.getItem(localStorageKey) === 'true';
    const currentEmojiCount = (pub.emojiCounts && typeof pub.emojiCounts[emoji] !== 'undefined')
      ? pub.emojiCounts[emoji]
      : 0;

    emojiReactionsHTML += `
      <button class="emoji-reaction-btn ${isReacted ? 'selected-emoji' : ''}" data-post-id="${pub.id}" data-emoji="${emoji}">
        ${emoji} <span class="emoji-count">${currentEmojiCount}</span>
      </button>
    `;
  });
  emojiReactionsHTML += '</div>';

  div.innerHTML = `
    <div class="publicacion-cabecera">
      <strong>${pub.nombre}</strong>
      <small>${new Date(pub.fecha).toLocaleString()}</small>
    </div>
    <div class="publicacion-contenido">
      ${mensajeConHashtags}<br>
      ${videoHTML}
      ${imagenHTML}
    </div>
    ${footerHTML}
    ${emojiReactionsHTML}
    <div class="comentarios-seccion">
      <h3>Comentarios</h3>
      <div id="form-respuesta-${pub.id}" style="display:none; margin: 20px 0;">
        <input type="text" placeholder="Tu nombre o apodo" id="nombre-rep-${pub.id}"><br>
        <select id="genero-rep-${pub.id}">
          <option value="">-- No especificar --</option>
          <option value="hombre">Hombre</option>
          <option value="mujer">Mujer</option>
          <option value="mecha">Mecha</option>
        </select><br>
        <textarea placeholder="Tu respuesta..." id="mensaje-rep-${pub.id}"></textarea><br>
        <div class="imagen-container">
          <input type="file" id="imagen-rep-${pub.id}" accept="image/*" class="input-imagen">
          <label for="imagen-rep-${pub.id}" class="btn-imagen">📷 Añadir imagen (máx 2MB)</label>
          <div id="imagen-preview-rep-${pub.id}"></div>
        </div>
        <!-- Términos para respuestas en vista detallada -->
        <div class="terminos-respuesta">
          <input type="checkbox" id="acepto-terminos-resp-${pub.id}" required>
          <label for="acepto-terminos-resp-${pub.id}" class="terminos-label-small">
            Acepto la responsabilidad por el contenido de mi respuesta
          </label>
        </div>
        <button class="btn btn-primary" onclick="enviarRespuesta(${pub.id})" disabled id="btn-enviar-resp-${pub.id}">Enviar respuesta</button>
      </div>
      <div id="respuestas-${pub.id}" class="respuestas-detalladas">
        ${pub.replicas?.length ? '' : '<p class="sin-comentarios">Aún no hay comentarios. ¡Sé el primero en responder!</p>'}
        ${pub.replicas?.map((rep, repIndex) => {
          const repMensajeConHashtags = procesarHashtags(rep.mensaje);
          const repImagenHTML = rep.imagen ? `<div class="respuesta-imagen"><img src="${rep.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${rep.imagen}')"></div>` : '';
          const repVideoHTML = rep.video ? crearReproductorVideo(rep.video) : '';
          // Emoji reactions for replies could be added here if needed
          return `
            <div class="respuesta respuesta-detallada genero-${rep.genero || 'otro'}" id="resp-${pub.id}-${repIndex}">
              <div class="respuesta-cabecera">
                <strong>${rep.nombre}</strong>
                <small>${new Date(rep.fecha).toLocaleString()}</small>
              </div>
              <div class="respuesta-contenido">
                ${repMensajeConHashtags}<br>
                ${repVideoHTML}
                ${repImagenHTML}
              </div>
              <div class="respuesta-footer">
                <div class="votacion votacion-respuesta">
                  <button class="btn-like" data-pub-id="${pub.id}" data-resp-index="${repIndex}">
                    ▲ <span class="contador-like">${rep.likes || 0}</span>
                  </button>
                  <button class="btn-dislike" data-pub-id="${pub.id}" data-resp-index="${repIndex}">
                    ▼ <span class="contador-dislike">${rep.dislikes || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('') || ''}
      </div>
    </div>
  `; // End of div.innerHTML

  contenedor.appendChild(div);

  const inputImagen = document.getElementById(`imagen-rep-${pub.id}`);
  if (inputImagen) {
    inputImagen.addEventListener('change', function (e) {
      manejarImagenRespuesta(e, pub.id);
    });
  }

  // Configurar checkbox de términos para respuestas en vista detallada
  const checkboxResp = document.getElementById(`acepto-terminos-resp-${pub.id}`);
  const btnEnviarResp = document.getElementById(`btn-enviar-resp-${pub.id}`);

  if (checkboxResp && btnEnviarResp) {
    checkboxResp.addEventListener('change', function() {
      btnEnviarResp.disabled = !this.checked;
      if (this.checked) {
        btnEnviarResp.classList.remove('btn-disabled');
      } else {
        btnEnviarResp.classList.add('btn-disabled');
      }
    });
  }

  document.querySelectorAll('.hashtag').forEach(tag => {
    tag.addEventListener('click', function () {
      const hashtag = this.getAttribute('data-hashtag');
      filtrarPorHashtag(hashtag);
    });
  });

  gestionarVotos();
  setupEmojiEventListeners(); // Call after rendering the detailed post
}

// --- Rest of the existing script.js functions ---

async function cargarPublicaciones() {
  let url = '/api/publicaciones';
  if (hashtagActual) {
    url += `?hashtag=${hashtagActual}`;
  }

  const res = await fetch(url);
  const publicaciones = await res.json();
  publicaciones.reverse(); // Reverse the order of posts for "Recientes"
  mostrarPublicaciones(publicaciones);
}

async function cargarPublicacionesOrdenadasPorVotos() {
  const res = await fetch('/api/publicaciones/mas-votadas');
  const publicaciones = await res.json();
  mostrarPublicaciones(publicaciones);
}

function generarNombrePorDefecto(genero) {
  let base;
  switch (genero) {
    case 'mujer':
      base = 'Whygirl';
      break;
    case 'mecha':
      base = 'Bot';
      break;
    case 'hombre':
    case '':
    default:
      base = 'Whyman';
  }
  const contador = localStorage.getItem(`contador_${base}`) || 0;
  localStorage.setItem(`contador_${base}`, Number(contador) + 1);
  return `${base}${contador}`;
}

document.getElementById('imagen').addEventListener('change', function(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  if (archivo.size > 20 * 1024 * 1024) {
    alert('La imagen es demasiado grande. El tamaño máximo es 20MB.');

    this.value = '';
    return;
  }
  if (!archivo.type.startsWith('image/')) {
    alert('El archivo seleccionado no es una imagen.');
    this.value = '';
    return;
  }
  imagenSeleccionada = archivo;
  const reader = new FileReader();
  reader.onload = function(event) {
    const preview = document.getElementById('imagen-preview');
    preview.innerHTML = `
      <div class="imagen-preview">
        <img src="${event.target.result}" alt="Vista previa">
        <div class="remover-imagen" onclick="removerImagen()">✕</div>
      </div>
    `;
  };
  reader.readAsDataURL(archivo);
});

function removerImagen() {
  document.getElementById('imagen').value = '';
  document.getElementById('imagen-preview').innerHTML = '';
  imagenSeleccionada = null;
}

function configurarModalImagen() {
  const modal = document.querySelector('.imagen-modal');
  if (modal) {
    const backdrop = modal.querySelector('.modal-backdrop');
    const closeButton = modal.querySelector('.cerrar-modal');

    // Usar la función `cerrarModalImagen` que ya existe y maneja la animación
    backdrop.addEventListener('click', cerrarModalImagen);
    closeButton.addEventListener('click', cerrarModalImagen);
  }
}

function abrirImagenModal(src) {
  const modal = document.querySelector('.imagen-modal');
  const img = modal.querySelector('img');
  img.src = src;
  modal.style.display = 'flex';
}

function crearReproductorVideo(videoInfo) {
  if (!videoInfo || !videoInfo.plataforma) return '';
  let reproductorHTML = '';
  switch(videoInfo.plataforma) {
    case 'youtube':
      reproductorHTML = `
        <div class="video-contenedor">
          <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoInfo.videoId}"
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
        </div>`;
      break;
    case 'vimeo':
      reproductorHTML = `
        <div class="video-contenedor">
          <iframe width="100%" height="315" src="https://player.vimeo.com/video/${videoInfo.videoId}"
            frameborder="0" allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
        </div>`;
      break;
    default:
      reproductorHTML = `<div class="video-enlace"><a href="${videoInfo.urlOriginal}" target="_blank" rel="noopener noreferrer">Ver video en sitio original 🎬</a></div>`;
  }
  return reproductorHTML;
}

function gestionarVotos() {
  const votesState = JSON.parse(localStorage.getItem('votesState') || '{}');
  function manejarVoto(id, tipo, elemento) {
    const voteKey = `pub_${id}_${tipo}`;
    if (votesState[voteKey]) {
      alert('Ya has votado en esta publicación');
      return;
    }
    fetch(`/api/publicaciones/${id}/voto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo })
    })
    .then(res => res.json())
    .then(data => {
      const publicacion = document.querySelector(`#pub-${id}`);
      publicacion.querySelector(`.contador-${tipo}`).textContent = data[`${tipo}s`];
      elemento.classList.add('voted');
      votesState[voteKey] = true;
      localStorage.setItem('votesState', JSON.stringify(votesState));
      publicacion.querySelector(`.btn-like`).disabled = true;
      publicacion.querySelector(`.btn-dislike`).disabled = true;
    });
  }
  function manejarVotoRespuesta(pubId, respuestaIndex, tipo, elemento) {
    const voteKey = `resp_${pubId}_${respuestaIndex}_${tipo}`;
    if (votesState[voteKey]) {
      alert('Ya has votado en esta respuesta');
      return;
    }
    fetch(`/api/publicaciones/${pubId}/respuesta/${respuestaIndex}/voto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo })
    })
    .then(res => res.json())
    .then(data => {
      const respuesta = document.querySelector(`#resp-${pubId}-${respuestaIndex}`);
      respuesta.querySelector(`.contador-${tipo}`).textContent = data[`${tipo}s`];
      elemento.classList.add('voted');
      votesState[voteKey] = true;
      localStorage.setItem('votesState', JSON.stringify(votesState));
      respuesta.querySelector(`.btn-like`).disabled = true;
      respuesta.querySelector(`.btn-dislike`).disabled = true;
    });
  }
  document.querySelectorAll('.btn-like, .btn-dislike').forEach(btn => {
    btn.addEventListener('click', function() {
      const tipo = this.classList.contains('btn-like') ? 'like' : 'dislike';
      const pubId = this.getAttribute('data-pub-id');
      const respIndex = this.getAttribute('data-resp-index');
      if (respIndex !== null) {
        manejarVotoRespuesta(pubId, respIndex, tipo, this);
      } else {
        manejarVoto(pubId, tipo, this);
      }
    });
  });
  document.querySelectorAll('.btn-like, .btn-dislike').forEach(btn => {
    const tipo = btn.classList.contains('btn-like') ? 'like' : 'dislike';
    const pubId = btn.getAttribute('data-pub-id');
    const respIndex = btn.getAttribute('data-resp-index');
    let voteKey = respIndex !== null ? `resp_${pubId}_${respIndex}_${tipo}` : `pub_${pubId}_${tipo}`;
    if (votesState[voteKey]) {
      btn.classList.add('voted');
      const container = respIndex !== null ? document.querySelector(`#resp-${pubId}-${respIndex}`) : document.querySelector(`#pub-${pubId}`);
      if (container) {
        container.querySelector('.btn-like').disabled = true;
        container.querySelector('.btn-dislike').disabled = true;
      }
    }
  });
}

function manejarImagenRespuesta(e, pubId) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  if (archivo.size > 20 * 1024 * 1024) {
    alert('La imagen es demasiado grande. El tamaño máximo es 20MB.');
    e.target.value = ''; return;
  }
  if (!archivo.type.startsWith('image/')) {
    alert('El archivo seleccionado no es una imagen.');
    e.target.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = function(event) {
    const preview = document.getElementById(`imagen-preview-rep-${pubId}`);
    preview.innerHTML = `<div class="imagen-preview"><img src="${event.target.result}" alt="Vista previa"><div class="remover-imagen" onclick="removerImagenRespuesta(${pubId})">✕</div></div>`;
  };
  reader.readAsDataURL(archivo);
}

function removerImagenRespuesta(pubId) {
  document.getElementById(`imagen-rep-${pubId}`).value = '';
  document.getElementById(`imagen-preview-rep-${pubId}`).innerHTML = '';
}

function procesarHashtags(texto) {
  return texto.replace(/#(\w+)/g, '<span class="hashtag" data-hashtag="$1">#$1</span>');
}

async function cargarHashtags() {
  const res = await fetch('/api/hashtags');
  const hashtags = await res.json();
  const contenedor = document.getElementById('hashtags-container');
  const todosBtn = contenedor.querySelector('[data-hashtag=""]');
  contenedor.innerHTML = '';
  contenedor.appendChild(todosBtn);
  hashtags.forEach(tag => {
    const span = document.createElement('div');
    span.className = 'hashtag-pill';
    span.textContent = '#' + tag;
    span.setAttribute('data-hashtag', tag);
    contenedor.appendChild(span);
  });
  document.querySelectorAll('.hashtag-pill').forEach(pill => {
    pill.addEventListener('click', function() {
      const hashtag = this.getAttribute('data-hashtag');
      filtrarPorHashtag(hashtag);
    });
  });
  actualizarHashtagsActivos();
}

function filtrarPorHashtag(hashtag) {
  hashtagActual = hashtag;
  const filtroActivo = document.getElementById('filtro-activo');
  if (hashtag) {
    document.getElementById('hashtag-actual').textContent = '#' + hashtag;
    filtroActivo.style.display = 'flex';
  } else {
    filtroActivo.style.display = 'none';
  }
  actualizarHashtagsActivos();
  cargarPublicaciones();
}

function actualizarHashtagsActivos() {
  document.querySelectorAll('.hashtag-pill').forEach(pill => {
    if (pill.getAttribute('data-hashtag') === hashtagActual) {
      pill.classList.add('hashtag-activo');
    } else {
      pill.classList.remove('hashtag-activo');
    }
  });
}

function mostrarFormularioRespuesta(id) {
  document.getElementById(`form-respuesta-${id}`).style.display = 'block';
}

async function enviarRespuesta(id) {
  const genero = document.getElementById(`genero-rep-${id}`)?.value || '';
  let nombre = document.getElementById(`nombre-rep-${id}`).value.trim();
  if (!nombre) nombre = generarNombrePorDefecto(genero);
  const mensaje = document.getElementById(`mensaje-rep-${id}`).value.trim();
  const imagenInput = document.getElementById(`imagen-rep-${id}`);
  if (!mensaje) return;
  const formData = new FormData();
  formData.append('respuestaA', id);
  formData.append('nombre', nombre);
  formData.append('mensaje', mensaje);
  formData.append('genero', genero);
  if (imagenInput.files[0]) formData.append('imagen', imagenInput.files[0]);
  await fetch('/api/publicaciones', { method: 'POST', body: formData });
  document.getElementById(`form-respuesta-${id}`).style.display = 'none';
  document.getElementById(`nombre-rep-${id}`).value = '';
  document.getElementById(`mensaje-rep-${id}`).value = '';
  removerImagenRespuesta(id);
  setTimeout(() => cargarPublicaciones(), 100);
}

document.getElementById('form-publicacion').addEventListener('submit', async function (e) {
  e.preventDefault();
  const genero = document.getElementById('genero')?.value || '';
  let nombre = document.getElementById('nombre').value.trim();
  if (!nombre) nombre = generarNombrePorDefecto(genero);
  const mensaje = document.getElementById('mensaje').value.trim();
  if (!mensaje) return;
  const formData = new FormData();
  formData.append('nombre', nombre);
  formData.append('mensaje', mensaje);
  formData.append('genero', genero);
  if (imagenSeleccionada) formData.append('imagen', imagenSeleccionada);
  await fetch('/api/publicaciones', { method: 'POST', body: formData });
  document.getElementById('nombre').value = '';
  document.getElementById('mensaje').value = '';
  removerImagen();
  setTimeout(() => { cargarHashtags(); cargarPublicaciones(); }, 100);
});

document.getElementById('quitar-filtro').addEventListener('click', function() {
  filtrarPorHashtag('');
});

async function verComentarios(id) {
  localStorage.setItem('vistaAnterior', JSON.stringify({ hashtagActual, scrollPos: window.scrollY }));
  const res = await fetch(`/api/publicaciones/${id}`);
  const publicacion = await res.json();
  const contenedor = document.getElementById('publicaciones');
  const seccionPublicaciones = document.querySelector('.publicaciones');
  const filtros = document.querySelector('.filtros');
  const nuevaPublicacion = document.querySelector('.nueva-publicacion');
  filtros.style.display = 'none';
  nuevaPublicacion.style.display = 'none';
  seccionPublicaciones.querySelector('.section-title').innerHTML = `
    <button onclick="volverListado()" class="btn-volver">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Volver
    </button>
    <span>Publicación y comentarios</span>`;
  document.querySelector('.tabs').style.display = 'none';
  contenedor.innerHTML = '';
  mostrarPublicacionDetallada(publicacion, contenedor);
}

function volverListado() {
  document.querySelector('.filtros').style.display = 'block';
  document.querySelector('.nueva-publicacion').style.display = 'block';
  document.querySelector('.tabs').style.display = 'flex';
  document.querySelector('.publicaciones .section-title').textContent = '📄 Publicaciones recientes';
  const estadoAnterior = JSON.parse(localStorage.getItem('vistaAnterior') || '{"hashtagActual":"","scrollPos":0}');
  hashtagActual = estadoAnterior.hashtagActual;
  actualizarHashtagsActivos();
  cargarPublicaciones().then(() => {
    setTimeout(() => window.scrollTo(0, estadoAnterior.scrollPos), 100);
  });
}

function actualizarEstrellas(pubId, puntuacion) {
  const estrellas = document.querySelectorAll(`.estrella[data-id="${pubId}"]`);
  estrellas.forEach(e => {
    const score = parseInt(e.dataset.score);
    e.classList.toggle('votada', score <= puntuacion);
  });
}

// --- Funciones de animación (ejemplos de integración, ya actualizados a window.forumAnimationsInstance) ---
// Placeholder for crearElementoPublicacion and crearElementoRespuesta if they were part of the original script and needed for these examples
// function crearElementoPublicacion(datos) { /* ... */ }
// function crearElementoRespuesta(datos) { /* ... */ }

function agregarPublicacion(datos) {
    // const nuevaPublicacion = crearElementoPublicacion(datos);
    // const contenedorPublicaciones = document.getElementById('publicaciones');
    // contenedorPublicaciones.appendChild(nuevaPublicacion);
    // if (window.forumAnimationsInstance && nuevaPublicacion) {
    //     window.forumAnimationsInstance.animateNewPost(nuevaPublicacion);
    // }
    // if (window.forumAnimationsInstance) {
    //     window.forumAnimationsInstance.setupHoverAnimations();
    // }
    console.warn("agregarPublicacion de ejemplo llamada. Necesita implementación real si se usa o eliminarla.");
}

function agregarRespuesta(respuestaData, publicacionId) {
    // const nuevaRespuesta = crearElementoRespuesta(respuestaData);
    // const contenedorRespuestas = document.getElementById(`respuestas-${publicacionId}`);
    // contenedorRespuestas.appendChild(nuevaRespuesta);
    // if (window.forumAnimationsInstance && nuevaRespuesta) {
    //     window.forumAnimationsInstance.animateNewReply(nuevaRespuesta);
    // }
    console.warn("agregarRespuesta de ejemplo llamada. Necesita implementación real si se usa o eliminarla.");
}

function manejarVotacionEstrellas(estrellas, rating) {
    if (window.forumAnimationsInstance) {
        window.forumAnimationsInstance.animateStarRating(estrellas, rating);
    }
}

document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-primary, .btn-outline, .btn-responder')) {
        if (window.forumAnimationsInstance) {
            window.forumAnimationsInstance.animateButtonClick(e.target);
        }
    }
});

function cerrarModalImagen() {
    const modal = document.querySelector('.imagen-modal');
    if (!modal) return;
    if (window.forumAnimationsInstance) {
        window.forumAnimationsInstance.closeImageModal(modal);
    } else {
        modal.style.display = 'none';
    }
}

function aplicarFiltro(filtro) {
    const filtroActivo = document.querySelector('.filtro-activo');
    if (filtroActivo && window.forumAnimationsInstance) {
        window.forumAnimationsInstance.animateActiveFilter(filtroActivo);
    }
}

function seleccionarHashtag(hashtagElement) {
    if (window.forumAnimationsInstance) {
        window.forumAnimationsInstance.animateHashtagSelection(hashtagElement);
    }
}

function actualizarContador() {
  const mensaje = document.getElementById('mensaje');
  const contador = document.getElementById('contador-caracteres');
  if (mensaje && contador) {
    contador.textContent = `${mensaje.value.length} / 300`;
    if (window.forumAnimationsInstance) {
        window.forumAnimationsInstance.animateCharacterCounter(contador, mensaje.value.length > 280);
    }
  }
}

const mensajeTextarea = document.getElementById('mensaje');
if (mensajeTextarea) {
    mensajeTextarea.addEventListener('input', actualizarContador);
}