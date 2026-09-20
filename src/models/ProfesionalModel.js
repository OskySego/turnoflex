import { JsonRepository } from './JsonRepository.js';

export class ProfesionalModel extends JsonRepository {
  constructor() {
    super();
    this.collectionKey = 'profesionales';
  }

  /**
   * Retorna todos los profesionales almacenados.
   * @returns {Array}
   */
  findAll() {
    const data = this._readData();
    return data[this.collectionKey] || [];
  }

  /**
   * Busca un profesional por su ID único.
   * @param {string} id - ID del profesional.
   * @returns {Object|null}
   */
  findById(id) {
    const data = this._readData();

    const profesional = (data[this.collectionKey] || []).find(
      (p) => p.id === id
    );

    return profesional || null;
  }

  /**
   * Crea y guarda un nuevo profesional.
   * @param {Object} newProfesionalData
   * @returns {Object}
   */
  create(newProfesionalData) {
    const data = this._readData();

    const newProfesional = {
      id: `prof-${Date.now()}`,
      nombre: newProfesionalData.nombre,
      especialidad: newProfesionalData.especialidad,
      dias_disponibles: newProfesionalData.dias_disponibles || [],
      horarios: newProfesionalData.horarios || []
    };

    data[this.collectionKey].push(newProfesional);
    this._writeData(data);

    return newProfesional;
  }
}