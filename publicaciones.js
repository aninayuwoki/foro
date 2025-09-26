const { Octokit } = require('@octokit/rest');
const path = require('path');

// --- Configuración de GitHub ---
// Es IMPERATIVO usar variables de entorno para estos valores en producción.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const FILE_PATH = 'data/publicaciones.json';

// --- Instancia de Octokit ---
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// --- Funciones para interactuar con la API de GitHub ---

/**
 * Obtiene el contenido del archivo de publicaciones desde GitHub.
 * @returns {Promise<{data: Array, sha: string}>} - Un objeto con los datos y el SHA del archivo.
 */
async function getPublicaciones() {
  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: FILE_PATH,
    });

    // El contenido viene en base64, hay que decodificarlo
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

    return {
      data: JSON.parse(content),
      sha: response.data.sha, // El SHA es necesario para poder actualizar el archivo
    };
  } catch (error) {
    // Si el archivo no existe (error 404), lo tratamos como una base de datos vacía.
    if (error.status === 404) {
      console.log('El archivo de publicaciones no existe en el repositorio. Se creará uno nuevo.');
      return { data: [], sha: null }; // No hay SHA si el archivo no existe
    }
    // Si es otro tipo de error, lo lanzamos para que sea manejado más arriba.
    console.error('Error al obtener publicaciones desde GitHub:', error);
    throw new Error('No se pudieron obtener las publicaciones desde GitHub.');
  }
}

/**
 * Actualiza el archivo de publicaciones en GitHub.
 * @param {Array} data - El nuevo array de publicaciones a guardar.
 * @param {string} sha - El SHA del archivo que se va a actualizar. Si es null, se crea un nuevo archivo.
 */
async function updatePublicaciones(data, sha) {
  try {
    // Convertir los datos a formato JSON y luego a base64
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

    const message = sha
      ? 'Actualiza publicaciones'
      : 'Crea archivo de publicaciones';

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: FILE_PATH,
      message: `${message} - ${new Date().toISOString()}`,
      content: content,
      sha: sha, // Si sha es null, Octokit crea el archivo. Si tiene valor, lo actualiza.
    });

  } catch (error) {
    console.error('Error al actualizar publicaciones en GitHub:', error);
    throw new Error('No se pudieron guardar los cambios en GitHub.');
  }
}

/**
 * Sube una imagen a la carpeta public/uploads en GitHub.
 * @param {object} file - El objeto de archivo de multer (req.file).
 * @returns {Promise<string>} - La ruta de la imagen en el repositorio.
 */
async function uploadImage(file) {
  if (!file) {
    throw new Error('No se proporcionó ningún archivo para subir.');
  }

  try {
    // Generar un nombre de archivo único
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const fileName = `${uniqueSuffix}${ext}`;
    const filePath = `public/uploads/${fileName}`;

    // Convertir el buffer del archivo a base64 de forma explícita para evitar corrupción
    const content = Buffer.from(file.buffer).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Carga de imagen: ${fileName} - ${new Date().toISOString()}`,
      content: content,
    });

    // Devolver la ruta relativa para guardarla en publicaciones.json
    return `/uploads/${fileName}`;
  } catch (error) {
    console.error('Error al subir la imagen a GitHub:', error);
    throw new Error('No se pudo subir la imagen a GitHub.');
  }
}

module.exports = {
  getPublicaciones,
  updatePublicaciones,
  uploadImage,
};