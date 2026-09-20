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
   * Crea y guarda un nuevo turno en la base JSON con ID secuencial de 3 cifras.
   * @param {Object} newTurnoData
   * @returns {Object}
   */
  create(newTurnoData) {
    const data = this._readData();
    const turnos = data[this.collectionKey] || [];

    // Validar superposición de horarios
    const existeSuperposicion = turnos.some(
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

    // Generar ID numérico secuencial estricto de 3 cifras (ej: "001", "002", "015")
    let siguienteNumero = 1;
    if (turnos.length > 0) {
      const idsNumericos = turnos
        .map((t) => parseInt(t.id, 10))
        .filter((n) => !isNaN(n));
      
      if (idsNumericos.length > 0) {
        siguienteNumero = Math.max(...idsNumericos) + 1;
      }
    }
    const idFormateado = String(siguienteNumero).padStart(3, '0');

    // Mapear el ID del cliente (soporta cliente_id o usuario_id)
    const clienteId = newTurnoData.cliente_id || newTurnoData.usuario_id;

    const newTurno = {
      id: idFormateado,
      cliente_id: clienteId,
      profesional_id: newTurnoData.profesional_id,
      fecha: newTurnoData.fecha,
      hora: newTurnoData.hora,
      estado: newTurnoData.estado || 'reservado'
    };

    turnos.push(newTurno);
    data[this.collectionKey] = turnos;
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