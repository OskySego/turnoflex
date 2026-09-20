import { JsonRepository } from './JsonRepository.js';

export class ClienteModel extends JsonRepository {
  constructor() {
    super();
    this.collectionKey = 'clientes'; 
  }

  findAll() {
    const data = this._readData();
    return data[this.collectionKey] || [];
  }

  findById(id) {
    const data = this._readData();
    return (data[this.collectionKey] || []).find((c) => c.id === id) || null;
  }

  create(newData) {
    const data = this._readData();
    const nuevoCliente = {
      id: `cli-${Date.now()}`, 
      nombre: newData.nombre,
      email: newData.email,
      telefono: newData.telefono
    };
    data[this.collectionKey].push(nuevoCliente);
    this._writeData(data);
    return nuevoCliente;
  }

  update(id, nuevosDatos) {
    const data = this._readData();
    const index = data[this.collectionKey].findIndex((c) => c.id === id);
    if (index === -1) return null;

    data[this.collectionKey][index] = {
      ...data[this.collectionKey][index],
      ...nuevosDatos,
      id
    };
    this._writeData(data);
    return data[this.collectionKey][index];
  }

  delete(id) {
    const data = this._readData();
    const index = data[this.collectionKey].findIndex((c) => c.id === id);
    if (index === -1) return false;

    data[this.collectionKey].splice(index, 1);
    this._writeData(data);
    return true;
  }
}