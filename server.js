const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuracion inicial
app.use(express.static('public'));
app.use(express.json());

// Verificar directorios necesarios
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'publicaciones.json');

// Inicializar nueva base de datos si no existe
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
}

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function(req, file, cb) {
    // Generar nombre único para la imagen
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Filtro para validar tipos de archivo
const fileFilter = (req, file, cb) => {
  // Aceptar solo imágenes
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

// Limitar tamaño a 2MB
const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Función para extraer enlaces de video de un mensaje
function extraerEnlacesVideo(mensaje) {
  const videoInfo = {
    tieneVideo: false,
    plataforma: null,
    videoId: null,
    urlOriginal: null
  };
  
  // Regex para detectar enlaces de YouTube
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = mensaje.match(youtubeRegex);
  
  if (youtubeMatch) {
    videoInfo.tieneVideo = true;
    videoInfo.plataforma = 'youtube';
    videoInfo.videoId = youtubeMatch[1];
    videoInfo.urlOriginal = youtubeMatch[0];
    return videoInfo;
  }
  
  // Regex para Vimeo (ejemplo: https://vimeo.com/123456789)
  const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
  const vimeoMatch = mensaje.match(vimeoRegex);
  
  if (vimeoMatch) {
    videoInfo.tieneVideo = true;
    videoInfo.plataforma = 'vimeo';
    videoInfo.videoId = vimeoMatch[1];
    videoInfo.urlOriginal = vimeoMatch[0];
    return videoInfo;
  }
  
  // Ampliar aquí para más plataformas si es necesario
  
  return videoInfo;
}

// Obtener todas las publicaciones
// Obtener todas las publicaciones
app.get('/api/publicaciones', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    
    // Si hay un parámetro de hashtag, filtrar las publicaciones
    const hashtag = req.query.hashtag;
    if (hashtag) {
      const filtradas = data.filter(pub => {
        return pub.mensaje.toLowerCase().includes('#' + hashtag.toLowerCase());
      });
      return res.json(filtradas);
    }

    // Si no hay hashtag, devolver todas
    res.json(data);
  } catch (error) {
    console.error('Error al leer publicaciones:', error);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

// Obtener publicaciones ordenadas por votos (más votadas)
app.get('/api/publicaciones/mas-votadas', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const ordenadas = data.slice().sort((a, b) => {
      const votosA = (a.likes || 0) - (a.dislikes || 0);
      const votosB = (b.likes || 0) - (b.dislikes || 0);

      if (votosB !== votosA) {
        return votosB - votosA; // Ordena por score descendente
      }

      // Si empate en votos, ordena por fecha más reciente
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      return fechaB - fechaA;
    });
    res.json(ordenadas);
  } catch (error) {
    console.error('Error al obtener publicaciones más votadas:', error);
    res.status(500).json({ error: 'Error al obtener publicaciones más votadas' });
  }
});

// Agregar puntuación con estrellas a una publicación
app.post('/api/publicaciones/:id/estrella', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const id = parseInt(req.params.id);
    const { valor } = req.body; // valor debe ser un número entre 1 y 5

    if (![1, 2, 3, 4, 5].includes(valor)) {
      return res.status(400).json({ error: 'Valor de estrella inválido. Debe ser entre 1 y 5.' });
    }

    const publicacion = data.find(pub => pub.id === id);
    if (!publicacion) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    // Inicializar array si no existe
    if (!Array.isArray(publicacion.estrellas)) {
      publicacion.estrellas = [];
    }

    publicacion.estrellas.push(valor);

    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    res.json({
      mensaje: 'Estrella agregada con éxito',
      total: publicacion.estrellas.length,
      promedio: (
        publicacion.estrellas.reduce((a, b) => a + b, 0) / publicacion.estrellas.length
      ).toFixed(2)
    });
  } catch (error) {
    console.error('Error al agregar estrella:', error);
    res.status(500).json({ error: 'Error al agregar la puntuación' });
  }
});


// Obtener todos los hashtags únicos
app.get('/api/hashtags', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const hashtags = new Set();
    
    // Extraer hashtags de todos los mensajes
    data.forEach(pub => {
      const matches = pub.mensaje.match(/#\w+/g);
      if (matches) {
        matches.forEach(tag => hashtags.add(tag.substring(1).toLowerCase()));
      }
    });
    
    res.json(Array.from(hashtags));
  } catch (error) {
    console.error('Error al leer hashtags:', error);
    res.status(500).json({ error: 'Error al obtener hashtags' });
  }
});

