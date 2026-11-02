/* TurnoFlex - Cotización de Recepción. No almacena importes ni confirma cobros. */
(() => {
  function iniciar() {
    const form = document.getElementById('formTurno');
    const paciente = document.getElementById('selectCliente');
    const profesional = document.getElementById('selectProfesional');
    const tipo = document.getElementById('recepcionTipoCobro');
    const metodo = document.getElementById('recepcionMetodoPago');
    const verificacion = document.getElementById('recepcionVerificacion');
    const confirmado = document.getElementById('coberturaVerificada');
    const estado = document.getElementById('recepcionEstadoCotizacion');
    const base = document.getElementById('recepcionBase');
    const descuento = document.getElementById('recepcionDescuento');
    const total = document.getElementById('recepcionTotal');
    const nota = document.getElementById('recepcionNotaCotizacion');
    const boton = document.getElementById('btnSubmit');
    const textoBoton = document.getElementById('submitText');
    if (![form, paciente, profesional, tipo, metodo, verificacion, confirmado,
      estado, base, descuento, total, nota, boton].every(Boolean)) return;

    const dinero = n => new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS'
    }).format(Number(n));
    let solicitud = 0;
    let firmaCotizada = '';
    let abortador;
    let ultimoMensaje = '';

    const firma = () => [paciente.value, profesional.value, tipo.value,
      metodo.disabled ? 'efectivo' : metodo.value].join('|');

    function actualizarVerificacion() {
      const requiere = tipo.value === 'copago' || tipo.value === 'sin_cargo';
      verificacion.hidden = !requiere;
      confirmado.required = requiere;
      if (!requiere) confirmado.checked = false;
      const sinCargo = tipo.value === 'sin_cargo';
      metodo.disabled = sinCargo;
      if (sinCargo) metodo.value = 'efectivo';
    }

    function limpiar(mensaje) {
      firmaCotizada = '';
      estado.textContent = mensaje;
      base.textContent = '—';
      descuento.textContent = '—';
      total.textContent = '—';
      nota.textContent = 'El servidor verificará nuevamente los aranceles al confirmar.';
      if (textoBoton && !boton.disabled) textoBoton.textContent = 'Confirmar turno';
    }

    async function cotizar() {
      actualizarVerificacion();
      if (abortador) abortador.abort();
      const num = ++solicitud;
      limpiar('Seleccioná paciente, profesional y tipo de atención.');
      if (!paciente.value || !profesional.value || !tipo.value) return;
      const estaFirma = firma();
      estado.textContent = 'Consultando arancel vigente…';
      const p = new URLSearchParams({
        cliente_id: paciente.value,
        profesional_id: profesional.value,
        tipoCobro: tipo.value,
        metodoPago: metodo.disabled ? 'efectivo' : metodo.value
      });
      abortador = new AbortController();
      try {
        const r = await fetch('/turnos/cotizacion?' + p.toString(), {
          method: 'GET', credentials: 'same-origin', cache: 'no-store',
          headers: { Accept: 'application/json' }, signal: abortador.signal
        });
        const payload = await r.json();
        if (!r.ok) throw new Error(payload.error || payload.mensaje || 'No se pudo obtener el arancel.');
        if (num !== solicitud || estaFirma !== firma()) return;
        firmaCotizada = estaFirma;
        ultimoMensaje = payload.aviso || '';
        estado.textContent = payload.tipoCobro === 'sin_cargo'
          ? 'Cobertura total: no corresponde cobrar al paciente.'
          : payload.tipoCobro === 'copago' ? 'Importe del copago registrado.' : 'Importe particular registrado.';
        base.textContent = dinero(payload.precioBase);
        descuento.textContent = payload.descuentoMonto > 0 ? '- ' + dinero(payload.descuentoMonto) : dinero(0);
        total.textContent = dinero(payload.montoTotal);
        nota.textContent = ultimoMensaje;
        if (textoBoton) textoBoton.textContent = 'Confirmar turno · ' + dinero(payload.montoTotal);
      } catch (e) {
        if (e.name === 'AbortError' || num !== solicitud) return;
        limpiar(e.message || 'No se pudo obtener el arancel.');
      }
    }

    paciente.addEventListener('change', cotizar);
    profesional.addEventListener('change', cotizar);
    tipo.addEventListener('change', cotizar);
    metodo.addEventListener('change', cotizar);
    confirmado.addEventListener('change', () => {
      if (confirmado.checked && firmaCotizada === firma()) nota.textContent = ultimoMensaje;
    });
    form.addEventListener('submit', ev => {
      actualizarVerificacion();
      if (firmaCotizada !== firma() ||
          (confirmado.required && !confirmado.checked)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        estado.textContent = confirmado.required && !confirmado.checked
          ? 'Confirmá la cobertura y el plan antes de reservar.'
          : 'Necesitás una cotización válida antes de confirmar.';
        cotizar();
      }
    }, true);
    actualizarVerificacion();
    cotizar();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else iniciar();
})();
