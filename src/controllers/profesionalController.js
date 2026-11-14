import { Profesional } from '../models/Profesional.js';
import { 
  desactivarProfesionalSeguro, 
  reactivarProfesionalSeguro, 
  eliminarProfesionalSeguro, 
  liberarCorreoProfesionalHuerfano 
} from '../services/gestionProfesionales.js';
import { Usuario } from '../models/Usuario.js';
import { 
  crearCuentaInstitucional, 
  validarCorreoPersonal, 
  comprobarModeloUsuarioInstitucional 
} from '../services/accesosInstitucionales.js';


export class ProfesionalController {

  // ============================================================
  // 1. LISTAR PROFESIONALES
  // ============================================================

  static async getProfesionales(req, res) {
    try {
      // Traigo todos los profesionales de la DB para mostrar la grilla
      const profesionales = await Profesional.find().lean({ virtuals: true });

      // Si la petición viene por AJAX o API, le devuelvo un JSON
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({
          status: 'success',
          data: profesionales || []
        });
      }

      // Si no, renderizo la vista normal de Pug
      return res.render('profesionales', {
        tituloPage: 'Listado de Profesionales',
        profesionales: profesionales || []
      });

    } catch (error) {
      console.error('❌ Error al obtener profesionales:', error);
      return res.status(500).send('Error al obtener profesionales: ' + error.message);
    }
  }


  // ============================================================
  // 2. DETALLE DE PROFESIONAL
  // ============================================================

  static async getDetalleProfesional(req, res) {
    try {
      const { id } = req.params;

      // Busco el perfil específico del médico
      const profesional = await Profesional.findById(id).lean({ virtuals: true });

      if (!profesional) {
        return res.status(404).render('detalle-profesional', {
          tituloPage: 'Profesional no encontrado',
          error: `El profesional con ID '${id}' no fue encontrado en el sistema.`
        });
      }

      // Soporte para respuestas JSON si lo consulto desde el frontend con JS
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(200).json({
          status: 'success',
          data: profesional
        });
      }

      return res.render('detalle-profesional', {
        tituloPage: `Detalle de ${profesional.nombre}`,
        profesional
      });

    } catch (error) {
      console.error('❌ Error al obtener detalle del profesional:', error);
      return res.status(500).send('Error al obtener el detalle: ' + error.message);
    }
  }


  // ============================================================
  // 3. CREAR PROFESIONAL Y SU CUENTA DE ACCESO
  // ============================================================

  static async crearProfesional(req, res) {
    // Preparo estas variables afuera del try para poder hacer un "rollback" (deshacer todo)
    // si falla la creación de la cuenta en el medio del proceso.
    let nuevoProfesional = null;
    let cuentaInstitucional = null;

    try {
      // Saco todos los datos crudos del formulario
      const {
        nombre, dni, genero, email, telefono,
        matricula, especialidad, subespecialidad, tipoCobertura, sede,
        diasAtencion, horaInicio, horaFin, duracionTurnoMinutos, modalidad,
        permiteSobreturnos, diasSobreturnos, horaInicioSobreturnos, horaFinSobreturnos, cantidadMaximaSobreturnos,
        ofreceTelemedicina, diasTelemedicina, horaInicioTelemedicina, horaFinTelemedicina
      } = req.body;


      // Armé esta funcioncita para asegurarme de que los días siempre lleguen como un array,
      // incluso si en el formulario seleccionaron un solo día.
      const parseArrayStrings = (valor) => {
        if (!valor) return [];
        if (Array.isArray(valor)) return valor;
        return [valor];
      };


      // ========================================================
      // VERIFICAR CORREO PERSONAL ANTES DE CREAR
      // ========================================================

      // Me aseguro de que el correo tenga un formato válido y que esté listo el modelo de DB
      const correoPersonal = validarCorreoPersonal(email);
      comprobarModeloUsuarioInstitucional();

      // Freno todo si el mail ya lo está usando otra secretaria, médico o administrador
      if (await Usuario.exists({ email: correoPersonal })) {
        return res.status(409).send('Ya existe una cuenta de TurnoFlex con ese correo particular.');
      }


      // ========================================================
      // CREAR EL PERFIL PÚBLICO DEL PROFESIONAL
      // ========================================================

      nuevoProfesional = await Profesional.create({
        nombre, dni, genero, email: correoPersonal, telefono,
        matricula, especialidad, subespecialidad, tipoCobertura: tipoCobertura || 'ambas', sede,

        // Agenda General
        diasAtencion: parseArrayStrings(diasAtencion),
        horaInicio: horaInicio || '08:00',
        horaFin: horaFin || '18:00',
        duracionTurnoMinutos: Number(duracionTurnoMinutos) || 30,
        modalidad: modalidad || 'presencial',

        // Sobreturnos
        permiteSobreturnos: permiteSobreturnos === 'on' || permiteSobreturnos === true,
        diasSobreturnos: parseArrayStrings(diasSobreturnos),
        horaInicioSobreturnos: horaInicioSobreturnos || '',
        horaFinSobreturnos: horaFinSobreturnos || '',
        cantidadMaximaSobreturnos: Math.min(Number(cantidadMaximaSobreturnos) || 4, 8),

        // Telemedicina
        ofreceTelemedicina: ofreceTelemedicina === 'on' || ofreceTelemedicina === true,
        diasTelemedicina: parseArrayStrings(diasTelemedicina),
        horaInicioTelemedicina: horaInicioTelemedicina || '',
        horaFinTelemedicina: horaFinTelemedicina || ''
      });


      // ========================================================
      // CREAR LA CUENTA Y ENVIAR INVITACIÓN AL CORREO PERSONAL
      // ========================================================

      // En vez de ponerle una contraseña por defecto, le creo la cuenta institucional 
      // vinculada y le mando un link seguro para que el médico active su cuenta.
      const alta = await crearCuentaInstitucional({
        nombre,
        correoPersonal,
        rol: 'profesional',
        profesionalId: nuevoProfesional._id
      });

      cuentaInstitucional = alta.cuenta;


      // ========================================================
      // RESPUESTAS (JSON y HTML)
      // ========================================================

      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(201).json({
          status: 'success',
          data: nuevoProfesional,
          cuenta: {
            id: String(cuentaInstitucional._id),
            emailInstitucional: cuentaInstitucional.emailInstitucional,
            rol: cuentaInstitucional.rol,
            activo: cuentaInstitucional.activo
          },
          invitacionEnviada: alta.enviado
        });
      }

      // Si por algún motivo falló el envío del mail, muestro la pantalla de reintento.
      if (!alta.enviado) {
        return res.render('resultado-alta-institucional', {
          tituloPage: 'Invitación pendiente - TurnoFlex',
          cuenta: {
            id: String(cuentaInstitucional._id),
            nombre: cuentaInstitucional.nombre,
            email: cuentaInstitucional.email,
            emailInstitucional: cuentaInstitucional.emailInstitucional,
            rol: cuentaInstitucional.rol
          },
          enviado: false
        });
      }

      // Si salió todo perfecto, muestro la pantalla verde de confirmación
      return res.render('resultado-alta-institucional', {
        tituloPage: 'Profesional registrado - TurnoFlex',
        cuenta: {
          id: String(cuentaInstitucional._id),
          nombre: cuentaInstitucional.nombre,
          email: cuentaInstitucional.email,
          emailInstitucional: cuentaInstitucional.emailInstitucional,
          rol: cuentaInstitucional.rol
        },
        enviado: alta.enviado
      });

    } catch (error) {
      // ROLLBACK: Si la DB guardó el perfil pero la cuenta de usuario explotó, 
      // borro el perfil para no dejar a un médico fantasma sin acceso al sistema.
      if (nuevoProfesional && !cuentaInstitucional) {
        try {
          await Profesional.deleteOne({ _id: nuevoProfesional._id });
        } catch (rollbackError) {
          console.error('No se pudo revertir el perfil incompleto:', rollbackError);
        }
      }

      console.error('❌ Error al crear profesional:', error);

      return res
        .status(error.code === 11000 ? 409 : 400)
        .send('Error al crear profesional: ' + error.message);
    }
  }

  
  // ============================================================
  // 4. ABRIR EL FORMULARIO DE EDICIÓN
  // ============================================================

  static async getEditarProfesional(req, res) {
    try {
      const usuario = req.session?.usuario;

      // Bloqueo de seguridad: los médicos o pacientes no pueden entrar a editar perfiles
      if (!['admin', 'personal'].includes(usuario?.rol)) {
        return res.status(403).send('Acceso no autorizado.');
      }

      // Busco el perfil cuidando que no me traiga a alguien que fue desactivado
      const profesional = await Profesional.findOne({
        _id: req.params.id,
        activo: { $ne: false }
      }).lean();

      if (!profesional) {
        return res.status(404).send('Profesional no encontrado o desactivado.');
      }

      return res.render('editar-profesional', {
        tituloPage: 'Editar profesional',
        profesional
      });

    } catch (error) {
      console.error('Error al abrir edición:', error);
      if (error.name === 'CastError') return res.status(400).send('ID inválido.');
      return res.status(500).send('No se pudo abrir el formulario de edición.');
    }
  }

  // ============================================================
  // 5. GUARDAR LAS MODIFICACIONES DEL PERFIL
  // ============================================================

  static async actualizarProfesional(req, res) {
    try {
      const usuario = req.session?.usuario;

      if (!['admin', 'personal'].includes(usuario?.rol)) {
        return res.status(403).send('Acceso no autorizado.');
      }

      const campos = [
        'nombre', 'dni', 'genero', 'email', 'telefono', 'matricula',
        'especialidad', 'subespecialidad', 'tipoCobertura', 'sede',
        'horaInicio', 'horaFin', 'modalidad'
      ];

      const cambios = {};

      // Limpio los espacios en blanco de todos los campos de texto
      for (const campo of campos) {
        if (typeof req.body[campo] === 'string') {
          cambios[campo] = req.body[campo].trim();
        }
      }

      // Chequeo duro para evitar que me manden formularios rotos por postman
      const obligatorios = [
        'nombre', 'dni', 'genero', 'email', 'telefono', 
        'matricula', 'especialidad', 'subespecialidad', 'horaInicio', 'horaFin'
      ];

      if (obligatorios.some(c => !cambios[c])) {
        return res.status(400).send('Completá todos los campos obligatorios.');
      }

      if (cambios.horaInicio >= cambios.horaFin) {
        return res.status(400).send('La hora de finalización debe ser posterior al inicio.');
      }

      if (req.body.duracionTurnoMinutos !== undefined) {
        const duracion = Number(req.body.duracionTurnoMinutos);
        if (!Number.isInteger(duracion) || duracion < 5 || duracion > 120) {
          return res.status(400).send('La duración del turno no es válida.');
        }
        cambios.duracionTurnoMinutos = duracion;
      }

      const convertirDias = (valor) => {
        if (!valor) return [];
        return Array.isArray(valor) ? valor : [valor];
      };

      const dias = convertirDias(req.body.diasAtencion);

      if (!dias.length) {
        return res.status(400).send('Seleccioná al menos un día de atención.');
      }
      cambios.diasAtencion = dias;


      // Actualizo las agendas opcionales solo si el usuario abrió ese panel en la vista
      if (req.body.editarConfiguracionAvanzada === 'si') {
        cambios.permiteSobreturnos = req.body.permiteSobreturnos === 'on';
        cambios.diasSobreturnos = convertirDias(req.body.diasSobreturnos);
        cambios.horaInicioSobreturnos = String(req.body.horaInicioSobreturnos || '');
        cambios.horaFinSobreturnos = String(req.body.horaFinSobreturnos || '');
        cambios.cantidadMaximaSobreturnos = Number(req.body.cantidadMaximaSobreturnos || 4);

        cambios.ofreceTelemedicina = req.body.ofreceTelemedicina === 'on';
        cambios.diasTelemedicina = convertirDias(req.body.diasTelemedicina);
        cambios.horaInicioTelemedicina = String(req.body.horaInicioTelemedicina || '');
        cambios.horaFinTelemedicina = String(req.body.horaFinTelemedicina || '');
      }

      const profesional = await Profesional.findOne({
        _id: req.params.id,
        activo: { $ne: false }
      });

      if (!profesional) {
        return res.status(404).send('Profesional no encontrado o desactivado.');
      }


      // ========================================================
      // SINCRONIZAR EMAIL CON LA CUENTA DE USUARIO
      // ========================================================
      // Si a la secretaria se le ocurre cambiarle el mail al médico en su perfil, 
      // tengo que asegurarme de actualizar también su cuenta de acceso, si no, se queda afuera.
      
      const correoAnterior = profesional.email;
      const cuentaVinculada = await Usuario.findOne({
        profesional_id: profesional._id,
        rol: 'profesional'
      });

      if (cuentaVinculada) {
        cambios.email = validarCorreoPersonal(cambios.email);
        
        // Verifico que el nuevo mail no choque con otra cuenta
        if (cuentaVinculada.email !== cambios.email) {
          const conflicto = await Usuario.exists({
            email: cambios.email,
            _id: { $ne: cuentaVinculada._id }
          });
          
          if (conflicto) {
            return res.status(409).send('Ese correo ya está asociado a otra cuenta de TurnoFlex.');
          }
        }
      }

      profesional.set(cambios);
      await profesional.save();

      // Hago la actualización real en la cuenta de usuario
      if (cuentaVinculada && cuentaVinculada.email !== cambios.email) {
        try {
          await Usuario.updateOne(
            { _id: cuentaVinculada._id, rol: 'profesional' },
            { $set: { email: cambios.email } }
          );
        } catch (error) {
          // Rollback: Si falló la cuenta, le devuelvo el mail viejo al perfil para no desincronizarlos
          await Profesional.updateOne(
            { _id: profesional._id },
            { $set: { email: correoAnterior } }
          ).catch(e => console.error('Error restaurando email médico:', e));
          
          throw error;
        }
      }

      return res.redirect(`/profesionales/${profesional._id}`);

    } catch (error) {
      console.error('Error al actualizar profesional:', error);
      if (error.code === 11000) return res.status(409).send('Ya existe un profesional con ese DNI, correo o matrícula.');
      if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).send(error.message);
      return res.status(500).send('No fue posible actualizar el profesional.');
    }
  }


  // ============================================================
  // DESACTIVAR PROFESIONAL (BAJA LÓGICA)
  // Conservo la ruta vieja "/eliminar" porque ya está linkeada en muchos lados, 
  // pero uso los servicios nuevos para ocultarlo sin perder sus historias clínicas.
  // ============================================================
  static async eliminarProfesional(req, res) {
    try {
      if (!['admin', 'personal'].includes(req.session?.usuario?.rol)) {
        return res.status(403).send('Acceso no autorizado.');
      }
      
      await desactivarProfesionalSeguro(req.params.id);
      
      return res.redirect('/profesionales?exito=Profesional+desactivado');
    } catch (error) {
      console.error('Error al desactivar profesional:', error);
      return res.status(error.statusCode || 500).send(
        error.statusCode ? error.message : 'No se pudo desactivar el profesional.'
      );
    }
  }


  // ============================================================
  // REACTIVAR PROFESIONAL
  // ============================================================
  static async reactivarProfesional(req, res) {
    try {
      // Solo el admin puede deshacer una baja
      if (req.session?.usuario?.rol !== 'admin') {
        return res.status(403).send('Solo administración puede reactivar profesionales.');
      }
      
      await reactivarProfesionalSeguro(req.params.id);
      
      return res.redirect('/profesionales?exito=Profesional+reactivado');
    } catch (error) {
      console.error('Error al reactivar profesional:', error);
      return res.status(error.statusCode || 500).send(
        error.statusCode ? error.message : 'No se pudo reactivar el profesional.'
      );
    }
  }


  // ============================================================
  // HARD DELETE: ELIMINAR PROFESIONAL DE VERDAD (Pruebas)
  // Uso este método ultra agresivo para limpiar la DB cuando 
  // cargamos médicos de prueba que no tienen historiales reales.
  // ============================================================
  static async eliminarProfesionalDefinitivamente(req, res) {
    try {
      if (req.session?.usuario?.rol !== 'admin') {
        return res.status(403).send('Solo administración puede borrar definitivamente.');
      }
      
      // Doble chequeo manual por seguridad
      if (req.body.confirmar !== 'ELIMINAR') {
        return res.status(400).send('Falta la confirmación de borrado definitivo.');
      }
      
      const resultado = await eliminarProfesionalSeguro(req.params.id);
      console.log(`Baja definitiva de ${resultado.nombre}: ${resultado.usuariosEliminados} cuenta(s).`);
      
      return res.redirect('/profesionales?exito=Profesional+y+cuenta+eliminados');
    } catch (error) {
      console.error('Error al borrar definitivamente:', error);
      return res.status(error.statusCode || 500).send(
        error.statusCode ? error.message : 'No se pudo completar el borrado. No reintentes sin revisar el estado.'
      );
    }
  }


  // ============================================================
  // LIMPIAR CUENTAS FANTASMAS
  // Por si alguna vez el rollback falla y me queda un mail trabado.
  // ============================================================
  static async liberarCorreoHuerfano(req, res) {
    try {
      if (req.session?.usuario?.rol !== 'admin') {
        return res.status(403).send('Solo administración puede liberar correos.');
      }
      if (req.body.confirmar !== 'LIBERAR') {
        return res.status(400).send('Falta la confirmación para liberar correo.');
      }
      
      await liberarCorreoProfesionalHuerfano(req.body.email);
      
      return res.redirect('/profesionales?exito=Correo+de+prueba+liberado');
    } catch (error) {
      console.error('Error al liberar correo huérfano:', error);
      return res.status(error.statusCode || 500).send(
        error.statusCode ? error.message : 'No se pudo liberar el correo.'
      );
    }
  }
}

export default ProfesionalController;