// Crear nueva publicación o responder a una existente
app.post('/api/publicaciones', upload.single('imagen'), (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const nueva = req.body;

    // Si hay imagen subida, guardar su ruta
    if (req.file) {
      nueva.imagen = `/uploads/${req.file.filename}`;
    }
    
    // Procesar el mensaje para detectar enlaces de video
    const videoInfo = extraerEnlacesVideo(nueva.mensaje);
    if (videoInfo.tieneVideo) {
      nueva.video = {
        plataforma: videoInfo.plataforma,
        videoId: videoInfo.videoId,
        urlOriginal: videoInfo.urlOriginal
      };
    }

    // Reemplaza la sección de "Nueva publicación" en tu endpoint POST /api/publicaciones
// por esta versión que incluye inicialización de emojiCounts:

if (nueva.respuestaA !== undefined) {
  // Es una réplica
  const original = data.find(pub => pub.id === parseInt(nueva.respuestaA));
  if (!original) {
    return res.status(404).json({ error: 'Publicación original no encontrada' });
  }
  original.replicas = original.replicas || [];
  
  const nuevaReplica = {
    nombre: nueva.nombre,
    mensaje: nueva.mensaje,
    fecha: new Date().toISOString(),
    imagen: nueva.imagen,
    likes: 0,
    dislikes: 0,
    genero: nueva.genero, // Asegurar que se guarde el género
    emojiCounts: {} // Inicializar contadores de emojis para respuestas
  };
  
  // Agregar información del video si existe
  if (videoInfo.tieneVideo) {
    nuevaReplica.video = nueva.video;
  }
  
  original.replicas.push(nuevaReplica);
} else {
  // Nueva publicación
  nueva.id = Date.now();
  nueva.fecha = new Date().toISOString();
  nueva.replicas = [];
  nueva.likes = 0;
  nueva.dislikes = 0;
  nueva.emojiCounts = {}; // Inicializar contadores de emojis
  
  // Extraer hashtags del mensaje
  const matches = nueva.mensaje.match(/#\w+/g);
  if (matches) {
    nueva.hashtags = matches.map(tag => tag.substring(1).toLowerCase());
  } else {
    nueva.hashtags = [];
  }
  
  data.push(nueva);
}
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    res.status(201).json({ mensaje: 'Guardado con éxito' });
  } catch (error) {
    console.error('Error al guardar publicación:', error);
    res.status(500).json({ error: 'Error al guardar la publicación' });
  }
});

// Nuevo endpoint para manejar los likes/dislikes de una publicación principal
app.post('/api/publicaciones/:id/voto', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const id = parseInt(req.params.id);
    const { tipo } = req.body; // 'like' o 'dislike'
    
    // Encontrar la publicación por ID
    const publicacion = data.find(pub => pub.id === id);
    
    if (!publicacion) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    
    // Incrementar el contador correspondiente
    if (tipo === 'like') {
      publicacion.likes = (publicacion.likes || 0) + 1;
    } else if (tipo === 'dislike') {
      publicacion.dislikes = (publicacion.dislikes || 0) + 1;
    }
    
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    res.json({ 
      likes: publicacion.likes, 
      dislikes: publicacion.dislikes 
    });
  } catch (error) {
    console.error('Error al procesar voto:', error);
    res.status(500).json({ error: 'Error al procesar el voto' });
  }
});

// Nuevo endpoint para manejar los likes/dislikes de una respuesta
app.post('/api/publicaciones/:id/respuesta/:indice/voto', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const id = parseInt(req.params.id);
    const indice = parseInt(req.params.indice);
    const { tipo } = req.body; // 'like' o 'dislike'
    
    // Encontrar la publicación principal por ID
    const publicacion = data.find(pub => pub.id === id);
    
    if (!publicacion || !publicacion.replicas || !publicacion.replicas[indice]) {
      return res.status(404).json({ error: 'Respuesta no encontrada' });
    }
    
    // Incrementar el contador correspondiente en la respuesta
    const respuesta = publicacion.replicas[indice];
    if (tipo === 'like') {
      respuesta.likes = (respuesta.likes || 0) + 1;
    } else if (tipo === 'dislike') {
      respuesta.dislikes = (respuesta.dislikes || 0) + 1;
    }
    
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    res.json({ 
      likes: respuesta.likes, 
      dislikes: respuesta.dislikes 
    });
  } catch (error) {
    console.error('Error al procesar voto en respuesta:', error);
    res.status(500).json({ error: 'Error al procesar el voto en la respuesta' });
  }
});

// Manejador de errores para la carga de archivos
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Límite: 2MB.' });
    }
    return res.status(400).json({ error: 'Error al subir el archivo.' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// En server.js (ruta sugerida)
// En server.js, el endpoint correcto debería ser:
app.get('/api/publicaciones/:id', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const publicacionId = parseInt(req.params.id);
    const publicacion = data.find(p => p.id === publicacionId);
    
    if (!publicacion) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    
    res.json(publicacion);
  } catch (error) {
    console.error('Error al obtener publicación:', error);
    res.status(500).json({ error: 'Error al obtener la publicación' });
  }
});

// Agregar estos endpoints a tu server.js después de los endpoints existentes

