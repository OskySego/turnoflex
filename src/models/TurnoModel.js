import { JsonRepository } from './JsonRepository.js';

export class TurnoModel extends JsonRepository {
  constructor() {
    super();
    this.collectionKey = 'turnos';
  }

  /**
   * Retorna todos los turnos almacenados.
   * @returns {Array}
   */
  findAll() {
    const data = this._readData();
    return data[this.collectionKey] || [];
  }

  /**
   * Busca un turno por su ID único y opcionalmente pobla los objetos de usuario y profesional.
   * @param {string} id - ID del turno.
   * @returns {Object|null}
   */
  findById(id) {
    const data = this._readData();
    const turno = (data[this.collectionKey] || []).find((t) => t.id === id);

    if (!turno) return null;

    // Resolver relaciones de clave foránea
    const usuario = (data.usuarios || []).find((u) => u.id === turno.usuario_id) || null;
    const profesional = (data.profesionales || []).find((p) => p.id === turno.profesional_id) || null;

    return {
      ...turno,
      usuario,
      profesional
    };
  }

  /**
   * Crea y guarda un nuevo turno en la base JSON.
   * @param {Object} newTurnoData - Objeto con usuario_id, profesional_id, fecha, hora.
   * @returns {Object} El turno recién creado.
   */
  create(newTurnoData) {
    const data = this._readData();
    
    // Regla de negocio: Verificar no superposición de turnos para el profesional
    const existeSuperposicion = data.turnos.some(
      (t) =>
        t.profesional_id === newTurnoData.profesional_id &&
        t.fecha === newTurnoData.fecha &&
        t.hora === newTurnoData.hora &&
        t.estado !== 'cancelado'
    );

    if (existeSuperposicion) {
      throw new Error('El profesional ya posee un turno reservado en la fecha y hora seleccionadas.');
    }

    const newTurno = {
      id: `trn-${Date.now()}`,
      usuario_id: newTurnoData.usuario_id,
      profesional_id: newTurnoData.profesional_id,
      fecha: newTurnoData.fecha,
      hora: newTurnoData.hora,
      estado: newTurnoData.estado || 'reservado'
    };

    data[this.collectionKey].push(newTurno);
    this._writeData(data);

    return newTurno;
  }

  /**
   * Actualiza el estado de un turno (ej. reservado, atendido, cancelado).
   * @param {string} id 
   * @param {string} nuevoEstado 
   * @returns {Object|null}
   */
  updateEstado(id, nuevoEstado) {
    const data = this._readData();
    const index = data[this.collectionKey].findIndex((t) => t.id === id);

    if (index === -1) return null;

    data[this.collectionKey][index].estado = nuevoEstado;
    this._writeData(data);

    return data[this.collectionKey][index];
  }
}