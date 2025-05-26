// Cargar publicaciones al inicio
window.onload = function() {
  cargarPublicacionesRecientes();
  cargarHashtags();
  configurarModalImagen();
};

let hashtagActual = '';
let imagenSeleccionada = null;

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
    const key = `votado_estrellas_${pub.id}`;
    const puntuacionGuardada = parseInt(localStorage.getItem(key));
    const puntuacion = !isNaN(puntuacionGuardada) ? puntuacionGuardada : 0;



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
                const key = `votado_estrellas_${pub.id}`;
                const puntuacion = localStorage.getItem(key) ? parseInt(localStorage.getItem(key)) : 0;
                return [1, 2, 3, 4, 5].map(i =>
                  `<span class="estrella ${i <= puntuacion ? 'votada' : ''}" data-id="${pub.id}" data-score="${i}">★</span>`
                ).join('');
              })()
            }
          </span>

        </>
        <div class="publicacion-acciones">
          <button class="btn-responder" onclick="mostrarFormularioRespuesta(${pub.id})">Responder</button>
          <a href="javascript:void(0)" onclick="verComentarios(${pub.id})" class="btn-comentarios">Ver comentarios</a>
        </div>
      </div>
    `;

    div.innerHTML = `
      <strong>${pub.nombre}</strong><br>
      ${mensajeConHashtags}<br>
      ${videoHTML}
      ${imagenHTML}
      <small>${new Date(pub.fecha).toLocaleString()}</small><br>
      ${votosHTML}
      <div id="respuestas-${pub.id}">
        ${pub.replicas?.map((rep, repIndex) => {
          const repMensajeConHashtags = procesarHashtags(rep.mensaje);

          const repImagenHTML = rep.imagen ?
            `<div class="respuesta-imagen">
               <img src="${rep.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${rep.imagen}')">
             </div>` : '';

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
          <label for="imagen-rep-${pub.id}" class="btn-imagen">📷 Añadir imagen (máx 2MB)</label>
          <div id="imagen-preview-rep-${pub.id}"></div>
        </div>

        <button class="btn btn-primary" onclick="enviarRespuesta(${pub.id})">Enviar respuesta</button>
      </div>
    `;

    contenedor.appendChild(div);

    const inputImagen = document.getElementById(`imagen-rep-${pub.id}`);
    if (inputImagen) {
      inputImagen.addEventListener('change', function (e) {
        manejarImagenRespuesta(e, pub.id);
      });
    }
  });

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

    // Evitar voto repetido
    const key = `votado_estrellas_${pubId}`;
    if (localStorage.getItem(key)) {
      alert('Ya calificaste esta publicación.');
      return;
    }

    // Enviar al servidor
    await fetch(`/api/publicaciones/${pubId}/estrella`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor })
    });

    localStorage.setItem(key, valor);
    alert('¡Gracias por tu puntuación!');
    actualizarEstrellas(pubId, valor);

  });
});

}




// Cargar publicaciones al inicio
window.onload = function() {
  cargarPublicacionesRecientes();
  cargarHashtags();
  
  // Configurar el visor de modal para imágenes
  configurarModalImagen();
};




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

  // Obtener contador de localStorage
  const contador = localStorage.getItem(`contador_${base}`) || 0;

  // Incrementar y guardar
  localStorage.setItem(`contador_${base}`, Number(contador) + 1);

  return `${base}${contador}`;
}


// Configuración para previsualizar y manejar imágenes
document.getElementById('imagen').addEventListener('change', function(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  
  // Validar tamaño (máx 2MB)
  if (archivo.size > 2 * 1024 * 1024) {
    alert('La imagen es demasiado grande. El tamaño máximo es 2MB.');
    this.value = '';
    return;
  }
  
  // Validar que sea una imagen
  if (!archivo.type.startsWith('image/')) {
    alert('El archivo seleccionado no es una imagen.');
    this.value = '';
    return;
  }
  
  // Almacenar la imagen seleccionada
  imagenSeleccionada = archivo;
  
  // Mostrar vista previa
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

// Función para remover la imagen seleccionada
function removerImagen() {
  document.getElementById('imagen').value = '';
  document.getElementById('imagen-preview').innerHTML = '';
  imagenSeleccionada = null;
}

// Configurar el modal para ver imágenes ampliadas
function configurarModalImagen() {
  // Crear el modal si no existe
  if (!document.querySelector('.imagen-modal')) {
    const modal = document.createElement('div');
    modal.className = 'imagen-modal';
    modal.innerHTML = `
      <div class="cerrar-modal">✕</div>
      <div class="imagen-modal-contenido">
        <img src="" alt="Imagen ampliada">
      </div>
    `;
    document.body.appendChild(modal);
    
    // Evento para cerrar el modal al hacer clic
    modal.addEventListener('click', function() {
      this.style.display = 'none';
    });
  }
}

// Función para abrir el modal con una imagen
function abrirImagenModal(src) {
  const modal = document.querySelector('.imagen-modal');
  const img = modal.querySelector('img');
  img.src = src;
  modal.style.display = 'flex';
}

// Función para crear reproductores de video basados en la plataforma
function crearReproductorVideo(videoInfo) {
  if (!videoInfo || !videoInfo.plataforma) return '';
  
  let reproductorHTML = '';
  
  switch(videoInfo.plataforma) {
    case 'youtube':
      reproductorHTML = `
        <div class="video-contenedor">
          <iframe 
            width="100%" 
            height="315" 
            src="https://www.youtube.com/embed/${videoInfo.videoId}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen
            loading="lazy"
          ></iframe>
        </div>
      `;
      break;
      
    case 'vimeo':
      reproductorHTML = `
        <div class="video-contenedor">
          <iframe 
            width="100%" 
            height="315" 
            src="https://player.vimeo.com/video/${videoInfo.videoId}" 
            frameborder="0" 
            allow="autoplay; fullscreen; picture-in-picture" 
            allowfullscreen
            loading="lazy"
          ></iframe>
        </div>
      `;
      break;
      
    default:
      // Si es una plataforma no soportada, mostrar un enlace
      reproductorHTML = `
        <div class="video-enlace">
          <a href="${videoInfo.urlOriginal}" target="_blank" rel="noopener noreferrer">
            Ver video en sitio original 🎬
          </a>
        </div>
      `;
  }
  
  return reproductorHTML;
}

// Manejar el sistema de votos
function gestionarVotos() {
  // Guardar estado de votos en localStorage
  const votesState = JSON.parse(localStorage.getItem('votesState') || '{}');
  
  // Función para manejar votos en publicaciones principales
  function manejarVoto(id, tipo, elemento) {
    const voteKey = `pub_${id}_${tipo}`;
    
    // Verificar si ya votó
    if (votesState[voteKey]) {
      alert('Ya has votado en esta publicación');
      return;
    }
    
    // Enviar voto al servidor
    fetch(`/api/publicaciones/${id}/voto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo })
    })
    .then(res => res.json())
    .then(data => {
      // Actualizar contadores en la UI
      const publicacion = document.querySelector(`#pub-${id}`);
      publicacion.querySelector(`.contador-${tipo}`).textContent = data[`${tipo}s`];
      
      // Marcar este botón como "voted"
      elemento.classList.add('voted');
      
      // Guardar estado del voto
      votesState[voteKey] = true;
      localStorage.setItem('votesState', JSON.stringify(votesState));
      
      // Desactivar ambos botones de voto
      publicacion.querySelector(`.btn-like`).disabled = true;
      publicacion.querySelector(`.btn-dislike`).disabled = true;
    });
  }
  
  // Función para manejar votos en respuestas
  function manejarVotoRespuesta(pubId, respuestaIndex, tipo, elemento) {
    const voteKey = `resp_${pubId}_${respuestaIndex}_${tipo}`;
    
    // Verificar si ya votó
    if (votesState[voteKey]) {
      alert('Ya has votado en esta respuesta');
      return;
    }
    
    // Enviar voto al servidor
    fetch(`/api/publicaciones/${pubId}/respuesta/${respuestaIndex}/voto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo })
    })
    .then(res => res.json())
    .then(data => {
      // Actualizar contadores en la UI
      const respuesta = document.querySelector(`#resp-${pubId}-${respuestaIndex}`);
      respuesta.querySelector(`.contador-${tipo}`).textContent = data[`${tipo}s`];
      
      // Marcar este botón como "voted"
      elemento.classList.add('voted');
      
      // Guardar estado del voto
      votesState[voteKey] = true;
      localStorage.setItem('votesState', JSON.stringify(votesState));
      
      // Desactivar ambos botones de voto
      respuesta.querySelector(`.btn-like`).disabled = true;
      respuesta.querySelector(`.btn-dislike`).disabled = true;
    });
  }
  
  // Configurar listeners para botones de voto
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
  
  // Verificar y marcar botones que ya fueron votados
  document.querySelectorAll('.btn-like, .btn-dislike').forEach(btn => {
    const tipo = btn.classList.contains('btn-like') ? 'like' : 'dislike';
    const pubId = btn.getAttribute('data-pub-id');
    const respIndex = btn.getAttribute('data-resp-index');
    
    let voteKey;
    if (respIndex !== null) {
      voteKey = `resp_${pubId}_${respIndex}_${tipo}`;
    } else {
      voteKey = `pub_${pubId}_${tipo}`;
    }
    
    if (votesState[voteKey]) {
      btn.classList.add('voted');
      
      // Desactivar ambos botones
      const container = respIndex !== null ? 
        document.querySelector(`#resp-${pubId}-${respIndex}`) : 
        document.querySelector(`#pub-${pubId}`);
      
      if (container) {
        container.querySelector('.btn-like').disabled = true;
        container.querySelector('.btn-dislike').disabled = true;
      }
    }
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
  cargarPublicacionesOrdenadasPorVotos();
}

async function cargarPublicacionesOrdenadasPorVotos() {
  const res = await fetch('/api/publicaciones/mas-votadas');
  const publicaciones = await res.json();
  mostrarPublicaciones(publicaciones);
}


async function cargarPublicaciones() {
  let url = '/api/publicaciones';
  if (hashtagActual) {
    url += `?hashtag=${hashtagActual}`;
  }

  const res = await fetch(url);
  const publicaciones = await res.json();
  const contenedor = document.getElementById('publicaciones');
  contenedor.innerHTML = '';

  if (publicaciones.length === 0) {
    contenedor.innerHTML = '<div class="publicacion">No hay publicaciones con este hashtag.</div>';
    return;
  }

  publicaciones.reverse().forEach((pub, index) => {
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
        <div class="publicacion-estrellas">
          ⭐ Promedio: ${promedioEstrellas} / 5
          <br>
          <span class="votar-estrellas" data-id="${pub.id}">
            Calificar:
            ${
              (() => {
                const key = `votado_estrellas_${pub.id}`;
                const puntuacion = localStorage.getItem(key) ? parseInt(localStorage.getItem(key)) : 0;
                return [1, 2, 3, 4, 5].map(i =>
                  `<span class="estrella ${i <= puntuacion ? 'votada' : ''}" data-id="${pub.id}" data-score="${i}">★</span>`
                ).join('');
              })()
            }
          </span>

        </div>
        <button class="btn-responder" onclick="mostrarFormularioRespuesta(${pub.id})">Responder</button>
      </div>
    `;

    div.innerHTML = `
      <strong>${pub.nombre}</strong><br>
      ${mensajeConHashtags}<br>
      ${videoHTML}
      ${imagenHTML}
      <small>${new Date(pub.fecha).toLocaleString()}</small><br>
      ${votosHTML}
      <div id="respuestas-${pub.id}">
        ${pub.replicas?.map((rep, repIndex) => {
          const repMensajeConHashtags = procesarHashtags(rep.mensaje);

          const repImagenHTML = rep.imagen ?
            `<div class="respuesta-imagen">
               <img src="${rep.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${rep.imagen}')">
             </div>` : '';

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
          <label for="imagen-rep-${pub.id}" class="btn-imagen">📷 Añadir imagen (máx 2MB)</label>
          <div id="imagen-preview-rep-${pub.id}"></div>
        </div>

        <button class="btn btn-primary" onclick="enviarRespuesta(${pub.id})">Enviar respuesta</button>
      </div>
    `;

    contenedor.appendChild(div);

    const inputImagen = document.getElementById(`imagen-rep-${pub.id}`);
    if (inputImagen) {
      inputImagen.addEventListener('change', function (e) {
        manejarImagenRespuesta(e, pub.id);
      });
    }
  });

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

    const key = `votado_estrellas_${pubId}`;
    if (localStorage.getItem(key)) {
      alert('Ya calificaste esta publicación.');
      return;
    }

    await fetch(`/api/publicaciones/${pubId}/estrella`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor })
    });

    localStorage.setItem(key, valor);
    alert('¡Gracias por tu puntuación!');
    actualizarEstrellas(pubId, valor);

  });
});

}


// Función para manejar la imagen en las respuestas
function manejarImagenRespuesta(e, pubId) {
  const archivo = e.target.files[0];
  if (!archivo) return;
  
  // Validar tamaño (máx 2MB)
  if (archivo.size > 2 * 1024 * 1024) {
    alert('La imagen es demasiado grande. El tamaño máximo es 2MB.');
    e.target.value = '';
    return;
  }
  
  // Validar que sea una imagen
  if (!archivo.type.startsWith('image/')) {
    alert('El archivo seleccionado no es una imagen.');
    e.target.value = '';
    return;
  }
  
  // Mostrar vista previa
  const reader = new FileReader();
  reader.onload = function(event) {
    const preview = document.getElementById(`imagen-preview-rep-${pubId}`);
    preview.innerHTML = `
      <div class="imagen-preview">
        <img src="${event.target.result}" alt="Vista previa">
        <div class="remover-imagen" onclick="removerImagenRespuesta(${pubId})">✕</div>
      </div>
    `;
  };
  reader.readAsDataURL(archivo);
}

// Función para quitar la imagen de respuesta
function removerImagenRespuesta(pubId) {
  document.getElementById(`imagen-rep-${pubId}`).value = '';
  document.getElementById(`imagen-preview-rep-${pubId}`).innerHTML = '';
}

// Función para convertir hashtags en enlaces clicables
function procesarHashtags(texto) {
  return texto.replace(/#(\w+)/g, '<span class="hashtag" data-hashtag="$1">#$1</span>');
}

// Cargar hashtags disponibles
async function cargarHashtags() {
  const res = await fetch('/api/hashtags');
  const hashtags = await res.json();
  const contenedor = document.getElementById('hashtags-container');
  
  // Mantener el botón "Todos" y agregar los hashtags
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
  
  // Añadir event listeners a los hashtags
  document.querySelectorAll('.hashtag-pill').forEach(pill => {
    pill.addEventListener('click', function() {
      const hashtag = this.getAttribute('data-hashtag');
      filtrarPorHashtag(hashtag);
    });
  });
  
  // Marcar el hashtag activo
  actualizarHashtagsActivos();
}

function filtrarPorHashtag(hashtag) {
  hashtagActual = hashtag;
  
  // Mostrar u ocultar el indicador de filtro activo
  const filtroActivo = document.getElementById('filtro-activo');
  if (hashtag) {
    document.getElementById('hashtag-actual').textContent = '#' + hashtag;
    filtroActivo.style.display = 'flex';
  } else {
    filtroActivo.style.display = 'none';
  }
  
  // Actualizar la UI
  actualizarHashtagsActivos();
  cargarPublicaciones();
}

// Marcar visualmente el hashtag activo
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
  if (!nombre) {
    nombre = generarNombrePorDefecto(genero);
  }

  const mensaje = document.getElementById(`mensaje-rep-${id}`).value.trim();
  const imagenInput = document.getElementById(`imagen-rep-${id}`);
  
  if (!mensaje) return;
  
  // Crear un objeto FormData para enviar la imagen
  const formData = new FormData();
  formData.append('respuestaA', id);
  formData.append('nombre', nombre);
  formData.append('mensaje', mensaje);
  formData.append('genero', genero);
  
  // Añadir la imagen si existe
  if (imagenInput.files[0]) {
    formData.append('imagen', imagenInput.files[0]);
  }
  
  // Enviar la respuesta con FormData
  await fetch('/api/publicaciones', {
    method: 'POST',
    body: formData
  });
  
  // Ocultar el formulario de respuesta
  document.getElementById(`form-respuesta-${id}`).style.display = 'none';
  
  // Limpiar campos del formulario
  document.getElementById(`nombre-rep-${id}`).value = '';
  document.getElementById(`mensaje-rep-${id}`).value = '';
  removerImagenRespuesta(id);
  
  // Recargar publicaciones para mostrar la nueva respuesta
  setTimeout(() => {
    cargarPublicaciones();
  }, 100);
}

// Manejo del formulario principal
document.getElementById('form-publicacion').addEventListener('submit', async function (e) {
  e.preventDefault();

  const genero = document.getElementById('genero')?.value || '';
  let nombre = document.getElementById('nombre').value.trim();
  if (!nombre) {
    nombre = generarNombrePorDefecto(genero);
  }

  const mensaje = document.getElementById('mensaje').value.trim();
  if (!mensaje) return;

  // Crear el objeto FormData antes de usarlo
  const formData = new FormData();
  formData.append('nombre', nombre);
  formData.append('mensaje', mensaje);
  formData.append('genero', genero);

  if (imagenSeleccionada) {
    formData.append('imagen', imagenSeleccionada);
  }
  
  // Enviar la publicación con FormData
  await fetch('/api/publicaciones', {
    method: 'POST',
    body: formData
  });

  // Limpiar campos del formulario
  document.getElementById('nombre').value = '';
  document.getElementById('mensaje').value = '';
  removerImagen();

  // Actualizar hashtags y publicaciones
  setTimeout(() => {
    cargarHashtags();
    cargarPublicaciones();
  }, 100);
});

// Evento para quitar el filtro
document.getElementById('quitar-filtro').addEventListener('click', function() {
  filtrarPorHashtag('');
});

// Nueva función para ver comentarios
async function verComentarios(id) {
  // Guardar el estado actual
  localStorage.setItem('vistaAnterior', JSON.stringify({
    hashtagActual,
    scrollPos: window.scrollY
  }));
  
  // Obtener la publicación específica
  const res = await fetch(`/api/publicaciones/${id}`);
  const publicacion = await res.json();
  
  const contenedor = document.getElementById('publicaciones');
  const seccionPublicaciones = document.querySelector('.publicaciones');
  const filtros = document.querySelector('.filtros');
  const nuevaPublicacion = document.querySelector('.nueva-publicacion');
  
  // Ocultar secciones innecesarias
  filtros.style.display = 'none';
  nuevaPublicacion.style.display = 'none';
  
  // Cambiar el título de la sección
  seccionPublicaciones.querySelector('.section-title').innerHTML = `
    <button onclick="volverListado()" class="btn-volver">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Volver
    </button>
    <span>Publicación y comentarios</span>
  `;
  
  // Ocultar los tabs
  document.querySelector('.tabs').style.display = 'none';
  
  // Mostrar solo esta publicación con sus comentarios
  contenedor.innerHTML = '';
  mostrarPublicacionDetallada(publicacion, contenedor);
}

// Función para mostrar una publicación con todos sus detalles
function mostrarPublicacionDetallada(pub, contenedor) {
  const div = document.createElement('div');
  div.className = 'publicacion publicacion-detallada';
  div.classList.add(`genero-${pub.genero || 'otro'}`);
  div.id = `pub-${pub.id}`;

  const mensajeConHashtags = procesarHashtags(pub.mensaje);

  const imagenHTML = pub.imagen ?
    `<div class="publicacion-imagen">
       <img src="${pub.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${pub.imagen}')">
     </div>` : '';

  const videoHTML = pub.video ? crearReproductorVideo(pub.video) : '';

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
    </div>
    
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

        <button class="btn btn-primary" onclick="enviarRespuesta(${pub.id})">Enviar respuesta</button>
      </div>
      
      <div id="respuestas-${pub.id}" class="respuestas-detalladas">
        ${pub.replicas?.length ? '' : '<p class="sin-comentarios">Aún no hay comentarios. ¡Sé el primero en responder!</p>'}
        ${pub.replicas?.map((rep, repIndex) => {
          const repMensajeConHashtags = procesarHashtags(rep.mensaje);

          const repImagenHTML = rep.imagen ?
            `<div class="respuesta-imagen">
               <img src="${rep.imagen}" alt="Imagen adjunta" onclick="abrirImagenModal('${rep.imagen}')">
             </div>` : '';

          const repVideoHTML = rep.video ? crearReproductorVideo(rep.video) : '';

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
  `;

  contenedor.appendChild(div);

  const inputImagen = document.getElementById(`imagen-rep-${pub.id}`);
  if (inputImagen) {
    inputImagen.addEventListener('change', function (e) {
      manejarImagenRespuesta(e, pub.id);
    });
  }

  document.querySelectorAll('.hashtag').forEach(tag => {
    tag.addEventListener('click', function () {
      const hashtag = this.getAttribute('data-hashtag');
      filtrarPorHashtag(hashtag);
    });
  });

  gestionarVotos();
}

// Función para volver al listado principal
function volverListado() {
  // Restaurar las secciones ocultas
  document.querySelector('.filtros').style.display = 'block';
  document.querySelector('.nueva-publicacion').style.display = 'block';
  document.querySelector('.tabs').style.display = 'flex';
  
  // Restaurar el título original
  document.querySelector('.publicaciones .section-title').textContent = '📄 Publicaciones recientes';
  
  // Recuperar el estado anterior
  const estadoAnterior = JSON.parse(localStorage.getItem('vistaAnterior') || '{"hashtagActual":"","scrollPos":0}');
  hashtagActual = estadoAnterior.hashtagActual;
  
  // Actualizar la UI basada en el hashtag
  actualizarHashtagsActivos();
  
  // Recargar publicaciones
  cargarPublicaciones().then(() => {
    // Restaurar la posición del scroll
    setTimeout(() => {
      window.scrollTo(0, estadoAnterior.scrollPos);
    }, 100);
  });
}

function actualizarEstrellas(pubId, puntuacion) {
  const estrellas = document.querySelectorAll(`.estrella[data-id="${pubId}"]`);
  estrellas.forEach(e => {
    const score = parseInt(e.dataset.score);
    e.classList.toggle('votada', score <= puntuacion);
  });

  function actualizarContador() {
  const mensaje = document.getElementById('mensaje');
  const contador = document.getElementById('contador-caracteres');
  contador.textContent = `${mensaje.value.length} / 300`;
}
}


// Ejemplo de cómo integrar las animaciones GSAP en tu script.js existente

// En tu función de agregar nueva publicación:
function agregarPublicacion(datos) {
    // Tu código existente para crear la publicación...
    const nuevaPublicacion = crearElementoPublicacion(datos);
    contenedorPublicaciones.appendChild(nuevaPublicacion);
    
    // Animar la nueva publicación
    if (window.forumAnimations) {
        forumAnimations.animateNewPost(nuevaPublicacion);
    }
    
    // Actualizar hover animations para el nuevo elemento
    if (window.forumAnimations) {
        forumAnimations.setupHoverAnimations();
    }
}

// En tu función de agregar respuesta:
function agregarRespuesta(respuestaData, publicacionId) {
    // Tu código existente...
    const nuevaRespuesta = crearElementoRespuesta(respuestaData);
    contenedorRespuestas.appendChild(nuevaRespuesta);
    
    // Animar la nueva respuesta
    if (window.forumAnimations) {
        forumAnimations.animateNewReply(nuevaRespuesta);
    }
}

// En tu sistema de votación por estrellas:
function manejarVotacionEstrellas(estrellas, rating) {
    // Tu lógica de votación...
    
    // Animar las estrellas
    if (window.forumAnimations) {
        forumAnimations.animateStarRating(estrellas, rating);
    }
}

// En tus event listeners de botones:
document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-primary, .btn-outline, .btn-responder')) {
        // Animar click del botón
        if (window.forumAnimations) {
            forumAnimations.animateButtonClick(e.target);
        }
    }
    
    // Tu código existente para manejar clicks...
});

// Para el modal de imágenes:
function abrirModalImagen(src) {
    const modal = document.getElementById('imagen-modal');
    // Tu código existente...
    
    // Animar apertura del modal
    if (window.forumAnimations) {
        forumAnimations.animateImageModal(modal);
    }
}

function cerrarModalImagen() {
    const modal = document.getElementById('imagen-modal');
    
    if (window.forumAnimations) {
        forumAnimations.closeImageModal(modal);
    } else {
        // Fallback sin animación
        modal.style.display = 'none';
    }
}

// Para filtros activos:
function aplicarFiltro(filtro) {
    // Tu lógica de filtrado...
    
    const filtroActivo = document.querySelector('.filtro-activo');
    if (filtroActivo && window.forumAnimations) {
        forumAnimations.animateActiveFilter(filtroActivo);
    }
}

// Para hashtags:
function seleccionarHashtag(hashtagElement) {
    // Tu lógica existente...
    
    if (window.forumAnimations) {
        forumAnimations.animateHashtagSelection(hashtagElement);
    }
}