// Endpoint para manejar reacciones de emojis en publicaciones
app.post('/api/publicaciones/:id/emoji-reaction', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const id = parseInt(req.params.id);
    const { emoji, action } = req.body; // action: 'add' o 'remove'
    
    // Validar que el emoji esté en la lista permitida
    const EMOJIS_PERMITIDOS = ['👍', '😂', '❤️', '🤔', '😢', '😮'];
    if (!EMOJIS_PERMITIDOS.includes(emoji)) {
      return res.status(400).json({ error: 'Emoji no permitido' });
    }
    
    // Validar acción
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'Acción no válida. Use "add" o "remove"' });
    }
    
    // Encontrar la publicación por ID
    const publicacion = data.find(pub => pub.id === id);
    
    if (!publicacion) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    
    // Inicializar el objeto emojiCounts si no existe
    if (!publicacion.emojiCounts) {
      publicacion.emojiCounts = {};
    }
    
    // Inicializar el contador del emoji si no existe
    if (typeof publicacion.emojiCounts[emoji] === 'undefined') {
      publicacion.emojiCounts[emoji] = 0;
    }
    
    // Procesar la acción
    if (action === 'add') {
      publicacion.emojiCounts[emoji] += 1;
    } else if (action === 'remove') {
      publicacion.emojiCounts[emoji] = Math.max(0, publicacion.emojiCounts[emoji] - 1);
    }
    
    // Guardar los cambios
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true,
      emoji: emoji,
      count: publicacion.emojiCounts[emoji],
      action: action
    });
    
  } catch (error) {
    console.error('Error al procesar reacción de emoji:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la reacción' });
  }
});

// Endpoint para obtener las reacciones de emojis de una publicación específica
app.get('/api/publicaciones/:id/emoji-reactions', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const id = parseInt(req.params.id);
    
    const publicacion = data.find(pub => pub.id === id);
    
    if (!publicacion) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }
    
    // Devolver las reacciones de emojis o un objeto vacío si no existen
    const emojiCounts = publicacion.emojiCounts || {};
    
    res.json({
      publicacionId: id,
      emojiCounts: emojiCounts
    });
    
  } catch (error) {
    console.error('Error al obtener reacciones de emoji:', error);
    res.status(500).json({ error: 'Error al obtener las reacciones' });
  }
});

// Endpoint para manejar reacciones de emojis en respuestas/réplicas
app.post('/api/publicaciones/:id/respuesta/:indice/emoji-reaction', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const id = parseInt(req.params.id);
    const indice = parseInt(req.params.indice);
    const { emoji, action } = req.body;
    
    // Validar que el emoji esté en la lista permitida
    const EMOJIS_PERMITIDOS = ['👍', '😂', '❤️', '🤔', '😢', '😮'];
    if (!EMOJIS_PERMITIDOS.includes(emoji)) {
      return res.status(400).json({ error: 'Emoji no permitido' });
    }
    
    // Validar acción
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'Acción no válida. Use "add" o "remove"' });
    }
    
    // Encontrar la publicación principal por ID
    const publicacion = data.find(pub => pub.id === id);
    
    if (!publicacion || !publicacion.replicas || !publicacion.replicas[indice]) {
      return res.status(404).json({ error: 'Respuesta no encontrada' });
    }
    
    const respuesta = publicacion.replicas[indice];
    
    // Inicializar el objeto emojiCounts si no existe
    if (!respuesta.emojiCounts) {
      respuesta.emojiCounts = {};
    }
    
    // Inicializar el contador del emoji si no existe
    if (typeof respuesta.emojiCounts[emoji] === 'undefined') {
      respuesta.emojiCounts[emoji] = 0;
    }
    
    // Procesar la acción
    if (action === 'add') {
      respuesta.emojiCounts[emoji] += 1;
    } else if (action === 'remove') {
      respuesta.emojiCounts[emoji] = Math.max(0, respuesta.emojiCounts[emoji] - 1);
    }
    
    // Guardar los cambios
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true,
      emoji: emoji,
      count: respuesta.emojiCounts[emoji],
      action: action
    });
    
  } catch (error) {
    console.error('Error al procesar reacción de emoji en respuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la reacción' });
  }
});

// Endpoint para obtener estadísticas globales de emojis (opcional)
app.get('/api/emoji-stats', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const stats = {};
    
    // Contar emojis en publicaciones principales
    data.forEach(pub => {
      if (pub.emojiCounts) {
        Object.entries(pub.emojiCounts).forEach(([emoji, count]) => {
          stats[emoji] = (stats[emoji] || 0) + count;
        });
      }
      
      // Contar emojis en respuestas
      if (pub.replicas) {
        pub.replicas.forEach(resp => {
          if (resp.emojiCounts) {
            Object.entries(resp.emojiCounts).forEach(([emoji, count]) => {
              stats[emoji] = (stats[emoji] || 0) + count;
            });
          }
        });
      }
    });
    
    res.json({
      totalReactions: Object.values(stats).reduce((sum, count) => sum + count, 0),
      emojiStats: stats
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas de emojis:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});