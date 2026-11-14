function validarDominio(dominio) {
  const valor = String(dominio ?? '')
    .trim()
    .toLowerCase();

  const patron =
    /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

  if (!patron.test(valor)) {
    throw new Error(
      'Configurá un dominio institucional válido.'
    );
  }

  return valor;
}

// Normalizar el nombre del profesional.
function limpiarNombre(nombre) {
  const texto = String(nombre ?? '')
    .trim()
    .replace(
      /^(?:(?:dr|dra|lic|prof)\.?\s+)+/i,
      ''
    )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const palabras = texto
    ? texto.split(/\s+/)
    : [];

  if (palabras.length < 2) {
    throw new Error(
      'Ingresá nombre y apellido del profesional.'
    );
  }

  return {
    nombre: palabras[0].slice(0, 24),
    apellido: palabras[palabras.length - 1].slice(0, 24)
  };
}

// Validar y normalizar el correo particular.
export function normalizarCorreoParticular(correo) {
  const valor = String(correo ?? '')
    .trim()
    .toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) ||
    valor.length > 254
  ) {
    throw new Error(
      'Ingresá un correo particular válido.'
    );
  }

  return valor;
}

// Generar la primera dirección institucional.
export function generarCorreoInstitucional(
  nombreCompleto,
  dominio
) {
  const dominioValidado = validarDominio(dominio);
  const partes = limpiarNombre(nombreCompleto);

  return (
    `${partes.nombre}.${partes.apellido}` +
    `@${dominioValidado}`
  );
}

// Buscar una dirección que no esté ocupada.
//
// existeCorreo debe comprobar tanto MongoDB como
// el proveedor institucional antes de crear el buzón.
export async function generarCorreoInstitucionalDisponible({
  nombreCompleto,
  dominio,
  existeCorreo
}) {
  if (typeof existeCorreo !== 'function') {
    throw new Error(
      'Falta la función que comprueba direcciones ocupadas.'
    );
  }

  const base = generarCorreoInstitucional(
    nombreCompleto,
    dominio
  );

  const [alias, dominioValidado] = base.split('@');

  for (let numero = 1; numero <= 1000; numero++) {
    const sufijo = numero === 1
      ? ''
      : `.${numero}`;

    const candidato =
      `${alias}${sufijo}@${dominioValidado}`;

    const ocupado = await existeCorreo(candidato);

    if (!ocupado) {
      return candidato;
    }
  }

  throw new Error(
    'No hay una dirección institucional disponible.'
  );
}