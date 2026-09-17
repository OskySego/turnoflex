import fs from 'fs';
import path from 'path';

export class JsonRepository {
  /**
   * @param {string} relativePath - Ruta relativa del archivo JSON desde la raíz del proyecto.
   */
  constructor(relativePath = 'data/turnoflex.json') {
    this.filePath = path.resolve(process.cwd(), relativePath);
  }

  /**
   * Lee el archivo JSON completo de forma síncrona.
   * @returns {Object} El objeto JS deserializado.
   */
  _readData() {
    try {
      if (!fs.existsSync(this.filePath)) {
        throw new Error(`El archivo de base de datos no existe en: ${this.filePath}`);
      }
      const rawData = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(rawData);
    } catch (error) {
      console.error(`[JsonRepository Error] Error al leer los datos: ${error.message}`);
      throw new Error('Error interno al acceder a la base de datos.');
    }
  }

  /**
   * Escribe el objeto estructurado de vuelta al archivo JSON.
   * @param {Object} data - Objeto completo a serializar y guardar.
   */
  _writeData(data) {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      fs.writeFileSync(this.filePath, jsonString, 'utf-8');
    } catch (error) {
      console.error(`[JsonRepository Error] Error al escribir datos: ${error.message}`);
      throw new Error('Error interno al guardar cambios en la base de datos.');
    }
  }
}