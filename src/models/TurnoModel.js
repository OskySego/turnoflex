import { JsonRepository } from './JsonRepository.js';

export class TurnoModel extends JsonRepository {
  constructor() {
    super();
    this.collectionKey = 'turnos';
  }

  /**
   * Retorna todos los turnos almacenados
   * incluyendo los datos del usuario y profesional relacionados.
   * @returns {Array}
   */
  findAll() {
    const data = this._readData();
    const turnos = data[this.collectionKey] || [];

    return turnos.map((turno) => {
      const cliente =
        (data.clientes || []).find(
          (c) => c.id === turno.cliente_id
        ) || null;

      const profesional =
        (data.profesionales || []).find(
          (p) => p.id === turno.profesional_id
        ) || null;

      return {
        ...turno,
        cliente,
        profesional
      };
    });
  }

  /**
   * Busca un turno por su ID único y opcionalmente
   * pobla los objetos de usuario y profesional.
   * @param {string} id - ID del turno.
   * @returns {Object|null}
   */
  findById(id) {
    const data = this._readData();

    const turno = (data[this.collectionKey] || []).find(
      (t) => t.id === id
    );

    if (!turno) return null;

    const cliente =
      (data.clientes || []).find(
        (c) => c.id === turno.cliente_id
      ) || null;

    const profesional =
      (data.profesionales || []).find(
        (p) => p.id === turno.profesional_id
      ) || null;

    return {
      ...turno,
      cliente,
      profesional
    };
  }

  /**
   * Crea y guarda un nuevo turno en la base JSON.
   * @param {Object} newTurnoData
   * @returns {Object}
   */
  create(newTurnoData) {
    const data = this._readData();

    const existeSuperposicion = data.turnos.some(
      (t) =>
        t.profesional_id === newTurnoData.profesional_id &&
        t.fecha === newTurnoData.fecha &&
        t.hora === newTurnoData.hora &&
        t.estado !== 'cancelado'
    );

    if (existeSuperposicion) {
      throw new Error(
        'El profesional ya posee un turno reservado en la fecha y hora seleccionadas.'
      );
    }

    const newTurno = {
      id: `trn-${Date.now()}`,
      cliente_id: newTurnoData.cliente_id,
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
   * Actualiza el estado de un turno.
   * @param {string} id
   * @param {string} nuevoEstado
   * @returns {Object|null}
   */
  updateEstado(id, nuevoEstado) {
    const data = this._readData();

    const index = data[this.collectionKey].findIndex(
      (t) => t.id === id
    );

    if (index === -1) return null;

    data[this.collectionKey][index].estado = nuevoEstado;

    this._writeData(data);

    return data[this.collectionKey][index];
  }
}